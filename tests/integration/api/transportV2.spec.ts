import * as chai from 'chai';
import { expect } from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { LiskWallet } from 'dpos-offline/dist/es5/liskWallet';
import * as sinon from 'sinon';
import * as supertest from 'supertest';
import * as z_schema from 'z-schema';
import { CommonBlockRequest } from '../../../src/apis/requests/CommonBlockRequest';
import { GetBlocksRequest } from '../../../src/apis/requests/GetBlocksRequest';
import { GetSignaturesRequest } from '../../../src/apis/requests/GetSignaturesRequest';
import { GetTransactionsRequest } from '../../../src/apis/requests/GetTransactionsRequest';
import { PeersListRequest } from '../../../src/apis/requests/PeersListRequest';
import { PostBlocksRequest, PostBlocksRequestDataType } from '../../../src/apis/requests/PostBlocksRequest';
import { PostSignaturesRequest, PostSignaturesRequestDataType } from '../../../src/apis/requests/PostSignaturesRequest';
import { PostTransactionsRequest } from '../../../src/apis/requests/PostTransactionsRequest';
import { RequestFactoryType } from '../../../src/apis/requests/requestFactoryType';
import { requestSymbols } from '../../../src/apis/requests/requestSymbols';
import { Ed, ForkType, ProtoBufHelper } from '../../../src/helpers';
import constants from '../../../src/helpers/constants';
import {
  IBlockLogic,
  IPeerLogic,
  IPeersLogic,
  ITransactionLogic,
  ITransactionPoolLogic
} from '../../../src/ioc/interfaces/logic';
import {
  IBlocksModule,
  IBlocksModuleVerify,
  IForkModule,
  IPeersModule, ISystemModule,
  ITransactionsModule
} from '../../../src/ioc/interfaces/modules';
import { Symbols } from '../../../src/ioc/symbols';
import { BasePeerType, PeerType, SignedBlockType } from '../../../src/logic';
import { IBaseTransaction } from '../../../src/logic/transactions';
import { BlocksModel, TransactionsModel } from '../../../src/models';
import { createFakePeers } from '../../utils/fakePeersFactory';
import { toBufferedTransaction } from '../../utils/txCrafter';
import initializer from '../common/init';
import {
  createMultiSignAccount,
  createRandomAccountWithFunds,
  createRandomWallet,
  createSendTransaction,
  getRandomDelegateWallet
} from '../common/utils';
import { checkReturnObjKeyVal } from './utils';

chai.use(chaiAsPromised);

// tslint:disable no-unused-expression max-line-length object-literal-sort-keys
const headers = {
  nethash: 'e4c527bd888c257377c18615d021e9cedd2bc2fd6de04b369f22a8780264c2f6',
  port   : 1,
  version: '1.1.10',
};

const transportTXSchema = {
  id        : 'Transaction',
  type      : 'object',
  properties: {
    id                : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    height            : {
      type: 'integer',
    },
    blockId           : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    type              : {
      type: 'integer',
    },
    timestamp         : {
      type: 'integer',
      minimum: 0,
    },
    senderPublicKey   : {
      type: 'string',
      format  : 'publicKey',
    },
    requesterPublicKey: {
      anyOf: [
        {
          type  : 'string',
          format: 'publicKey',
        },
        { type: 'null' },
      ],
    },
    senderId          : {
      type     : 'string',
      format   : 'address',
      minLength: 1,
      maxLength: 22,
    },
    recipientId       : {
      type     : 'string',
      format   : 'address',
      minLength: 1,
      maxLength: 22,
    },
    amount            : {
      type   : 'integer',
      minimum: 0,
    },
    fee               : {
      type   : 'integer',
      minimum: 0,
    },
    signature         : {
      type: 'string',
      format  : 'signature',
    },
    signSignature     : {
      type  : 'string',
      format: 'signature',
    },
    asset             : {
      anyOf: [
        { type  : 'object' },
        { type: 'null' },
      ],
    },
  },
  required  : ['type', 'timestamp', 'senderId', 'senderPublicKey', 'signature', 'fee', 'amount'],
};
let protoBufHelper: ProtoBufHelper;

