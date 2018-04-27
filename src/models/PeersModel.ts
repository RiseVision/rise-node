import {
  Column,
  DataType,
  Model,
  Sequelize,
  Table
} from 'sequelize-typescript';
import { PeerState } from '../logic';

@Table({tableName: 'peers'})
export class PeersModel extends Model<PeersModel> {
  @Column
  public ip: string;

  @Column
  public port: number;

  @Column(DataType.SMALLINT)
  public state: PeerState;

  @Column
  public os: string;

  @Column
  public version: string;

  @Column
  public clock: number;

  @Column(DataType.BLOB)
  public broadhash: Buffer;

  @Column
  public height: number;

}

//const s = new Sequelize({
//  database: 'rise_db',
//  dialect : 'postgres',
//  password: 'password',
//  username: 'rise',
//});
//
//s.addModels([PeersModel]);
//
//PeersModel.findOne({})
//  .then((p) => {
//    console.log(p);
//    console.log(p.state === PeerState.CONNECTED);
//    console.log(PeerState.CONNECTED);
//  })
