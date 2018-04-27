import {
  Column,
  DataType,
  Model,
  Sequelize,
  Table
} from 'sequelize-typescript';
import { PeerState } from '../logic';
import { publicKey } from '../types/sanityTypes';
import * as sequelize from 'sequelize';

@Table({tableName: 'mem_round'})
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
  public static async sumRound(activeDelegates: number, round: number):
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
        replacements: {activeDelegates, round},
        type        : sequelize.QueryTypes.SELECT,
      }
    );
    return res;
  }

  public static async getVotes(round: number): Promise<{delegate: publicKey, amount: string, round: string}> {
    const [res] = await this.sequelize.query(
      `SELECT d."delegate", d."amount" FROM (SELECT m."delegate", SUM(m."amount") AS "amount", "round"
      FROM mem_round m GROUP BY m."delegate", m."round") AS d WHERE "round" = (:round)::bigint`,
      {
        replacements: { round },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    return res;
  }
}

//const s = new Sequelize({
//  database: 'rise_db',
//  dialect : 'postgres',
//  password: 'password',
//  username: 'rise',
//});
//
//s.addModels([RoundsModel]);
//
//RoundsModel.getVotes(9010)
//  .then((bit) => {
//    console.log(bit)
//  })
//
//PeersModel.findOne({})
//  .then((p) => {
//    console.log(p);
//    console.log(p.state === PeerState.CONNECTED);
//    console.log(PeerState.CONNECTED);
//  })