function checkHeadersValidation(p: () => supertest.Test) {
  it('should fail if version is not provided', () => {
    const tmp = { ...{}, ...headers };
    delete tmp.version;
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(Buffer.isBuffer(res.body)).true;
        const err = protoBufHelper.decode<{success: boolean, error: string}>(res.body, 'APIError');
        expect(err.success).is.false;
        expect(err.error).to.contain('Missing required property: version');
      });
  });

  it('should fail if nethash is not provided', () => {
    const tmp = { ...{}, ...headers };
    delete tmp.nethash;
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(Buffer.isBuffer(res.body)).true;
        const err = protoBufHelper.decode<{success: boolean, error: string}>(res.body, 'APIError');
        expect(err.success).is.false;
        expect(err.error).to.contain('Missing required property: nethash');
      });
  });

  it('should fail if port is not provided', () => {
    const tmp = { ...{}, ...headers };
    delete tmp.port;
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(Buffer.isBuffer(res.body)).true;
        const err = protoBufHelper.decode<{success: boolean, error: string}>(res.body, 'APIError');
        expect(err.success).is.false;
        expect(err.error).to.contain('Missing required property: port');
      });
  });

  it('should fail if nethash is not correct', () => {
    const tmp   = { ...{}, ...headers };
    tmp.nethash = new Array(64).fill(null).map(() => 'a').join('');
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(Buffer.isBuffer(res.body)).true;
        const err = protoBufHelper.decode<{success: boolean, error: string}>(res.body, 'APIError');
        expect(err.success).is.false;
        expect(err.error).to.contain('Request is made on the wrong network');
      });
  });

  it('should fail if broadhash is not hex', () => {
    const tmp: any = { ...{}, ...headers };
    tmp.broadhash  = 'hh';
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(Buffer.isBuffer(res.body)).true;
        const err = protoBufHelper.decode<{success: boolean, error: string}>(res.body, 'APIError');
        expect(err.success).is.false;
        expect(err.error).to.contain('broadhash - Object didn\'t pass validation for format');
      });
  });

  it('should fail if height is string', () => {
    const tmp: any = { ...{}, ...headers };
    tmp.height     = 'hh';
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(Buffer.isBuffer(res.body)).true;
        const err = protoBufHelper.decode<{success: boolean, error: string}>(res.body, 'APIError');
        expect(err.success).is.false;
        expect(err.error).to.contain('height - Expected type integer');
      });
  });

  it('should fail if nonce is less than 16 chars', () => {
    const tmp: any = { ...{}, ...headers };
    tmp.nonce      = new Array(15).fill(null).fill('a').join('');
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(Buffer.isBuffer(res.body)).true;
        const err = protoBufHelper.decode<{success: boolean, error: string}>(res.body, 'APIError');
        expect(err.success).is.false;
        expect(err.error).to.contain('nonce - String is too short (15 chars)');
      });
  });

  it('should fail if nonce is longer than 36 chars', () => {
    const tmp: any = { ...{}, ...headers };
    tmp.nonce      = new Array(37).fill(null).fill('a').join('');
    return p()
      .set(tmp)
      .expect(200)
      .then((res) => {
        expect(Buffer.isBuffer(res.body)).true;
        const err = protoBufHelper.decode<{success: boolean, error: string}>(res.body, 'APIError');
        expect(err.success).is.false;
        expect(err.error).to.contain('nonce - String is too long (37 chars)');
      });
  });

}

