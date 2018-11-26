import {
  DBBulkCreateOp,
  DBCreateOp,
  DBOp,
  DBRemoveOp,
  DBUpdateOp,
  DBUpsertOp,
} from '@risevision/core-types';
import { wait } from '@risevision/core-utils';
import { inject, injectable } from 'inversify';
import * as sequelize from 'sequelize';
import { Op, Sequelize, Transaction } from 'sequelize';
import { Model } from 'sequelize-typescript';
import * as squel from 'squel';
import { ModelSymbols } from './modelSymbols';

const squelPostgres = squel.useFlavour('postgres');
squelPostgres.registerValueHandler(Buffer, (buffer) => {
  return {
    formatted: true,
    rawNesting: true,
    value: "E'\\\\x" + buffer.toString('hex') + "'",
  } as any;
});
squelPostgres.registerValueHandler('bigint', (bi: bigint) => {
  return {
    formatted: true,
    rawNesting: true,
    value: bi.toString(),
  } as any;
});

@injectable()
export class DBHelper {
  @inject(ModelSymbols.sequelize)
  private sequelize: Sequelize;

  public handleUpdate(updateOp: DBUpdateOp<any>) {
    return this.sequelize
      .getQueryInterface()
      .QueryGenerator.updateQuery(
        updateOp.model.getTableName(),
        updateOp.values,
        updateOp.options.where,
        updateOp.options
      );
  }

  public handleInsert(insertOp: DBCreateOp<any>) {
    return this.sequelize
      .getQueryInterface()
      .QueryGenerator.insertQuery(
        insertOp.model.getTableName(),
        insertOp.values,
        insertOp.model.rawAttributes,
        {}
      );
  }

  public handleBulkInsert(insertOp: DBBulkCreateOp<any>) {
    return squelPostgres
      .insert({
        autoQuoteFieldNames: true,
        autoQuoteTableNames: true,
        nameQuoteCharacter: '"',
        stringFormatter: (s) => `'${s}'`,
      })
      .into(insertOp.model.getTableName() as string)
      .setFieldsRows(insertOp.values)
      .toString();
  }

  public handleUpsert(upsertOp: DBUpsertOp<any>) {
    return this.sequelize.getQueryInterface().QueryGenerator.upsertQuery(
      upsertOp.model.getTableName(),
      upsertOp.values,
      upsertOp.values,
      {
        [Op.or]: [
          {
            [upsertOp.model.primaryKeyAttribute]:
              upsertOp.values[upsertOp.model.primaryKeyAttribute],
          },
        ],
      },
      upsertOp.model,
      { raw: true }
      // upsertOp.options.wh
    );
  }

  public handleDelete(deleteOp: DBRemoveOp<any>) {
    return this.sequelize
      .getQueryInterface()
      .QueryGenerator.deleteQuery(
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
  public async performOps(
    what: Array<DBOp<any>>,
    transaction?: sequelize.Transaction
  ) {
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

  public *splitOps(
    what: Array<DBOp<any>>,
    chunkSize: number
  ): Iterator<string> {
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
