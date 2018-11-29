import * as sequelize from 'sequelize';
import { Transaction } from 'sequelize';
import { Column, DataType, Model, Table } from 'sequelize-typescript';
import * as sequelizeUtils from 'sequelize/lib/utils';
import { publicKey } from '../types/sanityTypes';

@Table({ tableName: 'mem_round' })
export class RoundsModel extends Model<RoundsModel> {
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

}
