import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import { p2pSymbols } from '@risevision/core-p2p';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import * as sinon from 'sinon';
import { SinonSandbox, SinonStub } from 'sinon';
import { BlocksModel, BlocksSymbols } from '../../../src';
import { CommonBlockRequest } from '../../../src/p2p';
import { createFakeBlock } from '../utils/createFakeBlocks';

chai.use(chaiAsPromised);

describe('apis/requests/CommonBlockRequest', () => {
  let sandbox: SinonSandbox;
  let container: Container;
  let instance: CommonBlockRequest;
  before(async () => {
    sandbox = sinon.createSandbox();
    container = await createContainer([
      'core-blocks',
      'core-helpers',
      'core-crypto',
      'core',
      'core-accounts',
      'core-transactions',
    ]);
  });
  beforeEach(() => {
    sandbox.restore();
    instance = container.getNamed(
      p2pSymbols.transportMethod,
      BlocksSymbols.p2p.commonBlocks
    );
  });

  describe('in/out', () => {
    let sequelizeQueryStub: SinonStub;
    beforeEach(() => {
      const BM = container.getNamed<typeof BlocksModel>(
        ModelSymbols.model,
        BlocksSymbols.model
      );

      sequelizeQueryStub = sandbox.stub(BM.sequelize, 'query');
    });

    async function createRequest(query: any, body: any = null) {
      const resp = await instance.handleRequest(body, query);
      return instance.handleResponse(null, resp);
    }

    it('should fail if request is invalid', async () => {
      await expect(createRequest({ ids: null })).rejectedWith(
        'query/ids - Expected type'
      );
      await expect(createRequest({})).rejectedWith(
        'query - Missing required property'
      );
      await expect(createRequest({ ids: 'a,b' })).rejectedWith(
        'Invalid block id sequence'
      );
      await expect(createRequest({ ids: '' })).rejectedWith(
        'Invalid block id sequence'
      );
      await expect(
        createRequest({ ids: '1,2,3,4,5,6,7,8,9,0,1' })
      ).rejectedWith('Invalid block id sequence');
    });
    it('should return common: null and properly call database', async () => {
      sequelizeQueryStub.resolves(null);
      const res = await createRequest({ ids: '1,2,3' });
      expect(res).deep.eq({ common: null });
      expect(sequelizeQueryStub.calledOnce).is.true;
      expect(sequelizeQueryStub.firstCall.args[1].where).contain(
        "IN ('1', '2', '3')"
      );
      expect(sequelizeQueryStub.firstCall.args[1].limit).eq(1);
      expect(sequelizeQueryStub.firstCall.args[0]).contain(
        'ORDER BY "BlocksModel"."height" DESC'
      );
    });
    it('should return proper encoded data', async () => {
      const block = createFakeBlock(container);
      sequelizeQueryStub.resolves(block);
      const res = await createRequest({ ids: '1,2,3' });
      expect(res).deep.eq({ common: { ...block, relays: 1 } });
    });
  });
});
