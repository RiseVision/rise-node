import {
  IAccountLogic,
  IAccountsModel,
  ISystemModule,
  Symbols,
} from '@risevision/core-interfaces';
import { ModelSymbols } from '@risevision/core-models';
import { BaseTx } from '@risevision/core-transactions';
import {
  DBOp,
  IBaseTransaction,
  SignedBlockType,
  TransactionType,
} from '@risevision/core-types';
import { Diff } from '@risevision/core-utils';
import { inject, injectable, named, postConstruct } from 'inversify';
import { Model } from 'sequelize-typescript';
import * as z_schema from 'z-schema';
import { DposConstantsType, dPoSSymbols } from '../helpers/';
import {
  Accounts2DelegatesModel,
  Accounts2U_DelegatesModel,
  AccountsModelForDPOS,
  VotesModel,
} from '../models/';
import { DelegatesModule } from '../modules/';
import { RoundsLogic } from './rounds';

// tslint:disable-next-line
const voteSchema = require('../../schema/vote.json');

// tslint:disable-next-line interface-over-type-literal
export type VoteAsset = {
  votes: string[];
};

@injectable()
export class VoteTransaction extends BaseTx<VoteAsset, VotesModel> {
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
  @inject(dPoSSymbols.modules.delegates)
  private delegatesModule: DelegatesModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  // models
  @inject(ModelSymbols.model)
  @named(dPoSSymbols.models.votes)
  private VotesModel: typeof VotesModel;
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

  constructor() {
    super(TransactionType.VOTE);
  }

  public calculateFee(
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

  public getBytes(
    tx: IBaseTransaction<VoteAsset>,
    skipSignature: boolean,
    skipSecondSignature: boolean
  ): Buffer {
    return tx.asset.votes ? Buffer.from(tx.asset.votes.join(''), 'utf8') : null;
  }

  /**
   * Returns asset, given Buffer containing it
   */
  public fromBytes(bytes: Buffer, tx?: IBaseTransaction<any>): VoteAsset {
    if (bytes === null) {
      return null;
    }
    const votesString = bytes.toString('utf8');
    // Splits the votes into 33 bytes chunks (1 for the sign, 32 for the publicKey)
    return {
      votes: [].concat.apply(
        [],
        votesString
          .split('')
          .map((x, i) => (i % 65 ? [] : votesString.slice(i, i + 65)))
      ),
    };
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
      block.id,
      tx.asset.votes,
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
      block.id,
      invertedVotes,
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
      null,
      tx.asset.votes,
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
      null,
      reversedVotes,
      sender.address
    );
  }

  /**
   * Checks vote integrity of tx sender
   */
  public checkUnconfirmedDelegates(
    tx: IBaseTransaction<VoteAsset>,
    sender: AccountsModelForDPOS
  ): Promise<any> {
    return this.delegatesModule.checkUnconfirmedDelegates(
      sender,
      tx.asset.votes
    );
  }

  /**
   * Checks vote integrity of sender
   */
  public checkConfirmedDelegates(
    tx: IBaseTransaction<VoteAsset>,
    sender: AccountsModelForDPOS
  ): Promise<any> {
    return this.delegatesModule.checkConfirmedDelegates(sender, tx.asset.votes);
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
      model: this.VotesModel,
      type: 'create',
      values: {
        transactionId: tx.id,
        votes: Array.isArray(tx.asset.votes) ? tx.asset.votes.join(',') : null,
      },
    };
  }

  public async attachAssets(txs: Array<IBaseTransaction<VoteAsset>>) {
    const res = await this.VotesModel.findAll({
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

  private calculateOPs(
    model: typeof Model & (new () => any),
    blockId: string,
    votesArray: string[],
    senderAddress: string
  ) {
    const ops: Array<DBOp<any>> = [];

    const removedPks = votesArray
      .filter((v) => v.startsWith('-'))
      .map((v) => v.substr(1));
    const addedPks = votesArray
      .filter((v) => v.startsWith('+'))
      .map((v) => v.substr(1));

    // Remove unvoted publickeys.
    if (removedPks.length > 0) {
      ops.push({
        model,
        options: {
          limit: removedPks.length,
          where: {
            accountId: senderAddress,
            dependentId: removedPks,
          },
        },
        type: 'remove',
      });
    }
    // create new elements for each added pk.
    if (addedPks.length > 0) {
      ops.push({
        model,
        type: 'bulkCreate',
        values: addedPks.map((pk) => ({
          accountId: senderAddress,
          dependentId: pk,
        })),
      });
    }

    if (blockId) {
      ops.push({
        model: this.AccountsModel,
        options: { where: { address: senderAddress } },
        type: 'update',
        values: { blockId },
      });
    }
    return ops;
  }
}
