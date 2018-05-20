import { Model } from 'sequelize-typescript';
import { DBHelper } from '../../../src/helpers/';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { expect } from 'chai';
import { DBOp } from '../../../src/types/genericTypes';

// tslint:disable no-unused-expression
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
    instance              = new DBHelper();
    instance['sequelize'] = {
      query() {
      },
      qi: {
        insertQuery() {
        },
        upsertQuery() {
        },
        deleteQuery() {
        },
        updateQuery() {
        },
      },
      getQueryInterface() {
        return { QueryGenerator: this.qi};
      }
    } as any;
    stubQuery             = sandbox.stub(instance['sequelize'], 'query').resolves('yeah');
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('performOps', () => {
    it('create should call handleInsert', async () => {
      const stub     = sandbox.stub(instance, 'handleInsert').returns(':)');
      const op: any  = { type: 'create', model: FakeModel, values: { test: 'hey' } };
      const op2: any = { type: 'create', model: FakeModel, values: { test: 'hey2' } };
      await instance.performOps([op, op2]);
      expect(stub.callCount).is.eq(2);
      expect(stub.firstCall.args[0]).to.be.deep.eq(op);
      expect(stub.secondCall.args[0]).to.be.deep.eq(op2);
      expect(stubQuery.callCount).is.eq(1);
      expect(stubQuery.firstCall.args[0]).to.be.deep.eq(':);\n:)');
    });

    it('update should call handleUpdate', async () => {
      const stub                 = sandbox.stub(instance, 'handleUpdate').returns(':)');
      const op: DBOp<FakeModel>  = { type: 'update', model: FakeModel, values: { test: 'hey' } };
      const op2: DBOp<FakeModel> = { type: 'update', model: FakeModel, values: { test: 'hey2' } };
      await instance.performOps([op, op2]);
      expect(stub.callCount).is.eq(2);
      expect(stub.firstCall.args[0]).to.be.deep.eq(op);
      expect(stub.secondCall.args[0]).to.be.deep.eq(op2);
      expect(stubQuery.callCount).is.eq(1);
      expect(stubQuery.firstCall.args[0]).to.be.deep.eq(':);\n:)');
    });
    it('update should call handleDelete', async () => {
      const stub                 = sandbox.stub(instance, 'handleDelete').returns(':)');
      const op: DBOp<FakeModel>  = { type: 'remove', model: FakeModel, options: { where: { test: 'hey' } } };
      const op2: DBOp<FakeModel> = { type: 'remove', model: FakeModel, options: { where: { test: 'hey2' } } };
      await instance.performOps([op, op2]);
      expect(stub.callCount).is.eq(2);
      expect(stub.firstCall.args[0]).to.be.deep.eq(op);
      expect(stub.secondCall.args[0]).to.be.deep.eq(op2);
      expect(stubQuery.callCount).is.eq(1);
      expect(stubQuery.firstCall.args[0]).to.be.deep.eq(':);\n:)');
    });
    it('update should call handleUpsert', async () => {
      const stub                 = sandbox.stub(instance, 'handleUpsert').returns(':)');
      const op: DBOp<FakeModel>  = { type: 'upsert', model: FakeModel, values: { test: 'hei' } };
      const op2: DBOp<FakeModel> = { type: 'upsert', model: FakeModel, values: { test: 'hei' } };
      await instance.performOps([op, op2]);
      expect(stub.callCount).is.eq(2);
      expect(stub.firstCall.args[0]).to.be.deep.eq(op);
      expect(stub.secondCall.args[0]).to.be.deep.eq(op2);
      expect(stubQuery.callCount).is.eq(1);
      expect(stubQuery.firstCall.args[0]).to.be.deep.eq(':);\n:)');
    });

  });

  it('handleUpdate should call sequelize.querygenerator.updateQuery', () => {
    FakeModel.getTableName = () => 'theTable';
    const stub = sandbox.stub(instance['sequelize']['qi'], 'updateQuery');
    instance.handleUpdate({type: 'update', values: { test: 'hey'}, model: FakeModel, options: {where: {test: 'hAy'}}});

    expect(stub.firstCall.args[0]).to.be.eq('theTable');
    expect(stub.firstCall.args[1]).to.be.deep.eq({test: 'hey'});
    expect(stub.firstCall.args[2]).to.be.deep.eq({test: 'hAy'});
    expect(stub.firstCall.args[3]).to.be.deep.eq({where: {test: 'hAy'}});
  });
  it('handleInsert should call sequelize.querygenerator.insertQuery', () => {
    FakeModel.getTableName = () => 'theTable';
    FakeModel.rawAttributes = {test: 'string'} as any;
    const stub = sandbox.stub(instance['sequelize']['qi'], 'insertQuery');
    instance.handleInsert({type: 'create', model: FakeModel, values: { test: 'hey'}});

    expect(stub.firstCall.args[0]).to.be.eq('theTable');
    expect(stub.firstCall.args[1]).to.be.deep.eq({test: 'hey'});
    expect(stub.firstCall.args[2]).to.be.deep.eq({test: 'string'});
    expect(stub.firstCall.args[3]).to.be.deep.eq({});
  });
  it('handleUpsert should call sequelize.querygenerator.upsertQuery', () => {
    FakeModel.getTableName = () => 'theTable';
    const stub = sandbox.stub(instance['sequelize']['qi'], 'upsertQuery');
    instance.handleUpsert({type: 'upsert', values: { test: 'hey'}, model: FakeModel });

    expect(stub.firstCall.args[0]).to.be.eq('theTable');
    expect(stub.firstCall.args[1]).to.be.deep.eq({test: 'hey'});
    expect(stub.firstCall.args[2]).to.be.deep.eq({test: 'hey'});
    // expect(stub.firstCall.args[3]).to.be.deep.eq({where: {test: 'hAy'}}); // TODO: Check when sinon supports obj with symbol keys
    expect(stub.firstCall.args[4]).to.be.deep.eq(FakeModel);
    expect(stub.firstCall.args[5]).to.be.deep.eq({raw: true});

  });
  it('handleDelete should call sequelize.querygenerator.deleteQuery', () => {
    FakeModel.getTableName = () => 'theTable';
    const stub = sandbox.stub(instance['sequelize']['qi'], 'deleteQuery');
    instance.handleDelete({type: 'delete', values: { test: 'hey'}, model: FakeModel, options: {where: {test: 'hAy'}}});

    expect(stub.firstCall.args[0]).to.be.eq('theTable');
    expect(stub.firstCall.args[1]).to.be.deep.eq({test: 'hAy'});
    expect(stub.firstCall.args[2]).to.be.deep.eq({where: {test: 'hAy'}, limit: null});
    expect(stub.firstCall.args[3]).to.be.deep.eq(FakeModel);

  });
});
