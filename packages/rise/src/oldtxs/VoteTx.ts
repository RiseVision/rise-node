import {
  Accounts2DelegatesModel,
  Accounts2U_DelegatesModel,
  AccountsModelForDPOS,
  DelegatesModule,
  DposConstantsType,
  dPoSSymbols,
  RoundsLogic,
} from '@risevision/core-consensus-dpos';
import {
  IAccountLogic,
  IAccountsModel,
  IAccountsModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import {
  DBOp,
  IBaseTransaction,
  SignedBlockType,
} from '@risevision/core-types';
import { Diff } from '@risevision/core-utils';
import { inject, injectable, named, postConstruct } from 'inversify';
import * as _ from 'lodash';
import { Model } from 'sequelize-typescript';
import * as z_schema from 'z-schema';
import { OldVoteTxModel } from '../models';
import { RISESymbols } from '../symbols';
import { OldBaseTx } from './BaseOldTx';
// tslint:disable-next-line
const voteSchema = require('../../schema/vote.asset.json');

// tslint:disable-next-line
export type VoteAsset = {
  votes: string[];
};
@injectable()
export class OldVoteTx extends OldBaseTx<VoteAsset, OldVoteTxModel> {
  // Generic
  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  @inject(dPoSSymbols.constants)
  private dposConstants: DposConstantsType;

  // Logic
  @inject(dPoSSymbols.logic.rounds)
  private roundsLogic: RoundsLogic;
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  // Module
  @inject(Symbols.modules.accounts)
  private accountsModule: IAccountsModule<AccountsModelForDPOS>;
  @inject(dPoSSymbols.modules.delegates)
  private delegatesModule: DelegatesModule;

  // models
  @inject(ModelSymbols.model)
  @named(RISESymbols.models.oldVotesModel)
  private OldVoteTxModel: typeof OldVoteTxModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.accounts2UDelegates)
  // tslint:disable-next-line
  private Accounts2U_DelegatesModel: typeof Accounts2U_DelegatesModel;
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.accounts2Delegates)
  private Accounts2DelegatesModel: typeof Accounts2DelegatesModel;
  @inject(ModelSymbols.model)
  @named(Symbols.models.accounts)
  private AccountsModel: typeof IAccountsModel;

  public calculateMinFee(
    tx: IBaseTransaction<VoteAsset>,
    sender: IAccountsModel,
    height: number
  ) {
    return this.systemModule.getFees(height).fees.vote;
  }

  public async verify(
    tx: IBaseTransaction<VoteAsset> & { senderId: string },
    sender: AccountsModelForDPOS
  ): Promise<void> {
    if (tx.recipientId !== tx.senderId) {
      throw new Error('Missing recipient');
    }

    if (!tx.asset || !tx.asset.votes) {
      throw new Error('Invalid transaction asset');
    }

    if (!Array.isArray(tx.asset.votes)) {
      throw new Error('Invalid votes. Must be an array');
    }

    if (!tx.asset.votes.length) {
      throw new Error('Invalid votes. Must not be empty');
    }

    if (
      tx.asset.votes &&
      tx.asset.votes.length > this.dposConstants.maxVotesPerTransaction
    ) {
      throw new Error(
        `Voting limit exceeded. Maximum is ${
          this.dposConstants.maxVotesPerTransaction
        } votes per transaction`
      );
    }

    // Assert vote is valid
    tx.asset.votes.forEach((v) => this.assertValidVote(v));

    // Check duplicates
    const dups = tx.asset.votes.filter((v, i, a) => a.indexOf(v) !== i);

    if (dups.length > 0) {
      throw new Error('Multiple votes for same delegate are not allowed');
    }

    return this.checkConfirmedDelegates(tx, sender);
  }

  public async findConflicts(
    txs: Array<IBaseTransaction<VoteAsset>>
  ): Promise<Array<IBaseTransaction<VoteAsset>>> {
    // This piece of logic does not really finds conflicting transactions
    // It will allow only one tx per given set per sender.
    // this will ensure no conflicting votes will be casted that could cause a block to be invalid.

    const grouped = _.groupBy(txs, (a) => a.senderId);
    const conflictingTransactions: Array<IBaseTransaction<VoteAsset>> = [];
    // tslint:disable-next-line
    for (const senderId in grouped) {
      const groupedTXsBySender = grouped[senderId];
      if (groupedTXsBySender.length > 1) {
        conflictingTransactions.push(...groupedTXsBySender.slice(1));
      }
    }
    return conflictingTransactions;
  }

  public assetBytes(tx: IBaseTransaction<VoteAsset>): Buffer {
    return Buffer.from((tx.asset.votes || []).join(''), 'utf8');
  }

  public readAsset(bytes: Buffer): { consumedBytes: number; asset: VoteAsset } {
    let totalKeys = 0;
    for (
      ;
      ['-', '+'].indexOf(bytes.slice(totalKeys * 65, 1).toString('utf8')) !==
      -1;
      totalKeys++
    ) {
      // Noop
    }
    const votes: string[] = [];

    for (let i = 0; i < totalKeys; i++) {
      votes.push(bytes.slice(i * 65, (i + 1) * 65).toString('utf8'));
    }
    return { consumedBytes: totalKeys * 65, asset: { votes } };
  }

  // tslint:disable-next-line max-line-length
  public async apply(
    tx: IBaseTransaction<VoteAsset>,
    block: SignedBlockType,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    await this.checkConfirmedDelegates(tx, sender);
    sender.applyDiffArray('delegates', tx.asset.votes);
    return this.calculateOPs(
      this.Accounts2DelegatesModel,
      tx.asset,
      sender.address
    );
  }

  // tslint:disable-next-line max-line-length
  public async undo(
    tx: IBaseTransaction<VoteAsset, bigint>,
    block: SignedBlockType,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    this.objectNormalize(tx);
    const invertedVotes = Diff.reverse(tx.asset.votes);
    sender.applyDiffArray('delegates', invertedVotes);
    return this.calculateOPs(
      this.Accounts2DelegatesModel,
      { votes: invertedVotes },
      sender.address
    );
  }

  public async applyUnconfirmed(
    tx: IBaseTransaction<VoteAsset, bigint>,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    await this.checkUnconfirmedDelegates(tx, sender);
    sender.applyDiffArray('u_delegates', tx.asset.votes);
    return this.calculateOPs(
      this.Accounts2U_DelegatesModel,
      tx.asset,
      sender.address
    );
  }

  public async undoUnconfirmed(
    tx: IBaseTransaction<VoteAsset, bigint>,
    sender: AccountsModelForDPOS
  ): Promise<Array<DBOp<any>>> {
    this.objectNormalize(tx);
    const reversedVotes = Diff.reverse(tx.asset.votes);
    sender.applyDiffArray('u_delegates', reversedVotes);
    return this.calculateOPs(
      this.Accounts2U_DelegatesModel,
      { votes: reversedVotes },
      sender.address
    );
  }

  /**
   * Checks vote integrity of tx sender
   */
  public async checkUnconfirmedDelegates(
    tx: IBaseTransaction<VoteAsset>,
    sender: AccountsModelForDPOS
  ): Promise<any> {
    const { added, removed } = await this.computeAddedRemoved(tx.asset);
    return this.delegatesModule.checkUnconfirmedDelegates(
      sender,
      added,
      removed
    );
  }

  /**
   * Checks vote integrity of sender
   */
  public async checkConfirmedDelegates(
    tx: IBaseTransaction<VoteAsset>,
    sender: AccountsModelForDPOS
  ): Promise<any> {
    const { added, removed } = await this.computeAddedRemoved(tx.asset);
    return this.delegatesModule.checkConfirmedDelegates(sender, added, removed);
  }

  public objectNormalize(
    tx: IBaseTransaction<VoteAsset, bigint>
  ): IBaseTransaction<VoteAsset, bigint> {
    const report = this.schema.validate(tx.asset, voteSchema);
    if (!report) {
      throw new Error(
        `Failed to validate vote schema: ${this.schema
          .getLastErrors()
          .map((err) => err.message)
          .join(', ')}`
      );
    }

    return tx;
  }

  public dbRead(raw: any): VoteAsset {
    if (!raw.v_votes) {
      return null;
    }
    return { votes: raw.v_votes.split(',') };
  }

  // tslint:disable-next-line max-line-length
  public dbSave(
    tx: IBaseTransaction<VoteAsset> & { senderId: string }
  ): DBOp<any> {
    return {
      model: this.OldVoteTxModel,
      type: 'create',
      values: {
        transactionId: tx.id,
        votes: Array.isArray(tx.asset.votes) ? tx.asset.votes.join(',') : null,
      },
    };
  }

  public async attachAssets(txs: Array<IBaseTransaction<VoteAsset>>) {
    const res = await this.OldVoteTxModel.findAll({
      where: { transactionId: txs.map((tx) => tx.id) },
    });

    const indexes = {};
    res.forEach((tx, idx) => (indexes[tx.transactionId] = idx));

    txs.forEach((tx) => {
      if (typeof indexes[tx.id] === 'undefined') {
        throw new Error(`Couldn't restore asset for Vote tx: ${tx.id}`);
      }
      const info = res[indexes[tx.id]];
      tx.asset = {
        votes: info.votes.split(','),
      };
    });
  }

  public getMaxBytesSize(): number {
    let size = super.getMaxBytesSize();
    size += this.dposConstants.maxVotesPerTransaction * 65; // 64 bytes for pubkey + "sign"
    return size;
  }

  @postConstruct()
  private postConstruct() {
    voteSchema.properties.votes.maxItems = this.dposConstants.maxVotesPerTransaction;
  }

  private async computeAddedRemoved(
    voteAsset: VoteAsset
  ): Promise<{ added: string[]; removed: string[] }> {
    const added: string[] = [];
    const removed: string[] = [];

    for (const vote of voteAsset.votes) {
      const add = vote.slice(0, 1) === '+';
      const pubKey = Buffer.from(vote.slice(1), 'hex');

      const del = await this.accountsModule.getAccount({
        forgingPK: pubKey,
        isDelegate: 1,
      });

      if (!del) {
        throw new Error(
          `Cannot find delegate matching pk: ${pubKey.toString('hex')}`
        );
      }
      if (add) {
        added.push(del.username);
      } else {
        removed.push(del.username);
      }
    }

    return { added, removed };
  }

  private assertValidVote(vote: string) {
    if (typeof vote !== 'string') {
      throw new Error('Invalid vote type');
    }

    if (['-', '+'].indexOf(vote[0]) === -1) {
      throw new Error('Invalid vote format');
    }

    const pkey = vote.substring(1);
    if (!this.schema.validate(pkey, { format: 'publicKey' })) {
      throw new Error('Invalid vote publicKey');
    }
  }

  private async calculateOPs(
    model: typeof Model & (new () => any),
    asset: VoteAsset,
    senderAddress: string
  ) {
    const ops: Array<DBOp<any>> = [];

    const { added, removed } = await this.computeAddedRemoved(asset);

    if (removed.length > 0) {
      ops.push({
        model,
        options: {
          limit: removed.length,
          where: {
            address: senderAddress,
            username: removed,
          },
        },
        type: 'remove',
      });
    }
    // create new elements for each added pk.
    if (added.length > 0) {
      ops.push({
        model,
        type: 'bulkCreate',
        values: added.map((username) => ({
          address: senderAddress,
          username,
        })),
      });
    }

    return ops;
  }
}
