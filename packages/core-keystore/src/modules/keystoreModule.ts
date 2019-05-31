import { ModelSymbols } from '@risevision/core-models';
import { TXSymbols } from '@risevision/core-transactions';
import { Address, ITransactionsModel } from '@risevision/core-types';
import { inject, injectable, named } from 'inversify';
import * as sequelize from 'sequelize';
import { KeystoreModel } from '../models/';
import { KeystoreTxSymbols } from '../symbols';

@injectable()
export class KeystoreModule {
  @inject(ModelSymbols.model)
  @named(KeystoreTxSymbols.model)
  private keystoreModel: typeof KeystoreModel;

  @inject(ModelSymbols.model)
  @named(TXSymbols.models.model)
  private transactionsModel: typeof ITransactionsModel;

  /**
   * Computes and returns all current and history for each key for the provided address
   * @param senderId the sender to query
   */
  public async getAllAcctValues(senderId: Address) {
    const data: Array<
      KeystoreModel & { 'transaction.height': number }
    > = await this.keystoreModel.findAll({
      include: [
        {
          as: 'transaction',
          attributes: ['height'],
          model: this.transactionsModel,
          where: { senderId },
        },
      ],
      order: [sequelize.literal('"transaction"."height" ASC')],
      raw: true,
    });

    const current: { [k: string]: Buffer } = {};
    const history: {
      [k: string]: Array<{ height: number; id: string; value }>;
    } = {};

    for (const d of data) {
      current[d.key] = d.value;
      history[d.key] = history[d.key] || [];
      history[d.key].push({
        height: d['transaction.height'],
        id: d.transactionId,
        value: d.value,
      });
    }

    // Reverse history to have it in descending order.
    Object.keys(history).forEach((k) => {
      history[k] = history[k].reverse();
    });

    return {
      current,
      history,
    };
  }

  /**
   * Returns the current value for specific key and address pair
   * @param senderId address
   * @param key key
   */
  public async getAcctKeyValue(
    senderId: Address,
    key: string
  ): Promise<Buffer | undefined> {
    const all = await this.getAllAcctValues(senderId);
    return all.current[key];
  }

  /**
   * Returns the whole history, sorted DESC, for the given key+sender pair
   * @param senderId
   * @param key
   */
  // tslint:disable-next-line
  public async getAcctKeyHistory(
    senderId: Address,
    key: string
  ): Promise<Array<{ height: number; id: string; value: Buffer }>> {
    const all = await this.getAllAcctValues(senderId);
    return all.history[key];
  }
}
