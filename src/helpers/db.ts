import { inject, injectable } from 'inversify';
import * as sequelize from 'sequelize';
import { Op, Sequelize } from 'sequelize';
import { Model } from 'sequelize-typescript';
import { Symbols } from '../ioc/symbols';
import { DBBulkCreateOp, DBCreateOp, DBOp, DBRemoveOp, DBUpdateOp, DBUpsertOp } from '../types/genericTypes';
// import * as squel from 'squel';
// const squelPostgres = squel.useFlavour('postgres');
// squelPostgres.registerValueHandler(Buffer, buffer => {
//  return {
//    formatted: true,
//    value: "E'\\\\x" + buffer.toString('hex') + "'",
//    rawNesting: true,
//  } as any;
// });

//
// const debugWrap = (obj: any, met: string, myRes: string) =>  {
//   const old = obj[met];
//   obj[met] = (...args) => {
//     const origRet = old.apply(obj, args);
//     // console.log(met);
//     if (origRet !== myRes) {
//       console.log('FAIL');
//       console.log(args);
//       console.log(myRes);
//       console.log('----');
//       console.log(origRet);
//       process.exit(1);
//     }
//     obj[met] = old;
//     return origRet;
//   };
// }
@injectable()
export class DBHelper {

  @inject(Symbols.generic.sequelize)
  private sequelize: Sequelize;

  public handleUpdate(updateOp: DBUpdateOp<any>) {
    return this.sequelize.getQueryInterface().QueryGenerator.updateQuery(
      updateOp.model.getTableName(),
      updateOp.values,
      updateOp.options.where,
      updateOp.options
      );
  }

  public handleInsert(insertOp: DBCreateOp<any>) {
    return this.sequelize.getQueryInterface().QueryGenerator.insertQuery(
      insertOp.model.getTableName(),
      insertOp.values,
      insertOp.model.rawAttributes,
      {}
    );
  }

  // public handleBulkInsert(insertOp: DBBulkCreateOp<any>) {
  //  return squelPostgres.insert({ nameQuoteCharacter: '"', autoQuoteTableNames: true, autoQuoteFieldNames:true })
  //    .into(insertOp.model.getTableName() as string)
  //    .setFieldsRows(insertOp.values)
  //    .toString();
  // }

  public handleUpsert(upsertOp: DBUpsertOp<any>) {
    return this.sequelize.getQueryInterface().QueryGenerator.upsertQuery(
      upsertOp.model.getTableName(),
      upsertOp.values,
      upsertOp.values,
      {[Op.or]: [ { [upsertOp.model.primaryKeyAttribute]: upsertOp.values[upsertOp.model.primaryKeyAttribute]} ]},
      upsertOp.model,
      { raw: true }
      // upsertOp.options.wh
    );
  }

  public handleDelete(deleteOp: DBRemoveOp<any>) {
    return this.sequelize.getQueryInterface().QueryGenerator.deleteQuery(
      deleteOp.model.getTableName(),
      deleteOp.options.where,
      {...deleteOp.options, limit: null},
      deleteOp.model
    );
  }
  /**
   * Batches operations together and performs them parallelly (eventually in a transaction)
   * @param {Array<IDBOp<any>>} what
   * @param {sequelize.Transaction} transaction
   * @returns {Promise<[Model<string>[] , any]>}
   */
  public async performOps(what: Array<DBOp<any>>, transaction?: sequelize.Transaction) {
    const baseOptions: any = {raw: true};
    if (transaction) {
      baseOptions.transaction = transaction;
    }
    const ops = [];
    for (const op of what) {
      if (op === null) {
        continue; // Null op.
      }
      switch (op.type) {
        // case 'bulkCreate':
        //  ops.push(this.handleBulkInsert(op));
        //  break;
        case 'create':
          ops.push(this.handleInsert(op));
          // debugWrap(op.model.sequelize.getQueryInterface().QueryGenerator, 'insertQuery', this.handleInsert(op));
          // await op.model.create(op.values, baseOptions);
          break;
        case 'update':
          ops.push(this.handleUpdate(op));
          // debugWrap(op.model.sequelize.getQueryInterface().QueryGenerator, 'updateQuery', this.handleUpdate(op));
          // await op.model.update(op.values, {... baseOptions, ... op.options});
          break;
        case 'upsert':
          ops.push(this.handleUpsert(op));
          // debugWrap(op.model.sequelize.getQueryInterface().QueryGenerator, 'upsertQuery', this.handleUpsert(op));
          // await op.model.upsert(op.values, {... baseOptions, ... op.options});
          break;
        case 'remove':
          ops.push(this.handleDelete(op));
          // debugWrap(op.model.sequelize.getQueryInterface().QueryGenerator, 'deleteQuery', this.handleDelete(op));
          // await op.model.destroy({... baseOptions, ... op.options});
          break;
        case 'custom':
          ops.push(op.query);
          // await op.model.sequelize.query(op.query, baseOptions);
          break;
      }
    }

    await this.sequelize.query(ops.join(';\n'), baseOptions);

  }

}
