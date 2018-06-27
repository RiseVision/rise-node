import { inject, injectable } from 'inversify';
import * as z_schema from 'z-schema';
import { constants, Diff, TransactionType } from '../../helpers/';
import { IAccountLogic, IRoundsLogic } from '../../ioc/interfaces/logic';
import { IDelegatesModule, ISystemModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import {
  Accounts2DelegatesModel,
  Accounts2U_DelegatesModel,
  AccountsModel,
  RoundsModel,
  VotesModel
} from '../../models/';
import voteSchema from '../../schema/logic/transactions/vote';
import { DBCustomOp, DBOp } from '../../types/genericTypes';
import { SignedBlockType } from '../block';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from './baseTransactionType';
import { Model } from 'sequelize-typescript';

// tslint:disable-next-line interface-over-type-literal
export type VoteAsset = {
  votes: string[];
};

@injectable()
export class VoteTransaction extends BaseTransactionType<VoteAsset, VotesModel> {
  // Generic
  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  // Logic
  @inject(Symbols.logic.rounds)
  private roundsLogic: IRoundsLogic;
  @inject(Symbols.logic.account)
  private accountLogic: IAccountLogic;

  // Module
  @inject(Symbols.modules.delegates)
  private delegatesModule: IDelegatesModule;
  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  // models
  @inject(Symbols.models.votes)
  private VotesModel: typeof VotesModel;
  @inject(Symbols.models.accounts2U_Delegates)
  private Accounts2U_DelegatesModel: typeof Accounts2U_DelegatesModel;
  @inject(Symbols.models.accounts2Delegates)
  private Accounts2DelegatesModel: typeof Accounts2DelegatesModel;
  @inject(Symbols.models.accounts)
  private AccountsModel: typeof AccountsModel;
  @inject(Symbols.models.rounds)
  private RoundsModel: typeof RoundsModel;

  constructor() {
    super(TransactionType.VOTE);
  }

  public calculateFee(tx: IBaseTransaction<VoteAsset>, sender: AccountsModel, height: number): number {
    return this.systemModule.getFees(height).fees.vote;
  }

  public async verify(tx: IBaseTransaction<VoteAsset> & { senderId: string }, sender: AccountsModel): Promise<void> {
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

    if (tx.asset.votes && tx.asset.votes.length > constants.maxVotesPerTransaction) {
      throw new Error(`Voting limit exceeded. Maximum is ${constants.maxVotesPerTransaction} votes per transaction`);
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

  public getBytes(tx: IBaseTransaction<VoteAsset>, skipSignature: boolean, skipSecondSignature: boolean): Buffer {
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
      votes: [].concat.apply([],
        votesString.split('').map(
          (x, i) => i % 65 ? [] : votesString.slice(i, i + 65)
        )
      ),
    };
  }

  // tslint:disable-next-line max-line-length
  public async apply(tx: IConfirmedTransaction<VoteAsset>, block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    await this.checkConfirmedDelegates(tx, sender);
    sender.applyDiffArray('delegates', tx.asset.votes);
    const ops = this.calculateOPs(this.Accounts2DelegatesModel, block.id, tx.asset.votes, sender.address);
    ops.push(... tx.asset.votes.map<DBCustomOp<RoundsModel>>((vote) => {
      const add      = vote[0] === '+';
      const delegate = vote.substr(1);
      return {
        model: this.RoundsModel,
        query: this.RoundsModel.insertMemRoundDelegatesSQL({
          add,
          address: sender.address,
          blockId: block.id,
          delegate,
          round  : this.roundsLogic.calcRound(block.height),
        }),
        type : 'custom',
      };
    }));
    return ops;
  }

  // tslint:disable-next-line max-line-length
  public async undo(tx: IConfirmedTransaction<VoteAsset>, block: SignedBlockType, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    this.objectNormalize(tx);
    const invertedVotes = Diff.reverse(tx.asset.votes);
    sender.applyDiffArray('delegates', invertedVotes);
    const ops = this.calculateOPs(this.Accounts2DelegatesModel, block.id, invertedVotes, sender.address);
    // tslint:disable-next-line
    ops.push(... invertedVotes.map<DBCustomOp<RoundsModel>>((vote) => {
      const add      = vote[0] === '+';
      const delegate = vote.substr(1);
      return {
        model: this.RoundsModel,
        query: this.RoundsModel.insertMemRoundDelegatesSQL({
          add,
          address: sender.address,
          blockId: block.id,
          delegate,
          round  : this.roundsLogic.calcRound(block.height),
        }),
        type : 'custom',
      };
    }));
    return ops;
  }

  public async applyUnconfirmed(tx: IBaseTransaction<VoteAsset>, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    await this.checkUnconfirmedDelegates(tx, sender);
    sender.applyDiffArray('u_delegates', tx.asset.votes);
    return this.calculateOPs(this.Accounts2U_DelegatesModel, null, tx.asset.votes, sender.address);
  }

  public async undoUnconfirmed(tx: IBaseTransaction<VoteAsset>, sender: AccountsModel): Promise<Array<DBOp<any>>> {
    this.objectNormalize(tx);
    const reversedVotes = Diff.reverse(tx.asset.votes);
    sender.applyDiffArray('u_delegates', reversedVotes);
    return this.calculateOPs(this.Accounts2U_DelegatesModel, null, reversedVotes, sender.address);
  }

  /**
   * Checks vote integrity of tx sender
   */
  public checkUnconfirmedDelegates(tx: IBaseTransaction<VoteAsset>, sender: AccountsModel): Promise<any> {
    return this.delegatesModule.checkUnconfirmedDelegates(sender, tx.asset.votes);
  }

  /**
   * Checks vote integrity of sender
   */
  public checkConfirmedDelegates(tx: IBaseTransaction<VoteAsset>, sender: AccountsModel): Promise<any> {
    return this.delegatesModule.checkConfirmedDelegates(sender, tx.asset.votes);
  }

  public objectNormalize(tx: IBaseTransaction<VoteAsset>): IBaseTransaction<VoteAsset> {
    const report = this.schema.validate(tx.asset, voteSchema);
    if (!report) {
      throw new Error(`Failed to validate vote schema: ${this.schema.getLastErrors()
        .map((err) => err.message).join(', ')}`);
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
  public dbSave(tx: IConfirmedTransaction<VoteAsset> & { senderId: string }): DBOp<any> {
    return {
      model : this.VotesModel,
      type  : 'create',
      values: {
        transactionId: tx.id,
        votes        : Array.isArray(tx.asset.votes) ? tx.asset.votes.join(',') : null,
      },
    };
  }

  private assertValidVote(vote: string) {
    if (typeof(vote) !== 'string') {
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

  private calculateOPs(model: typeof Model & (new () => any), blockId: string, votesArray: string[], senderAddress: string) {
    const ops: Array<DBOp<any>> = [];

    const removedPks = votesArray.filter((v) => v.startsWith('-'))
      .map((v) => v.substr(1));
    const addedPks   = votesArray.filter((v) => v.startsWith('+'))
      .map((v) => v.substr(1));

    // Remove unvoted publickeys.
    if (removedPks.length > 0) {
      ops.push({
        model,
        options: {
          limit: removedPks.length,
          where: {
            accountId  : senderAddress,
            dependentId: removedPks,
          },
        },
        type   : 'remove',
      });
    }
    // create new elements for each added pk.
    if (addedPks.length > 0) {
      ops.push({
        model,
        type  : 'bulkCreate',
        values: addedPks.map((pk) => ({ dependentId: pk, accountId: senderAddress })),
      });
    }

    if (blockId) {
      ops.push({
        model  : this.AccountsModel,
        options: { where: { address: senderAddress } },
        type   : 'update',
        values : { blockId },
      });
    }
    return ops;
  }

  public async attachAssets(txs: Array<IConfirmedTransaction<VoteAsset>>) {
    const res = await this.VotesModel
      .findAll({
        where: { transactionId: txs.map((tx) => tx.id) },
      });

    const indexes = {};
    res.forEach((tx, idx) => indexes[tx.transactionId] = idx);

    txs.forEach((tx) => {
      if (typeof(indexes[tx.id]) === 'undefined') {
        throw new Error(`Couldn't restore asset for Vote tx: ${tx.id}`);
      }
      const info = res[indexes[tx.id]];
      tx.asset   = {
        votes: info.votes.split(','),
      };
    });
  }
}