// tslint:disable-next-line
describe('v2/peer/transport', function() {
  this.timeout(10000);
  initializer.setup();
  let peer: IPeerLogic;

  let getPeersListFactory: RequestFactoryType<void, PeersListRequest>;
  let ptFactory: RequestFactoryType<{transactions: Array<IBaseTransaction<any>>}, PostTransactionsRequest>;
  let psFactory: RequestFactoryType<PostSignaturesRequestDataType, PostSignaturesRequest>;
  let gsFactory: RequestFactoryType<void, GetSignaturesRequest>;
  let gtFactory: RequestFactoryType<void, GetTransactionsRequest>;
  let cbFactory: RequestFactoryType<void, CommonBlockRequest>;
  let gbFactory: RequestFactoryType<void, GetBlocksRequest>;
  let pbFactory: RequestFactoryType<PostBlocksRequestDataType, PostBlocksRequest>;

  beforeEach(() => {
    const systemModule = initializer.appManager.container.get<ISystemModule>(Symbols.modules.system);
    const peerFactory = initializer.appManager.container.get<(peer: BasePeerType) => IPeerLogic>(Symbols.logic.peerFactory);
    const appConfig = initializer.appManager.container.get<any>(Symbols.generic.appConfig);
    protoBufHelper = initializer.appManager.container.get<any>(Symbols.helpers.protoBuf);
    getPeersListFactory = initializer.appManager.container.get<any>(requestSymbols.peersList);
    ptFactory = initializer.appManager.container.get<any>(requestSymbols.postTransactions);
    psFactory = initializer.appManager.container.get<any>(requestSymbols.postSignatures);
    gsFactory = initializer.appManager.container.get<any>(requestSymbols.getSignatures);
    gtFactory = initializer.appManager.container.get<any>(requestSymbols.getTransactions);
    cbFactory = initializer.appManager.container.get<any>(requestSymbols.commonBlock);
    gbFactory = initializer.appManager.container.get<any>(requestSymbols.getBlocks);
    pbFactory = initializer.appManager.container.get<any>(requestSymbols.postBlocks);

    peer = peerFactory({ip: '127.0.0.1', port: appConfig.port});
    systemModule.headers.version = '1.2.0';
    peer.version = '1.2.0';
  });

  describe('/list', () => {
    let peers: PeerType[];
    let peersLogic: IPeersLogic;
    let peersModule: IPeersModule;

    before(() => {
      peers      = createFakePeers(10);
      peersLogic = initializer.appManager.container.get<IPeersLogic>(Symbols.logic.peers);
      peersModule = initializer.appManager.container.get<IPeersModule>(Symbols.modules.peers);
      peers.forEach((p) => peersLogic.upsert(p, true));
    });
    after(() => {
      peers.map((p) => peersLogic.remove(p));
    });

    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/v2/peer/list'));
    it('should return known peers ', async () => {
      const bit = await peer.makeRequest(getPeersListFactory({data: null}));
      const res = await peersModule.list({ limit: constants.maxPeers });
      expect(bit.peers.sort((a, b) => a.nonce.localeCompare(b.nonce)))
        .deep.eq(res.peers.map(((pp) => pp.object())).sort((a, b) => a.nonce.localeCompare(b.nonce)));
    });
  });

  describe('/signatures [GET] [POST]', () => {
    let blocksModule: IBlocksModule;
    let txModule: ITransactionsModule;
    let txLogic: ITransactionLogic;
    let ed: Ed;
    let txPool: ITransactionPoolLogic;
    let multisigKeys: LiskWallet[];
    let multisigAccount: LiskWallet;

    beforeEach(async () => {
      blocksModule     = initializer.appManager.container.get(Symbols.modules.blocks);
      txModule         = initializer.appManager.container.get(Symbols.modules.transactions);
      ed               = initializer.appManager.container.get(Symbols.helpers.ed);
      txLogic          = initializer.appManager.container.get(Symbols.logic.transaction);
      txPool           = initializer.appManager.container.get(Symbols.logic.transactionPool);
      const { wallet } = await createRandomAccountWithFunds(5000000000);
      const { keys }  = await createMultiSignAccount(
        wallet,
        [createRandomWallet(), createRandomWallet(), createRandomWallet()],
        3
        );

      multisigAccount = wallet;
      multisigKeys = keys;
      txPool.multisignature.list(false).forEach((w) => txPool.multisignature.remove(w.id));
    });

    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/v2/peer/signatures'));

    it('should merge requests correctly', async () => {
      const tx = await createSendTransaction(0, 1, multisigAccount, '1R');
      const sendTxResult = await peer.makeRequest(ptFactory({
        data: {
          transactions: [toBufferedTransaction(tx)],
        },
      }));
      expect(sendTxResult.success).to.be.true;
      await txPool.processBundled();
      await txModule.fillPool();
      const a = psFactory({
        data: {
          signature: {
            signature: Buffer.from(multisigKeys[0].getSignatureOfTransaction(tx), 'hex'),
            transaction: tx.id,
          },
        },
      });
      a.mergeIntoThis(psFactory({
        data: {
          signature: {
            signature: Buffer.from(multisigKeys[0].getSignatureOfTransaction(tx), 'hex'),
            transaction: tx.id,
          },
        },
      }));

      a.mergeIntoThis(psFactory({
        data: {
          signature: {
            signature: Buffer.from(multisigKeys[0].getSignatureOfTransaction(tx), 'hex'),
            transaction: tx.id,
          },
          signatures: [
            {
              signature: Buffer.from(multisigKeys[1].getSignatureOfTransaction(tx), 'hex'),
              transaction: tx.id,
            },
            {
              signature: Buffer.from(multisigKeys[0].getSignatureOfTransaction(tx), 'hex'),
              transaction: tx.id,
            },
            {
              signature: Buffer.from(multisigKeys[2].getSignatureOfTransaction(tx), 'hex'),
              transaction: tx.id,
            },
          ],
        },
      }));
      await peer.makeRequest(a);

      expect(txPool.multisignature.get(tx.id).signatures)
        .deep.eq(
        new Array(3)
          .fill(null)
          .map((item, idx) => multisigKeys[idx].getSignatureOfTransaction(tx)
          )
      );
    });
    it('POST: should allow signatures', async () => {
      const tx = await createSendTransaction(0, 1, multisigAccount, '1R');
      const sendTxResult = await peer.makeRequest(ptFactory({
        data: {
          transactions: [toBufferedTransaction(tx)],
        },
      }));
      expect(sendTxResult.success).to.be.true;
      await txPool.processBundled();
      await txModule.fillPool();
      let req = psFactory({
        data: {
          signatures: [{
            signature: Buffer.from(multisigKeys[0].getSignatureOfTransaction(tx), 'hex'),
            transaction: tx.id,
          }],
        },
      });
      await peer.makeRequest(req);
      req = psFactory({
        data: {
          signatures: [
            {transaction: tx.id} as any,
            {
            signature: Buffer.from(multisigKeys[1].getSignatureOfTransaction(tx), 'hex'),
            transaction: tx.id,
          }, {transaction: tx.id} as any],
        },
      });
      await peer.makeRequest(req);
      expect(txPool.multisignature.get(tx.id).signatures).contain(
        multisigKeys[1].getSignatureOfTransaction(tx),
        multisigKeys[0].getSignatureOfTransaction(tx)
      );
    });
    it('POST: should allow signature', async () => {
      const tx = await createSendTransaction(0, 1, multisigAccount, '1R');
      const sendTxResult = await peer.makeRequest(ptFactory({
        data: {
          transactions: [toBufferedTransaction(tx)],
        },
      }));
      expect(sendTxResult.success).to.be.true;
      await txPool.processBundled();
      await txModule.fillPool();
      let req = psFactory({
        data: {
          signature: {
            signature: Buffer.from(multisigKeys[0].getSignatureOfTransaction(tx), 'hex'),
            transaction: tx.id,
          },
        },
      });
      await peer.makeRequest(req);
      req = psFactory({
        data: {
          signature: {
            signature: Buffer.from(multisigKeys[1].getSignatureOfTransaction(tx), 'hex'),
            transaction: tx.id,
          }
        },
      });
      await peer.makeRequest(req);
      expect(txPool.multisignature.get(tx.id).signatures).contain(
        multisigKeys[1].getSignatureOfTransaction(tx),
        multisigKeys[0].getSignatureOfTransaction(tx)
      );
    });
    it('should return multisig signatures missing some sigs', async () => {
      const tx = await createSendTransaction(0, 1, multisigAccount, '1R');
      const sendTxResult = await peer.makeRequest(ptFactory({
        data: {
          transactions: [toBufferedTransaction(tx)],
        },
      }));
      expect(sendTxResult.success).to.be.true;

      await txPool.processBundled();
      await txModule.fillPool();
      await initializer.rawMineBlocks(1);
      expect(blocksModule.lastBlock.numberOfTransactions).eq(0);

      // add 2 out of 3 signatures.
      const sigs = [];
      for (const msKey of multisigKeys) {
        const signature = ed.sign(
          txLogic.getHash(toBufferedTransaction(tx), false, false),
          {
            privateKey: Buffer.from(msKey.privKey, 'hex'),
            publicKey : Buffer.from(msKey.publicKey, 'hex'),
          }
        );
        const r = await peer.makeRequest(psFactory({
          data: {
            signatures: [{
              signature,
              transaction: tx.id,
            }],
          },
        }));
        expect(r.success).to.be.true;

        sigs.push(signature);
        const r2 = await peer.makeRequest(psFactory({
          data: {
            signatures: sigs.map((sig) => {
              return {
                signature: sig,
                transaction: tx.id,
              };
            }),
          },
        }));
        expect(r2.success).to.be.true;
      }

      const currentSigs = await peer.makeRequest(gsFactory({data: null}));
      const expectedSigs = {
        signatures: [
          {signatures: sigs.map((s) => s.toString('hex')), transaction: tx.id},
        ],
      };
      expect(currentSigs).to.be.deep.eq(expectedSigs);

      await initializer.rawMineBlocks(1);
      const finalSigs = await peer.makeRequest(gsFactory({data: null}));
      expect(finalSigs).to.be.deep.eq({signatures : []});
      expect(blocksModule.lastBlock.transactions.length).eq(1);
    });

  });

  describe('/transactions [GET]', () => {
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/v2/peer/transactions'));

    it('should return all transactions in queue', async function() {
      this.timeout(10000);
      const txModule         = initializer.appManager.container.get<ITransactionsModule>(Symbols.modules.transactions);
      const txPool           = initializer.appManager.container.get<ITransactionPoolLogic>(Symbols.logic.transactionPool);
      const txLogic          = initializer.appManager.container.get<ITransactionLogic>(Symbols.logic.transaction);
      const { wallet } = await createRandomAccountWithFunds(Math.pow(10, 8));
      const account          = wallet;
      const tx1  = await createSendTransaction(0, 1, account, createRandomWallet().address);
      const tx2  = await createSendTransaction(0, 2, account, createRandomWallet().address);
      const r = await peer.makeRequest(ptFactory({
        data: { transactions: [tx1, tx2] } as any,
      }));
      expect(r.success).to.be.true;
      await txPool.processBundled();
      const getTxs = await peer.makeRequest(gtFactory({data: null}));
      expect(getTxs.transactions.length).eq(2);
      const zschema = initializer.appManager.container.get<z_schema>(Symbols.generic.zschema);
      for (const t of getTxs.transactions) {
        const res = zschema.validate(t, transportTXSchema);
        expect(res).is.eq(true);
      }
      expect([tx1, tx2].map((t) => txLogic.objectNormalize(t)).sort((a, b) => a.id.localeCompare(b.id)))
        .to.be.deep.equal(getTxs.transactions.map((t) => txLogic.objectNormalize(t)).sort((a, b) => a.id.localeCompare(b.id)));
    });
  });

  describe('/transactions [POST]', function() {
    this.timeout(10000);
    let account: LiskWallet;
    let blocksModule: IBlocksModule;
    let txModule: ITransactionsModule;
    let txPool: ITransactionPoolLogic;

    beforeEach(async () => {
      blocksModule     = initializer.appManager.container.get(Symbols.modules.blocks);
      txModule         = initializer.appManager.container.get(Symbols.modules.transactions);
      txPool           = initializer.appManager.container.get(Symbols.logic.transactionPool);
      const { wallet } = await createRandomAccountWithFunds(Math.pow(10, 8));
      account          = wallet;
    });

    afterEach(async () => {
      await initializer.rawDeleteBlocks(blocksModule.lastBlock.height - 1);
    });

    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .post('/v2/peer/transactions'));

    it('should enqueue transaction', async () => {
      const tx  = await createSendTransaction(0, 1, account, createRandomWallet().address);
      const res = await peer.makeRequest(ptFactory({
        data: {
          transaction: tx,
        } as any,
      }));
      expect(res.success).to.be.true;
      expect(txPool.transactionInPool(tx.id)).is.true;
    });

    it('should enqueue bundled transactions', async () => {
      const tx  = await createSendTransaction(0, 1, account, createRandomWallet().address);
      // const tx2  = await createSendTransaction(0, 1, account, createRandomWallet().address);
      await expect(peer.makeRequest(ptFactory({
        data: {
          transactions: [tx, tx],
        } as any,
      }))).rejectedWith('Transaction is already processed');
    });
  });

  describe('/blocks/common', () => {
    initializer.createBlocks(10, 'single');
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/v2/peer/blocks/common'));

    it('should throw if given ids is not csv', async () => {
      await expect(peer.makeRequest(cbFactory({
        data: null,
        query: {ids: 'ohh%20yeah'},
      }))).rejectedWith('Invalid block id sequence');
    });
    it('should throw if more than 10 ids are given', async () => {
      await expect(peer.makeRequest(cbFactory({
        data : null,
        query: { ids: '1,2,3,4,5,6,7,8,9,0,1' },
      }))).rejectedWith('Invalid block id sequence') as any;
    });
    it('should throw if given ids is not csv', async () => {
      await expect(peer.makeRequest(cbFactory({
        data : null,
        query: { ids: '1,2,3,4,5,6,7,8,9,0,1' },
      }))).rejectedWith('Invalid block id sequence');
    });

    it('should return the most heigh commonblock if any', async () => {
      const lastBlock = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks).lastBlock;
      const genesis   = initializer.appManager.container.get<any>(Symbols.generic.genesisBlock);
      const res = await peer.makeRequest(cbFactory({
        data : null,
        query: { ids: `${genesis.id},2,33433441728981446756,${lastBlock.previousBlock}` },
      })) as any;
      expect(res.common).is.not.null;
      expect(res.common.height).is.eq(lastBlock.height - 1);
    });

    it('should return null if no common blocks', async () => {
      const res = await peer.makeRequest(cbFactory({
        data : null,
        query: { ids: '1,2,3,' },
      })) as any;
      expect(res.common).is.null;
    });
  });

  describe('/blocks', () => {
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .get('/v2/peer/blocks/'));

    it('should query last 34 blocks from given lastId', async () => {
      const { wallet } = await createRandomAccountWithFunds(Math.pow(10, 10));
      const txs = (await Promise.all(new Array(25).fill(null)
        .map((_, idx) => createSendTransaction(0, idx + 1, wallet, '1R'))))
        .map((tx) => toBufferedTransaction(tx));
      const b = await initializer.rawMineBlockWithTxs([]);
      const r = await peer.makeRequest(gbFactory({data: null, query: {lastBlockId: b.previousBlock}}));
      expect(r.blocks[0]).to.be.deep.equal(b);
    });
  });

  describe('/blocks [post]', () => {
    let blockLogic: IBlockLogic;
    let blocksModule: IBlocksModule;
    let block: SignedBlockType<string>;
    let blockBuf: SignedBlockType<Buffer>;
    let senderAccount: LiskWallet;
    let blocksModel: typeof BlocksModel;
    let transactionsModel: typeof TransactionsModel;
    beforeEach(async () => {
      senderAccount     = getRandomDelegateWallet();
      blockLogic        = initializer.appManager.container.get<IBlockLogic>(Symbols.logic.block);
      blocksModule      = initializer.appManager.container.get<IBlocksModule>(Symbols.modules.blocks);
      blocksModel       = initializer.appManager.container.get<typeof BlocksModel>(Symbols.models.blocks);
      transactionsModel = initializer.appManager.container.get<typeof TransactionsModel>(Symbols.models.transactions);
      blockBuf          = await initializer.generateBlock([(await createSendTransaction(0, 1, senderAccount, senderAccount.address))]);
      blockBuf.id       = blockLogic.getId(blockBuf);
      block             = blocksModel.toStringBlockType(blockBuf, transactionsModel, blocksModule);
    });
    checkHeadersValidation(() => supertest(initializer.appManager.expressApp)
      .post('/v2/peer/blocks/'));
    it('should accept valid block and save it in blockchain', async () => {
      const response = await peer.makeRequest(pbFactory({
        data: { block: blockBuf },
      }));
      expect(response.success).is.true;
      expect(response.blockId).is.eq(blockBuf.id);
      expect(blocksModule.lastBlock.id).is.eq(blockBuf.id);
    });

    it('should discard block if height is off', async () => {
      blockBuf.height = 10330;
      blockBuf.id     = blockLogic.getId(blockBuf);
      await expect(peer.makeRequest(pbFactory({
        data: { block: blockBuf },
      }))).rejectedWith('Block discarded - not in current chain');
    });

    describe('payload issues', async () => {
      it('should reject block if payload is mismatching', async () => {
        blockBuf.payloadHash = Buffer.alloc(32).fill('aa');
        await expect(peer.makeRequest(pbFactory({
          data: { block: blockBuf },
        }))).rejectedWith('Failed to verify block signature');
      });

      it('should reject block if tx in payload is wrong', async () => {
        blockBuf.transactions[0].fee = 1;
        await expect(peer.makeRequest(pbFactory({
          data: { block: blockBuf },
        }))).rejectedWith('Invalid total fee');
      });

      it('should reject block if payloadHash is not ok', async () => {
        blockBuf.transactions[0] = await createSendTransaction(0, 1, senderAccount, senderAccount.address, { timestamp: 10 }) as any;
        await expect(peer.makeRequest(pbFactory({
          data: { block: blockBuf },
        }))).rejectedWith('Invalid payload hash');
      });
    });

    it('should delete last block if fork 5', async () => {
      await initializer.rawMineBlocks(1);
      const nextBlock = await initializer.generateBlock();
      blockBuf.id     = nextBlock.id = blockLogic.getId(nextBlock);
      // Generate a block with an id less than nextBlock
      for (let i = 0; blockBuf.id >= nextBlock.id; i++) {
        blockBuf    = await initializer.generateBlock([
          (await createSendTransaction(0, 1, senderAccount, senderAccount.address, { timestamp: i + 1 })),
        ]);
        blockBuf.id = blockLogic.getId(blockBuf);
      }

      await initializer.rawMineBlocks(1);
      expect(blocksModule.lastBlock.id).to.be.eq(nextBlock.id);
      // fake slots otherwise we won't be able to

      const verifyModule = initializer.appManager.container.get<IBlocksModuleVerify>(Symbols.modules.blocksSubModules.verify);
      const forksModule  = initializer.appManager.container.get<IForkModule>(Symbols.modules.fork);
      const stub         = sinon.stub(verifyModule as any, 'verifyBlockSlotWindow').returns([]);
      const spyFork      = sinon.spy(forksModule, 'fork');

      const response = await peer.makeRequest(pbFactory({
        data: { block: blockBuf },
      }));

      expect(response.success).is.true;
      expect(blocksModule.lastBlock.id).to.be.eq(blockBuf.id);
      stub.restore();

      expect(spyFork.calledOnce).is.true;
      expect(spyFork.firstCall.args[1]).is.deep.eq(ForkType.TYPE_5);
      spyFork.restore();
    });

  });
});
