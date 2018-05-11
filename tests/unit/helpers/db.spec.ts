import { Model } from 'sequelize-typescript';
import { DBHelper } from '../../../src/helpers/';
import { DBCreateOp, DBUpdateOp } from '../../../src/types/genericTypes';
import { SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import {expect} from 'chai';

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
  before(() => {
    sandbox = sinon.createSandbox();
  });
  beforeEach(() => {
    instance = new DBHelper();
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('performOps', () => {
    it('single op', async () => {
      const stub = sandbox.stub(FakeModel, 'bulkCreate').resolves();
      await instance.performOps([
        {type: 'create', model: FakeModel, values: {test: 'hey'}},
      ]);

      expect(stub.calledOnce).is.true;
      expect(stub.firstCall.args[0]).to.be.deep.eq([{test: 'hey'}]);
    });
    it('should batch same model requests', async () => {
      const stub = sandbox.stub(FakeModel, 'bulkCreate').resolves();
      await instance.performOps([
        {type: 'create', model: FakeModel, values: {test: 'hey'}},
        {type: 'create', model: FakeModel, values: {test: 'brother'}},
      ]);

      expect(stub.calledOnce).is.true;
      expect(stub.firstCall.args[0]).to.be.deep.eq([{test: 'hey'}, {test: 'brother'}]);
    });
    it('should correctly divide requests by model', async () => {
      const stub = sandbox.stub(FakeModel, 'bulkCreate').resolves();
      const stub2 = sandbox.stub(FakeModel2, 'bulkCreate').resolves();
      await instance.performOps([
        {type: 'create', model: FakeModel, values: {test: 'hey'}},
        {type: 'create', model: FakeModel, values: {test: 'brother'}},
        {type: 'create', model: FakeModel2, values: {test2: 'hey2'}},
        {type: 'create', model: FakeModel2, values: {test2: 'brother2'}},
      ]);

      expect(stub.calledOnce).is.true;
      expect(stub2.calledOnce).is.true;
      expect(stub.firstCall.args[0]).to.be.deep.eq([{test: 'hey'}, {test: 'brother'}]);
      expect(stub2.firstCall.args[0]).to.be.deep.eq([{test2: 'hey2'}, {test2: 'brother2'}]);
    });
    it('should create and then update', async () => {
      const stub = sandbox.stub(FakeModel, 'bulkCreate').resolves();
      const stub2 = sandbox.stub(FakeModel2, 'bulkCreate').resolves();
      const updateStub = sandbox.stub(FakeModel, 'update').resolves();
      const updateStub2 = sandbox.stub(FakeModel2, 'update').resolves();
      await instance.performOps([
        {type: 'create', model: FakeModel, values: {test: 'hey'}},
        {type: 'create', model: FakeModel2, values: {test: 'brother'}},
        {type: 'update', model: FakeModel2, values: {test2: 'hey2'}, options: { where: { bit: 'bot'}}},
        {type: 'update', model: FakeModel2, values: {test2: 'brother2'}},
        {type: 'update', model: FakeModel, values: {test: 'brother'}},
      ]);

      expect(stub.calledOnce).is.true;
      expect(stub2.calledOnce).is.true;
      expect(updateStub.calledOnce).is.true;
      expect(updateStub2.callCount).is.eq(2);

      expect(stub.calledBefore(updateStub)).is.true;
      expect(stub2.calledBefore(updateStub2)).is.true;

      // it should also set transaction
      expect(updateStub2.firstCall.args[1]).to.haveOwnProperty('transaction');
      expect(updateStub2.firstCall.args[1]).to.haveOwnProperty('where');

      expect(updateStub2.secondCall.args[1]).to.not.haveOwnProperty('where');
    });
  });
});
