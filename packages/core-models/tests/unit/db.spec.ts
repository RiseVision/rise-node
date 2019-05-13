import { DBOp, DBUpdateOp } from '@risevision/core-types';
import { expect } from 'chai';
import { Model } from 'sequelize-typescript';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { DBHelper } from '../../src';

// tslint:disable no-unused-expression max-classes-per-file object-literal-sort-keys
describe('helpers/db', () => {
  class FakeModel extends Model<FakeModel> {
    public test: string;
  }

  class FakeModel2 extends Model<FakeModel2> {
    public test2: string;
  }

  let instance: DBHelper;
  let sandbox: SinonSandbox;
  let stubQuery: SinonStub;
  before(() => {
    sandbox = sinon.createSandbox();
  });
  beforeEach(() => {
    instance = new DBHelper();
    // @ts-ignore
    // tslint:disable no-empty
    instance.sequelize = {
      query() {},
      qi: {
        insertQuery() {},
        upsertQuery() {},
        deleteQuery() {},
        updateQuery() {},
      },
      getQueryInterface() {
        return { QueryGenerator: this.qi };
      },
    } as any;
    instance.postConstruct();
    // tslint:enable  no-empty
    // @ts-ignore
    stubQuery = sandbox.stub(instance.sequelize, 'query').resolves('yeah');
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('performOps', () => {
    it('create should call handleInsert', async () => {
      const stub = sandbox.stub(instance, 'handleInsert').returns(':)');
      const op: any = {
        type: 'create',
        model: FakeModel,
        values: { test: 'hey' },
      };
      const op2: any = {
        type: 'create',
        model: FakeModel,
        values: { test: 'hey2' },
      };
      await instance.performOps([op, op2]);
      expect(stub.callCount).is.eq(2);
      expect(stub.firstCall.args[0]).to.be.deep.eq(op);
      expect(stub.secondCall.args[0]).to.be.deep.eq(op2);
      expect(stubQuery.callCount).is.eq(1);
      expect(stubQuery.firstCall.args[0]).to.be.deep.eq(':);:)');
    });

    it('update should call handleUpdate', async () => {
      const stub = sandbox.stub(instance, 'handleUpdate').returns(':)');
      const op: DBUpdateOp<FakeModel> = {
        type: 'update',
        model: FakeModel,
        values: { test: 'hey' },
        options: null,
      };
      const op2: DBUpdateOp<FakeModel> = {
        type: 'update',
        model: FakeModel,
        values: { test: 'hey2' },
        options: null,
      };
      await instance.performOps([op, op2]);
      expect(stub.callCount).is.eq(2);
      expect(stub.firstCall.args[0]).to.be.deep.eq(op);
      expect(stub.secondCall.args[0]).to.be.deep.eq(op2);
      expect(stubQuery.callCount).is.eq(1);
      expect(stubQuery.firstCall.args[0]).to.be.deep.eq(':);:)');
    });
    it('update should call handleDelete', async () => {
      const stub = sandbox.stub(instance, 'handleDelete').returns(':)');
      const op: DBOp<FakeModel> = {
        type: 'remove',
        model: FakeModel,
        options: { where: { test: 'hey' } },
      };
      const op2: DBOp<FakeModel> = {
        type: 'remove',
        model: FakeModel,
        options: { where: { test: 'hey2' } },
      };
      await instance.performOps([op, op2]);
      expect(stub.callCount).is.eq(2);
      expect(stub.firstCall.args[0]).to.be.deep.eq(op);
      expect(stub.secondCall.args[0]).to.be.deep.eq(op2);
      expect(stubQuery.callCount).is.eq(1);
      expect(stubQuery.firstCall.args[0]).to.be.deep.eq(':);:)');
    });
    it('update should call handleUpsert', async () => {
      const stub = sandbox.stub(instance, 'handleUpsert').returns(':)');
      const op: DBOp<FakeModel> = {
        type: 'upsert',
        model: FakeModel,
        values: { test: 'hei' },
      };
      const op2: DBOp<FakeModel> = {
        type: 'upsert',
        model: FakeModel,
        values: { test: 'hei' },
      };
      await instance.performOps([op, op2]);
      expect(stub.callCount).is.eq(2);
      expect(stub.firstCall.args[0]).to.be.deep.eq(op);
      expect(stub.secondCall.args[0]).to.be.deep.eq(op2);
      expect(stubQuery.callCount).is.eq(1);
      expect(stubQuery.firstCall.args[0]).to.be.deep.eq(':);:)');
    });
  });

  it('handleUpdate should call sequelize.querygenerator.updateQuery', () => {
    FakeModel.getTableName = () => 'theTable';
    // @ts-ignore
    const stub = sandbox
      .stub((instance as any).sequelize.qi, 'updateQuery')
      .returns({ query: 'query', bind: null });
    instance.handleUpdate({
      type: 'update',
      values: { test: 'hey' } as any,
      model: FakeModel,
      options: { where: { test: 'hAy' } },
    });

    expect(stub.firstCall.args[0]).to.be.eq('theTable');
    expect(stub.firstCall.args[1]).to.be.deep.eq({ test: 'hey' });
    expect(stub.firstCall.args[2]).to.be.deep.eq({ test: 'hAy' });
    expect(stub.firstCall.args[3]).to.be.deep.eq({ where: { test: 'hAy' } });
  });
  it('handleInsert should call sequelize.querygenerator.insertQuery', () => {
    FakeModel.getTableName = () => 'theTable';
    (FakeModel as any).rawAttributes = { test: 'string' } as any;
    const stub = sandbox
      .stub((instance as any).sequelize.qi, 'insertQuery')
      .returns({ query: 'query', bind: null });
    instance.handleInsert({
      type: 'create',
      model: FakeModel,
      values: { test: 'hey' } as any,
    });

    expect(stub.firstCall.args[0]).to.be.eq('theTable');
    expect(stub.firstCall.args[1]).to.be.deep.eq({ test: 'hey' });
    expect(stub.firstCall.args[2]).to.be.deep.eq({ test: 'string' });
    expect(stub.firstCall.args[3]).to.be.deep.eq({});
  });
  it('handleUpsert should call sequelize.querygenerator.upsertQuery', () => {
    FakeModel.getTableName = () => 'theTable';
    const stub = sandbox
      .stub((instance as any).sequelize.qi, 'upsertQuery')
      .returns({ query: 'query', bind: null });
    instance.handleUpsert({
      type: 'upsert',
      values: { test: 'hey' } as any,
      model: FakeModel,
    });

    expect(stub.firstCall.args[0]).to.be.eq('theTable');
    expect(stub.firstCall.args[1]).to.be.deep.eq({ test: 'hey' });
    expect(stub.firstCall.args[2]).to.be.deep.eq({ test: 'hey' });
    expect(stub.firstCall.args[4]).to.be.deep.eq(FakeModel);
    expect(stub.firstCall.args[5]).to.be.deep.eq({ raw: true });
  });
  it('handleDelete should call sequelize.querygenerator.deleteQuery', () => {
    FakeModel.getTableName = () => 'theTable';
    const stub = sandbox
      // @ts-ignore
      .stub(instance.sequelize.qi, 'deleteQuery')
      .returns({ query: 'query', bind: null });
    instance.handleDelete({
      type: 'remove',
      model: FakeModel,
      options: { where: { test: 'hAy' } },
    });

    expect(stub.firstCall.args[0]).to.be.eq('theTable');
    expect(stub.firstCall.args[1]).to.be.deep.eq({ test: 'hAy' });
    expect(stub.firstCall.args[2]).to.be.deep.eq({
      where: { test: 'hAy' },
      limit: null,
    });
    expect(stub.firstCall.args[3]).to.be.deep.eq(FakeModel);
  });
});
