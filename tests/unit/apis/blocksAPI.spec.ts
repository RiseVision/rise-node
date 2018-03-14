import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { Container } from 'inversify';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { AccountsAPI } from '../../../src/apis/accountsAPI';
import { BlocksAPI } from '../../../src/apis/blocksAPI';
import { Symbols } from '../../../src/ioc/symbols';
import {
  BlockRewardLogicStub, BlocksModuleStub, DbStub, SequenceStub, SystemModuleStub, ZSchemaStub,
} from '../../stubs';
import { createContainer } from '../../utils/containerCreator';
import { BlockLogicStub } from '../../stubs/logic/BlockLogicStub';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length

describe('apis/accountsAPI', () => {

  let sandbox: SinonSandbox;
  let instance: AccountsAPI;
  let container: Container;
  let schema: ZSchemaStub;
  let db: SequenceStub;
  let dbSequence: DbStub;
  let blockRewardLogic: BlockRewardLogicStub;
  let blockLogic: BlockLogicStub;
  let blocksModule: BlocksModuleStub;
  let systemModule: SystemModuleStub;
  let constants: any;

  beforeEach(() => {
    sandbox   = sinon.sandbox.create();
    container = createContainer();
    container.bind(Symbols.api.blocks).to(BlocksAPI);

    schema           = container.get(Symbols.generic.zschema);
    db               = container.get(Symbols.generic.db);
    constants        = container.get(Symbols.helpers.constants);
    dbSequence       = container.getTagged(Symbols.helpers.sequence,
      Symbols.helpers.sequence, Symbols.tags.helpers.dbSequence);
    blockRewardLogic = container.get(Symbols.logic.blockReward);
    blockLogic       = container.get(Symbols.logic.block);
    blocksModule     = container.get(Symbols.modules.blocks);
    systemModule     = container.get(Symbols.modules.system);

    instance                    = container.get(Symbols.api.blocks);
    (instance as  any).sequence = {
      addAndPromise: sandbox.spy((w) => Promise.resolve(w())),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getBlocks', () => {
  });

  describe('getBlock', () => {
  });

  describe('getHeight', () => {
  });

  describe('getBroadHash', () => {
  });

  describe('getEpoch', () => {
  });

  describe('getFee', () => {
  });

  describe('getFees', () => {
  });

  describe('getNethash', () => {
  });

  describe('getMilestone', () => {
  });

  describe('getReward', () => {
  });

  describe('getSupply', () => {
  });

  describe('getStatus', () => {
  });

  describe('list', () => {
  });

});
