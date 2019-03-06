import { APISymbols } from '@risevision/core-apis';
import { createContainer } from '@risevision/core-launchpad/tests/unit/utils/createContainer';
import { ModelSymbols } from '@risevision/core-models';
import {
  IAccountsModule,
  IBlocksModel,
  IBlocksModule,
  ICrypto,
  ISystemModule,
  Symbols,
} from '@risevision/core-types';
import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { RiseV2 } from 'dpos-offline';
import * as filterObject from 'filter-object';
import { Container } from 'inversify';
import { SinonSandbox, SinonStub } from 'sinon';
import * as sinon from 'sinon';
import { DelegatesAPI } from '../../../src/apis';
import { dPoSSymbols, Slots } from '../../../src/helpers';
import {
  Accounts2DelegatesModel,
  AccountsModelForDPOS,
} from '../../../src/models';
import { DelegatesModule, ForgeModule } from '../../../src/modules';

chai.use(chaiAsPromised);

// tslint:disable no-shadowed-variable no-unused-expression no-big-function object-literal-sort-keys no-identical-functions max-line-length
describe('apis/delegatesAPI', () => {
  // TODO: move all this to proper integration tests.
  // let sandbox: SinonSandbox;
  // let container: Container;
  // let instance: DelegatesAPI;
  // let blocksModel: typeof IBlocksModel;
  // let accounts: IAccountsModule;
  // let blocks: IBlocksModule;
  // let delegatesModule: DelegatesModule;
  // let ed: ICrypto;
  // let forgeModule: ForgeModule;
  // let slots: Slots;
  // let system: ISystemModule;
  // let accountsModel: typeof AccountsModelForDPOS;
  // let accounts2delegatesModel: typeof Accounts2DelegatesModel;
  // before(async () => {
  //   container = await createContainer([
  //     'core-consensus-dpos',
  //     'core-helpers',
  //     'core-crypto',
  //     'core',
  //   ]);
  // });
  // beforeEach(async () => {
  //   sandbox = sinon.createSandbox();
  //   accounts = container.get(Symbols.modules.accounts);
  //   accountsModel = container.getNamed(
  //     ModelSymbols.model,
  //     Symbols.models.accounts
  //   );
  //   blocksModel = container.getNamed(ModelSymbols.model, Symbols.models.blocks);
  //   blocks = container.get(Symbols.modules.blocks);
  //   delegatesModule = container.get(dPoSSymbols.modules.delegates);
  //   ed = container.get(Symbols.generic.crypto);
  //   forgeModule = container.get(dPoSSymbols.modules.forge);
  //   slots = container.get(dPoSSymbols.helpers.slots);
  //   system = container.get(Symbols.modules.system);
  //   accounts2delegatesModel = container.getNamed(
  //     ModelSymbols.model,
  //     dPoSSymbols.models.accounts2Delegates
  //   );
  //   instance = container.getNamed(APISymbols.class, dPoSSymbols.delegatesAPI);
  // });
  //
  // afterEach(() => {
  //   sandbox.restore();
  // });
  //
  // describe('getDelegates', () => {
  //   const extraAccountData = {
  //     approval: undefined,
  //     address: null,
  //     missedblocks: undefined,
  //     producedblocks: undefined,
  //     productivity: undefined,
  //     username: undefined,
  //     vote: '0',
  //   };
  //   let data;
  //   let d;
  //   let getDelegatesStub: SinonStub;
  //
  //   // helper to set a returned object with delegates from elegatesModule.getDelegates method
  //   const setReturnedDelegates = (
  //     sortField,
  //     sortMethod,
  //     areNumberValues = true,
  //     limit = 3,
  //     offset = 0
  //   ) => {
  //     let field;
  //     if (sortField) {
  //       field = sortField;
  //     } else {
  //       field = 'f';
  //     }
  //
  //     const delegates = [
  //       {
  //         delegate: new accountsModel({
  //           forgingPK: Buffer.from('aa', 'hex'),
  //           cmb: 0,
  //           [field]: areNumberValues ? 1 : 'a',
  //         }),
  //         info: { rank: 1, [field]: areNumberValues ? 1 : 'a' },
  //       },
  //       {
  //         delegate: new accountsModel({
  //           forgingPK: Buffer.from('bb', 'hex'),
  //           cmb: 0,
  //           [field]: areNumberValues ? 3 : 'bb',
  //         }),
  //         info: { rank: 2, [field]: areNumberValues ? 3 : 'bb' },
  //       },
  //       {
  //         delegate: new accountsModel({
  //           forgingPK: Buffer.from('cc', 'hex'),
  //           cmb: 0,
  //           [field]: areNumberValues ? 2 : 'ccc',
  //         }),
  //         info: { rank: 3, [field]: areNumberValues ? 2 : 'ccc' },
  //       },
  //     ];
  //
  //     d = {
  //       count: delegates.length,
  //       delegates,
  //       limit,
  //       offset,
  //       sortField,
  //       sortMethod,
  //     };
  //
  //     getDelegatesStub = sandbox
  //       .stub(delegatesModule, 'getDelegates')
  //       .resolves(d);
  //   };
  //
  //   beforeEach(() => {
  //     data = {
  //       limit: '10',
  //       offset: '1',
  //       orderBy: 'rank:desc',
  //     };
  //   });
  //
  //   it('should call delegatesModule.getDelegates', async () => {
  //     setReturnedDelegates('approval', 'ASC');
  //     await instance.getDelegates(data);
  //
  //     expect(getDelegatesStub.calledOnce).to.be.true;
  //     expect(getDelegatesStub.firstCall.args.length).to.be.equal(1);
  //     expect(getDelegatesStub.firstCall.args[0]).to.be.deep.equal(data);
  //   });
  //
  //   describe('sorting', () => {
  //     it('sortField === approval, sortMethod === ASC', async () => {
  //       setReturnedDelegates('approval', 'ASC', true);
  //       const ret = await instance.getDelegates(data);
  //
  //       expect(ret.delegates).to.be.deep.equal([
  //         {
  //           ...extraAccountData,
  //           approval: 1,
  //           cmb: 0,
  //           rank: 1,
  //           rate: 1,
  //           publicKey: 'aa',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           approval: 2,
  //           cmb: 0,
  //           rank: 3,
  //           rate: 3,
  //           publicKey: 'cc',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           approval: 3,
  //           cmb: 0,
  //           rank: 2,
  //           rate: 2,
  //           publicKey: 'bb',
  //           votesWeight: undefined,
  //         },
  //       ]);
  //     });
  //
  //     it('sortField === approval, sortMethod !== ASC', async () => {
  //       setReturnedDelegates('approval', 'DESC', true);
  //       const ret = await instance.getDelegates(data);
  //
  //       expect(ret.delegates).to.be.deep.equal([
  //         {
  //           ...extraAccountData,
  //           approval: 3,
  //           cmb: 0,
  //           rank: 2,
  //           rate: 2,
  //           publicKey: 'bb',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           approval: 2,
  //           cmb: 0,
  //           rank: 3,
  //           rate: 3,
  //           publicKey: 'cc',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           approval: 1,
  //           cmb: 0,
  //           rank: 1,
  //           rate: 1,
  //           publicKey: 'aa',
  //           votesWeight: undefined,
  //         },
  //       ]);
  //     });
  //
  //     it('sortField === username, sortMethod === ASC', async () => {
  //       setReturnedDelegates('username', 'ASC', false);
  //       const ret = await instance.getDelegates(data);
  //
  //       expect(ret.delegates).to.be.deep.equal([
  //         {
  //           ...extraAccountData,
  //           username: 'a',
  //           cmb: 0,
  //           rank: 1,
  //           rate: 1,
  //           publicKey: 'aa',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           username: 'bb',
  //           cmb: 0,
  //           rank: 2,
  //           rate: 2,
  //           publicKey: 'bb',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           username: 'ccc',
  //           cmb: 0,
  //           rank: 3,
  //           rate: 3,
  //           publicKey: 'cc',
  //           votesWeight: undefined,
  //         },
  //       ]);
  //     });
  //
  //     it('sortField === username, sortMethod !== ASC', async () => {
  //       setReturnedDelegates('username', 'DESC', false);
  //       const ret = await instance.getDelegates(data);
  //
  //       expect(ret.delegates).to.be.deep.equal([
  //         {
  //           ...extraAccountData,
  //           username: 'ccc',
  //           cmb: 0,
  //           rank: 3,
  //           rate: 3,
  //           publicKey: 'cc',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           username: 'bb',
  //           cmb: 0,
  //           rank: 2,
  //           rate: 2,
  //           publicKey: 'bb',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           username: 'a',
  //           cmb: 0,
  //           rank: 1,
  //           rate: 1,
  //           publicKey: 'aa',
  //           votesWeight: undefined,
  //         },
  //       ]);
  //     });
  //
  //     it('sortField state is null', async () => {
  //       setReturnedDelegates(null, 'DESC', true);
  //       const ret = await instance.getDelegates(data);
  //
  //       expect(ret.delegates).to.be.deep.equal([
  //         {
  //           ...extraAccountData,
  //           cmb: 0,
  //           rank: 1,
  //           rate: 1,
  //           publicKey: 'aa',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           cmb: 0,
  //           rank: 2,
  //           rate: 2,
  //           publicKey: 'bb',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           cmb: 0,
  //           rank: 3,
  //           rate: 3,
  //           publicKey: 'cc',
  //           votesWeight: undefined,
  //         },
  //       ]);
  //     });
  //
  //     it('sortField state is not to same the allowed fields', async () => {
  //       setReturnedDelegates('NICKBORSUK', 'DESC', true);
  //       const ret = await instance.getDelegates(data);
  //
  //       expect(ret.delegates).to.be.deep.equal([
  //         {
  //           ...extraAccountData,
  //           cmb: 0,
  //           rank: 1,
  //           rate: 1,
  //           publicKey: 'aa',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           cmb: 0,
  //           rank: 2,
  //           rate: 2,
  //           publicKey: 'bb',
  //           votesWeight: undefined,
  //         },
  //         {
  //           ...extraAccountData,
  //           cmb: 0,
  //           rank: 3,
  //           rate: 3,
  //           publicKey: 'cc',
  //           votesWeight: undefined,
  //         },
  //       ]);
  //     });
  //   });
  //
  //   it('check slice array by offset', async () => {
  //     setReturnedDelegates('approval', 'ASC', true, undefined, 2);
  //     const ret = await instance.getDelegates(data);
  //
  //     expect(
  //       ret.delegates.map((d) => filterObject(d, ['approval', 'rank', 'rate']))
  //     ).to.be.deep.equal([{ approval: 3, rank: 2, rate: 2 }]);
  //   });
  //
  //   it('check slice array by limit', async () => {
  //     setReturnedDelegates('approval', 'ASC', true, 1);
  //     const ret = await instance.getDelegates(data);
  //
  //     expect(
  //       ret.delegates.map((d) => filterObject(d, ['approval', 'rank', 'rate']))
  //     ).to.be.deep.equal([{ approval: 1, rank: 1, rate: 1 }]);
  //   });
  //
  //   it('should return an object with a delegates array and a totalCount', async () => {
  //     setReturnedDelegates('approval', 'ASC');
  //     const ret = await instance.getDelegates(data);
  //
  //     expect(
  //       ret.delegates.map((d) => filterObject(d, ['approval', 'rank', 'rate']))
  //     ).to.be.deep.equal([
  //       { approval: 1, rank: 1, rate: 1 },
  //       { approval: 2, rank: 3, rate: 3 },
  //       { approval: 3, rank: 2, rate: 2 },
  //     ]);
  //     expect(ret.totalCount).to.be.deep.eq(3);
  //   });
  // });
  //
  // describe('getFee', () => {
  //   let params;
  //   let f;
  //   let getFeesStub: SinonStub;
  //   beforeEach(() => {
  //     params = { height: 1 };
  //     f = { fees: { delegate: 'delegate' }, otherField: 'KNOCK' };
  //
  //     getFeesStub = sandbox.stub(system, 'getFees').returns(f);
  //   });
  //
  //   it('should call system.getFees', async () => {
  //     await instance.getFee(params);
  //
  //     expect(getFeesStub.calledOnce).to.be.true;
  //     expect(getFeesStub.firstCall.args.length).to.be.equal(1);
  //     expect(getFeesStub.firstCall.args[0]).to.be.equal(1);
  //   });
  //
  //   it('should delete field fees from f', async () => {
  //     await instance.getFee(params);
  //
  //     expect(f).to.not.have.property('fees');
  //   });
  //
  //   it('should return an object with the properties fee and otherField', async () => {
  //     const ret = await instance.getFee(params);
  //
  //     expect(ret).to.be.deep.equal({
  //       fee: 'delegate',
  //       otherField: 'KNOCK',
  //     });
  //   });
  // });
  //
  // describe('getDelegate', () => {
  //   let params;
  //   let delegates;
  //   let getDelegatesStub: SinonStub;
  //   beforeEach(() => {
  //     params = {
  //       publicKey: RiseV2.deriveKeypair('meow').publicKey.toString('hex'),
  //       username: 'username',
  //     };
  //     delegates = [
  //       {
  //         delegate: new accountsModel({
  //           forgingPK: Buffer.from('aaaa', 'hex'),
  //           username: 'username',
  //         }),
  //         info: {
  //           rank: 1,
  //           approval: 1,
  //           productivity: 100,
  //         },
  //       },
  //       {
  //         delegate: new accountsModel({
  //           forgingPK: Buffer.from('1111', 'hex'),
  //           username: '222',
  //         }),
  //         info: {
  //           rank: 2,
  //           approval: 1,
  //           productivity: 100,
  //         },
  //       },
  //     ];
  //     getDelegatesStub = sandbox
  //       .stub(delegatesModule, 'getDelegates')
  //       .resolves({ delegates });
  //   });
  //
  //   it('should call delegatesModule.getDelegates', async () => {
  //     await instance.getDelegate(params);
  //     expect(getDelegatesStub.calledOnce).to.be.true;
  //     expect(getDelegatesStub.firstCall.args.length).to.be.equal(1);
  //     expect(getDelegatesStub.firstCall.args[0]).to.be.deep.equal({
  //       orderBy: 'username:asc',
  //     });
  //   });
  //
  //   it('should return an object with the property: delegate', async () => {
  //     const ret = await instance.getDelegate(params);
  //     const expected = {
  //       delegate: {
  //         ...delegates[0].delegate.toPOJO(),
  //         ...delegates[0].info,
  //         rate: delegates[0].info.rank,
  //       },
  //     };
  //     delete expected.delegate.secondPublicKey;
  //     expect(ret).to.be.deep.equal(expected);
  //   });
  //
  //   it('should throw error if no delegate matches found', async () => {
  //     getDelegatesStub.resolves({ delegates: [] });
  //
  //     await expect(instance.getDelegate(params)).to.be.rejectedWith(
  //       'Delegate not found'
  //     );
  //   });
  // });
  //
  // describe('getVoters', () => {
  //   let row;
  //   let accountsObject;
  //   let findAll: SinonStub;
  //   let getAccountsStub;
  //   beforeEach(() => {
  //     row = { accountIds: [{}] };
  //     accountsObject = {};
  //     findAll = sandbox.stub(accounts2delegatesModel, 'findAll').resolves([]);
  //     getAccountsStub = sandbox.stub(accounts, 'getAccounts').resolves([]);
  //   });
  //
  //   it('should correctly query Accounts2DelegatesModel', async () => {
  //     await instance.getVoters({
  //       username: 'meow',
  //     });
  //     expect(findAll.firstCall.args[0]).to.be.deep.eq({
  //       attributes: ['accountId'],
  //       where: {
  //         username: 'meow',
  //       },
  //     });
  //   });
  //   it('should correctly query accountsModule.getAccounts', async () => {
  //     findAll.resolves([{ address: '1' }, { address: '2' }]);
  //     getAccountsStub.resolves([new accountsModel(), new accountsModel()]);
  //     await instance.getVoters({
  //       username: 'meow',
  //     });
  //     expect(getAccountsStub.firstCall.args[0]).to.be.deep.eq({
  //       sort: { balance: -1 },
  //       address: { $in: ['1', '2'] },
  //     });
  //   });
  //
  //   it('should return subset of accounts infos', async () => {
  //     getAccountsStub.resolves([
  //       new accountsModel({
  //         address: '1',
  //         forgingPK: Buffer.from('aa', 'hex'),
  //       }),
  //       new accountsModel({
  //         address: '2',
  //         forgingPK: Buffer.from('bb', 'hex'),
  //       }),
  //     ]);
  //     const res = await instance.getVoters({ username: 'meow' });
  //     expect(res).to.be.deep.eq({
  //       accounts: [{ address: '1' }, { address: '2' }],
  //     });
  //   });
  // });
  //
  // describe('search', () => {
  //   let params;
  //   let orderBy;
  //   let query: SinonStub;
  //
  //   beforeEach(() => {
  //     orderBy = {
  //       sortField: 'sortField',
  //       sortMethod: 'sortMethod',
  //     };
  //     params = {
  //       limit: 5,
  //       orderBy: 'username',
  //       q: 'query',
  //     };
  //
  //     query = sandbox.stub(accountsModel.sequelize, 'query').resolves([]);
  //   });
  //   it('should query by name', async () => {
  //     await instance.search({ q: 'vek' });
  //     expect(query.firstCall.args[0]).to.be.deep.eq(`
  //   WITH
  //     supply AS (SELECT calcSupply((SELECT height FROM blocks ORDER BY height DESC LIMIT 1))::numeric),
  //     delegates AS (SELECT row_number() OVER (ORDER BY vote DESC, m."publicKey" ASC)::int AS rank,
  //       m.username,
  //       m.address,
  //       m."forgingPK",
  //       m.vote,
  //       m.producedblocks,
  //       m.missedblocks,
  //       ROUND(vote / (SELECT * FROM supply) * 100, 2)::float AS approval,
  //       (CASE WHEN producedblocks + missedblocks = 0 THEN 0.00 ELSE
  //       ROUND(100 - (missedblocks::numeric / (producedblocks + missedblocks) * 100), 2)
  //       END)::float AS productivity,
  //       COALESCE(v.voters_cnt, 0) AS voters_cnt,
  //       t.timestamp AS register_timestamp
  //       FROM delegates d
  //       LEFT JOIN mem_accounts m ON d.username = m.username
  //       LEFT JOIN trs t ON d."transactionId" = t.id
  //       LEFT JOIN (SELECT "dependentId", COUNT(1)::int AS voters_cnt from mem_accounts2delegates GROUP BY "dependentId") v ON v."dependentId" = ENCODE(m."publicKey", 'hex')
  //       WHERE m."isDelegate" = 1
  //       ORDER BY "username" ASC)
  //     SELECT * FROM delegates WHERE username LIKE '%vek%' LIMIT 101
  //   `);
  //   });
  //   it('should honorate also limit and orderBy with a SQL injection test', async () => {
  //     await instance.search({
  //       q: "1' or '1=1",
  //       orderBy: 'username:desc',
  //       limit: 10,
  //     });
  //     expect(query.firstCall.args[0]).to.be.deep.eq(`
  //   WITH
  //     supply AS (SELECT calcSupply((SELECT height FROM blocks ORDER BY height DESC LIMIT 1))::numeric),
  //     delegates AS (SELECT row_number() OVER (ORDER BY vote DESC, m."publicKey" ASC)::int AS rank,
  //       m.username,
  //       m.address,
  //       m."forgingPK",
  //       m.vote,
  //       m.producedblocks,
  //       m.missedblocks,
  //       ROUND(vote / (SELECT * FROM supply) * 100, 2)::float AS approval,
  //       (CASE WHEN producedblocks + missedblocks = 0 THEN 0.00 ELSE
  //       ROUND(100 - (missedblocks::numeric / (producedblocks + missedblocks) * 100), 2)
  //       END)::float AS productivity,
  //       COALESCE(v.voters_cnt, 0) AS voters_cnt,
  //       t.timestamp AS register_timestamp
  //       FROM delegates d
  //       LEFT JOIN mem_accounts m ON d.username = m.username
  //       LEFT JOIN trs t ON d."transactionId" = t.id
  //       LEFT JOIN (SELECT "dependentId", COUNT(1)::int AS voters_cnt from mem_accounts2delegates GROUP BY "dependentId") v ON v."dependentId" = ENCODE(m."publicKey", 'hex')
  //       WHERE m."isDelegate" = 1
  //       ORDER BY "username" desc)
  //     SELECT * FROM delegates WHERE username LIKE '%1'' or ''1=1%' LIMIT 10
  //   `);
  //   });
  // });
  //
  // describe('count', () => {
  //   it('should call model.count', async () => {
  //     const stub = sandbox.stub(accounts2delegatesModel, 'count').resolves(1);
  //     const res = await instance.count();
  //     expect(res).to.be.deep.eq({ count: 1 });
  //     expect(stub.called).is.true;
  //   });
  // });
  //
  // describe('getNextForgers', () => {
  //   let limit;
  //   let activeDelegates;
  //   let currentSlot;
  //   let currentBlockSlot;
  //   let getSlotNumberStub: SinonStub;
  //   let generateDelegateListStub: SinonStub;
  //
  //   beforeEach(() => {
  //     limit = 3;
  //     activeDelegates = [
  //       Buffer.from('aa', 'hex'),
  //       Buffer.from('bb', 'hex'),
  //       Buffer.from('cc', 'hex'),
  //     ];
  //     currentSlot = 1;
  //     currentBlockSlot = 1;
  //     (blocks as any).lastBlock = new blocksModel({
  //       height: 5,
  //       timestamp: 2,
  //       reward: 0n,
  //       totalAmount: 0n,
  //       totalFee: 0n,
  //       generatorPublicKey: Buffer.from('aa', 'utf8'),
  //       payloadHash: Buffer.from('aa', 'utf8'),
  //       blockSignature: Buffer.from('aa', 'utf8'),
  //     });
  //
  //     generateDelegateListStub = sandbox
  //       .stub(delegatesModule, 'generateDelegateList')
  //       .resolves(activeDelegates);
  //     getSlotNumberStub = sandbox
  //       .stub(slots, 'getSlotNumber')
  //       .onFirstCall()
  //       .returns(currentSlot);
  //     getSlotNumberStub.onSecondCall().returns(currentBlockSlot);
  //   });
  //
  //   it('should call delegatesModule.generateDelegateList', async () => {
  //     await instance.getNextForgers(limit);
  //
  //     expect(generateDelegateListStub.calledOnce).to.be.true;
  //     expect(generateDelegateListStub.firstCall.args.length).to.be.equal(1);
  //     expect(generateDelegateListStub.firstCall.args[0]).to.be.equal(
  //       blocks.lastBlock.height
  //     );
  //   });
  //
  //   it('should call slots.getSlotNumber twice', async () => {
  //     await instance.getNextForgers(limit);
  //
  //     expect(getSlotNumberStub.calledTwice).to.be.true;
  //
  //     expect(getSlotNumberStub.firstCall.args.length).to.be.equal(1);
  //     expect(getSlotNumberStub.firstCall.args[0]).to.be.equal(
  //       blocks.lastBlock.timestamp
  //     );
  //
  //     expect(getSlotNumberStub.secondCall.args.length).to.be.equal(0);
  //   });
  //
  //   it('should return an object with the properties: currentBlock, currentBlockSlot, currentSlot and delegates', async () => {
  //     const ret = await instance.getNextForgers(limit);
  //
  //     expect(ret).to.be.deep.equal({
  //       currentBlock: blocksModel.toStringBlockType((blocks as any).lastBlock),
  //       currentBlockSlot: 1,
  //       currentSlot: 1,
  //       delegates: ['cc'],
  //     });
  //   });
  //
  //   it('should return empty delegates array if limit = 0', async () => {
  //     limit = 0;
  //     const ret = await instance.getNextForgers(limit);
  //
  //     expect(ret).to.be.deep.equal({
  //       currentBlock: blocksModel.toStringBlockType((blocks as any).lastBlock),
  //       currentBlockSlot: 1,
  //       currentSlot: 1,
  //       delegates: [],
  //     });
  //   });
  //
  //   it('should return empty delegates array if slots.delegates < 1', async () => {
  //     Object.defineProperty(slots, 'delegates', { value: 0 });
  //     const ret = await instance.getNextForgers(limit);
  //
  //     expect(ret).to.be.deep.equal({
  //       currentBlock: blocksModel.toStringBlockType((blocks as any).lastBlock),
  //       currentBlockSlot: 1,
  //       currentSlot: 1,
  //       delegates: [],
  //     });
  //   });
  // });
  //
  // describe('createDelegate', () => {
  //   it('should return a rejected promise', async () => {
  //     await expect(instance.createDelegate()).to.be.rejectedWith(
  //       'Method is deprecated'
  //     );
  //   });
  // });
  //
  // describe('getForgingStatus', () => {
  //   let params;
  //   let enabled;
  //   let delegates;
  //   let isForgeEnabledOnStub: SinonStub;
  //   let getEnabledKeysStub: SinonStub;
  //
  //   beforeEach(() => {
  //     params = {
  //       publicKey: RiseV2.deriveKeypair('meow').publicKey.toString('hex'),
  //     };
  //     enabled = true;
  //     delegates = [{}, {}];
  //
  //     isForgeEnabledOnStub = sandbox
  //       .stub(forgeModule, 'isForgeEnabledOn')
  //       .returns(enabled);
  //     getEnabledKeysStub = sandbox
  //       .stub(forgeModule, 'getEnabledKeys')
  //       .returns(delegates);
  //   });
  //
  //   it('param.publicKey', async () => {
  //     const ret = await instance.getForgingStatus(params);
  //
  //     expect(ret).to.be.deep.equal({
  //       delegates: [params.publicKey],
  //       enabled: true,
  //     });
  //
  //     expect(isForgeEnabledOnStub.calledOnce).to.be.true;
  //     expect(isForgeEnabledOnStub.firstCall.args.length).to.be.equal(1);
  //     expect(isForgeEnabledOnStub.firstCall.args[0]).to.be.equal(
  //       params.publicKey
  //     );
  //   });
  //
  //   it('!param.publicKey', async () => {
  //     delete params.publicKey;
  //     const ret = await instance.getForgingStatus(params);
  //
  //     expect(getEnabledKeysStub.calledOnce).to.be.true;
  //     expect(getEnabledKeysStub.firstCall.args.length).to.be.equal(0);
  //
  //     expect(ret).to.be.deep.equal({ delegates, enabled: true });
  //   });
  // });
  //
  // describe('forgingEnable', () => {
  //   let params;
  //   let kp;
  //   let publicKey;
  //   let account;
  //   let isForgeEnabledOnStub: SinonStub;
  //   let getAccountStub: SinonStub;
  //   let enableForgeStub: SinonStub;
  //
  //   beforeEach(() => {
  //     account = { isDelegate: true };
  //     publicKey = RiseV2.deriveKeypair('meow').publicKey.toString('hex');
  //     params = {
  //       publicKey,
  //       secret: 'meow',
  //     };
  //     kp = { publicKey };
  //     isForgeEnabledOnStub = sandbox
  //       .stub(forgeModule, 'isForgeEnabledOn')
  //       .returns(false);
  //     enableForgeStub = sandbox
  //       .stub(forgeModule, 'enableForge')
  //       .returns({} as any);
  //     getAccountStub = sandbox.stub(accounts, 'getAccount').returns(account);
  //
  //     // ed.enqueueResponse('makeKeypair', kp);
  //   });
  //
  //   // it('should call ed.makeKeypair', async () => {
  //   //   await instance.forgingEnable(params);
  //   //
  //   //   expect(ed.stubs.makeKeypair.calledOnce).to.be.true;
  //   //   expect(ed.stubs.makeKeypair.firstCall.args.length).to.be.equal(1);
  //   //   expect(ed.stubs.makeKeypair.firstCall.args[0]).to.be.deep.equal(hash);
  //   // });
  //
  //   // it('should call crypto.createHash', async () => {
  //   //   await instance.forgingEnable(params);
  //   //
  //   //   // the first call in beforeEach hook
  //   //   expect(cryptoCreateHashSpy.calledTwice).to.be.true;
  //   //   expect(cryptoCreateHashSpy.secondCall.args.length).to.be.equal(1);
  //   //   expect(cryptoCreateHashSpy.secondCall.args[0]).to.be.equal('sha256');
  //   // });
  //
  //   it('should throw error if params.publicKey isn"t undefined and pk !== params.publicKey', async () => {
  //     sandbox.stub(ed, 'makeKeyPair').returns({
  //       publicKey: Buffer.from('sss', 'utf8'),
  //       privateKey: Buffer.from('sss', 'utf8'),
  //     });
  //
  //     await expect(instance.forgingEnable(params)).to.be.rejectedWith(
  //       'Invalid passphrase'
  //     );
  //   });
  //
  //   it('should call forgeModule.isForgeEnabledOn', async () => {
  //     await instance.forgingEnable(params);
  //
  //     expect(isForgeEnabledOnStub.calledOnce).to.be.true;
  //     expect(isForgeEnabledOnStub.firstCall.args.length).to.be.equal(1);
  //     expect(isForgeEnabledOnStub.firstCall.args[0]).to.be.deep.equal(
  //       publicKey
  //     );
  //   });
  //
  //   it('should throw error if forgeModule.isForgeEnabledOn returns true', async () => {
  //     isForgeEnabledOnStub.returns(true);
  //
  //     await expect(instance.forgingEnable(params)).to.be.rejectedWith(
  //       'Forging is already enabled'
  //     );
  //   });
  //
  //   it('should call accounts.getAccount', async () => {
  //     await instance.forgingEnable(params);
  //
  //     expect(getAccountStub.calledOnce).to.be.true;
  //     expect(getAccountStub.firstCall.args.length).to.be.equal(1);
  //     expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({
  //       forgingPK: Buffer.from(publicKey, 'hex'),
  //     });
  //   });
  //
  //   it('should throw error if account not found', async () => {
  //     getAccountStub.returns(false);
  //
  //     await expect(instance.forgingEnable(params)).to.be.rejectedWith(
  //       'Account not found'
  //     );
  //   });
  //
  //   it('should throw error if delegate not found', async () => {
  //     getAccountStub.returns({});
  //
  //     await expect(instance.forgingEnable(params)).to.be.rejectedWith(
  //       'Delegate not found'
  //     );
  //   });
  //
  //   it('should call forgeModule.enableForge', async () => {
  //     await instance.forgingEnable(params);
  //
  //     expect(enableForgeStub.calledOnce).to.be.true;
  //     expect(enableForgeStub.firstCall.args.length).to.be.equal(1);
  //     expect(enableForgeStub.firstCall.args[0]).to.be.deep.equal({
  //       publicKey: Buffer.from(publicKey, 'hex'),
  //       privateKey: RiseV2.deriveKeypair(params.secret).privateKey,
  //     });
  //   });
  // });
  //
  // describe('forgingDisable', () => {
  //   let params;
  //   let kp;
  //   let publicKey;
  //   let account;
  //   let isForgeEnabledOnStub: SinonStub;
  //   let disableForgeStub: SinonStub;
  //   let getAccountStub: SinonStub;
  //
  //   beforeEach(() => {
  //     account = { isDelegate: true };
  //     publicKey = RiseV2.deriveKeypair('meow').publicKey.toString('hex');
  //     params = {
  //       publicKey,
  //       secret: 'meow',
  //     };
  //     kp = { publicKey };
  //     isForgeEnabledOnStub = sandbox
  //       .stub(forgeModule, 'isForgeEnabledOn')
  //       .returns(true);
  //     disableForgeStub = sandbox
  //       .stub(forgeModule, 'disableForge')
  //       .returns({} as any);
  //     getAccountStub = sandbox.stub(accounts, 'getAccount').returns(account);
  //   });
  //
  //   it('should throw error if params.publicKey isn"t undefined and pk !== params.publicKey', async () => {
  //     sandbox.stub(ed, 'makeKeyPair').returns({
  //       publicKey: Buffer.from('sss', 'utf8'),
  //       privateKey: Buffer.from('sss', 'utf8'),
  //     });
  //     await expect(instance.forgingDisable(params)).to.be.rejectedWith(
  //       'Invalid passphrase'
  //     );
  //   });
  //
  //   it('should call forgeModule.isForgeEnabledOn', async () => {
  //     await instance.forgingDisable(params);
  //
  //     expect(isForgeEnabledOnStub.calledOnce).to.be.true;
  //     expect(isForgeEnabledOnStub.firstCall.args.length).to.be.equal(1);
  //     expect(isForgeEnabledOnStub.firstCall.args[0]).to.be.deep.equal(
  //       publicKey
  //     );
  //   });
  //
  //   it('should throw error if forgeModule.isForgeEnabledOn returns undefined', async () => {
  //     isForgeEnabledOnStub.returns(undefined);
  //
  //     await expect(instance.forgingDisable(params)).to.be.rejectedWith(
  //       'Forging is already disabled'
  //     );
  //   });
  //
  //   it('should call accounts.getAccount', async () => {
  //     await instance.forgingDisable(params);
  //
  //     expect(getAccountStub.calledOnce).to.be.true;
  //     expect(getAccountStub.firstCall.args.length).to.be.equal(1);
  //     expect(getAccountStub.firstCall.args[0]).to.be.deep.equal({
  //       forgingPK: Buffer.from(publicKey, 'hex'),
  //     });
  //   });
  //
  //   it('should throw error if account not found', async () => {
  //     getAccountStub.resolves(false);
  //
  //     await expect(instance.forgingDisable(params)).to.be.rejectedWith(
  //       'Account not found'
  //     );
  //   });
  //
  //   it('should throw error if delegate not found', async () => {
  //     getAccountStub.resolves({});
  //
  //     await expect(instance.forgingDisable(params)).to.be.rejectedWith(
  //       'Delegate not found'
  //     );
  //   });
  //
  //   it('should call forgeModule.disableForge', async () => {
  //     await instance.forgingDisable(params);
  //
  //     expect(disableForgeStub.calledOnce).to.be.true;
  //     expect(disableForgeStub.firstCall.args.length).to.be.equal(1);
  //     expect(disableForgeStub.firstCall.args[0]).to.be.deep.equal(publicKey);
  //   });
  // });
});
