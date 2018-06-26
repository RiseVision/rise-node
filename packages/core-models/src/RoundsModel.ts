import { publicKey } from '@risevision/core-types';
import * as sequelize from 'sequelize';
import { Transaction } from 'sequelize';
import { Column, DataType, Table } from 'sequelize-typescript';
import * as sequelizeUtils from 'sequelize/lib/utils';
import { IBaseModel } from './BaseModel';

@Table({ tableName: 'mem_round' })
export class RoundsModel extends IBaseModel<RoundsModel> {
  @Column
  public address: string;

  @Column
  public amount: number;

  @Column(DataType.TEXT)
  public delegate: publicKey;

  @Column
  public blockId: string;

  @Column
  public round: number;

  // tslint:disable member-ordering
  public static async sumRound(activeDelegates: number, round: number, tx: Transaction):
    Promise<{ fees: null | string, rewards: null | string[], delegates: null | Buffer[] }> {

    const [res] = await this.sequelize.query(
      `SELECT SUM(r.fee)::bigint AS "fees", ARRAY_AGG(r.reward) AS rewards, ARRAY_AGG(r.pk) AS delegates
      FROM (
        SELECT b."totalFee" AS fee, b.reward, b."generatorPublicKey" AS pk
        FROM blocks b
        WHERE CEIL(b.height / :activeDelegates::float)::int = :round
        ORDER BY b.height ASC
      ) r`,
      {
        replacements: { activeDelegates, round },
        transaction : tx,
        type        : sequelize.QueryTypes.SELECT,
      }
    );
    return res;
  }

  /**
   * Generates SQL to update mem_accounts based on data in mem_rounds
   * @param {number} round
   * @return {string}
   */
  public static updateVotesSQL(round: number): string {
    return sequelizeUtils.formatNamedParameters(
      `UPDATE mem_accounts SET "vote" = "vote" + sub.amount::bigint
       FROM (
        SELECT d."delegate", d."amount"
          FROM (
            SELECT m."delegate", SUM(m."amount") AS "amount", "round" FROM mem_round m GROUP BY m."delegate", m."round"
          ) AS d
        WHERE "round" = (:round)::bigint
       ) as sub
       WHERE "publicKey" = decode(sub.delegate, 'hex');`,
      { round },
      'postgres'
    );
  }

  public static insertMemRoundBalanceSQL(params: { address: string, amount: number, blockId: string, round: number }) {
    return sequelizeUtils.formatNamedParameters(
      // tslint:disable-next-line
      'INSERT INTO mem_round ("address", "amount", "delegate", "blockId", "round") SELECT :address, (:amount)::bigint, "dependentId", :blockId, :round FROM mem_accounts2delegates WHERE "accountId" = :address',
      params,
      'postgres'
    );
  }

  public static insertMemRoundDelegatesSQL(params: { add: boolean, address: string, delegate: string, blockId: string, round: number }) {
    return sequelizeUtils.formatNamedParameters(
      // tslint:disable-next-line
      `INSERT INTO mem_round ("address", "amount", "delegate", "blockId", "round") SELECT :address, (${params.add ? '' : '-'}balance)::bigint, :delegate, :blockId, :round FROM mem_accounts WHERE address = :address`,
      params,
      'postgres'
    );
  }
}
