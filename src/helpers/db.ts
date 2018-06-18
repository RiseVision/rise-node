import { inject, injectable } from 'inversify';
import * as sequelize from 'sequelize';
import { Op, Sequelize, Transaction } from 'sequelize';
import { Model } from 'sequelize-typescript';
import { Symbols } from '../ioc/symbols';
import { DBBulkCreateOp, DBCreateOp, DBOp, DBRemoveOp, DBUpdateOp, DBUpsertOp } from '../types/genericTypes';
import * as squel from 'squel';
import { wait } from './promiseUtils';

const squelPostgres = squel.useFlavour('postgres');
squelPostgres.registerValueHandler(Buffer, buffer => {
 return {
   formatted: true,
   value: "E'\\\\x" + buffer.toString('hex') + "'",
   rawNesting: true,
 } as any;
});

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

  /**
   * Prepare and return an update query
   * @param {DBUpdateOp<any>} updateOp
   * @returns {string}
   */
  public handleUpdate(updateOp: DBUpdateOp<any>) {
    return this.sequelize.getQueryInterface().QueryGenerator.updateQuery(
      updateOp.model.getTableName(),
      updateOp.values,
      updateOp.options.where,
      updateOp.options
      );
  }

  /**
   * Prepare and return an insert query
   * @param {DBCreateOp<any>} insertOp
   * @returns {string}
   */
  public handleInsert(insertOp: DBCreateOp<any>) {
    return this.sequelize.getQueryInterface().QueryGenerator.insertQuery(
      insertOp.model.getTableName(),
      insertOp.values,
      insertOp.model.rawAttributes,
      {}
    );
  }

  /**
   * Prepare and return a multi-row insert query
   * @param {DBBulkCreateOp<any>} insertOp
   * @returns {string}
   */
  public handleBulkInsert(insertOp: DBBulkCreateOp<any>) {
   return squelPostgres.insert({ nameQuoteCharacter: '"', autoQuoteTableNames: true, autoQuoteFieldNames:true })
     .into(insertOp.model.getTableName() as string)
     .setFieldsRows(insertOp.values)
     .toString();
  }

  /**
   * Prepare and return an update or insert query
   * @param {DBUpsertOp<any>} upsertOp
   * @returns {string}
   */
  public handleUpsert(upsertOp: DBUpsertOp<any>) {
    return this.sequelize.getQueryInterface().QueryGenerator.upsertQuery(
      upsertOp.model.getTableName(),
      upsertOp.values,
      upsertOp.values,
      { [Op.or]: [{ [upsertOp.model.primaryKeyAttribute]: upsertOp.values[upsertOp.model.primaryKeyAttribute] }] },
      upsertOp.model,
      { raw: true }
      // upsertOp.options.wh
    );
  }

  /**
   * Prepare and return a delete query
   * @param {DBRemoveOp<any>} deleteOp
   * @returns {string}
   */
  public handleDelete(deleteOp: DBRemoveOp<any>) {
    return this.sequelize.getQueryInterface().QueryGenerator.deleteQuery(
      deleteOp.model.getTableName(),
      deleteOp.options.where,
      { ...deleteOp.options, limit: null },
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
    const baseOptions: any = { raw: true };
    if (transaction) {
      baseOptions.transaction = transaction;
    }

    const opsToDoIterator = this.splitOps(what, 1010);
    let chunk = opsToDoIterator.next();
    while (!chunk.done) {
      chunk = await (async () => {
        const p = this.sequelize.query(chunk.value, baseOptions);
        const nextChunk = await wait(1).then(() => opsToDoIterator.next());
        return p.then(() => nextChunk);
      })();
    }
    await this.sequelize.query(chunk.value, baseOptions);
  }

  /**
   * Return the given operations as query strings split in chunks
   * @param {Array<DBOp<any>>} what
   * @param {number} chunkSize
   * @returns {Iterator<string>}
   */
  public* splitOps(what: Array<DBOp<any>>, chunkSize: number): Iterator<string> {
    let tempOps = [];
    for (const op of what) {
      if (op === null) {
        continue;
      }
      switch (op.type) {
        case 'bulkCreate':
          tempOps.push(this.handleBulkInsert(op));
          break;
        case 'create':
          tempOps.push(this.handleInsert(op));
          break;
        case 'update':
          tempOps.push(this.handleUpdate(op));
          break;
        case 'upsert':
          tempOps.push(this.handleUpsert(op));
          break;
        case 'remove':
          tempOps.push(this.handleDelete(op));
          break;
        case 'custom':
          tempOps.push(op.query);
          break;
      }
      if (tempOps.length === chunkSize) {
        yield tempOps.join(';');
        tempOps = [];
      }
    }
    return tempOps.join(';');
  }

}
