import { APIConfig } from '@risevision/core-apis';
import { BlocksModel } from '@risevision/core-blocks';
import { DposAppConfig, Slots } from '@risevision/core-consensus-dpos';
import { dPoSSymbols, ForgeModule } from '@risevision/core-consensus-dpos';
import { ModelSymbols } from '@risevision/core-models';
import { TransactionsModel } from '@risevision/core-transactions';
import {
  IBlocksModule,
  ITimeToEpoch,
  SignedAndChainedBlockType,
  Symbols,
} from '@risevision/core-types';
import * as chai from 'chai';
import * as chaiSorted from 'chai-sorted';
import { Rise } from 'dpos-offline';
import * as supertest from 'supertest';
import { As } from 'type-tagger';
import initializer from '../common/init';
import {
  confirmTransactions,
  createRandomAccountWithFunds,
  createRandomWallet,
  createRegDelegateTransactionV2,
  createSendTransactionV1,
  createVoteTransactionV1,
  createWallet,
  findDelegateByUsername,
  getRandomDelegateWallet,
  tempDelegateWallets,
} from '../common/utils';
import {
  checkEnumParam,
  checkIntParam,
  checkPostPubKey,
  checkPostRequiredParam,
  checkPubKey,
  checkRequiredParam,
  checkReturnObjKeyVal,
} from './utils';

chai.use(chaiSorted);

const { expect } = chai;

// tslint:disable no-unused-expression max-line-length no-identical-functions object-literal-sort-keys no-var-requires max-line-length no-big-function
const delegates = require('../../../../core-launchpad/tests/unit/assets/genesisDelegates.json');
describe('api/delegates', () => {
  initializer.setup();
  initializer.autoRestoreEach();
  before(async function() {
    this.timeout(10000);
    await initializer.goToNextRound();
  });

  describe('/', () => {
    checkEnumParam(
      'orderBy',
      [
        // 'approval:desc',
        // 'approval:asc',
        // 'productivity:desc',
        // 'productivity:asc',
        // 'rank:desc',
        // 'rank:asc',
        'vote:desc',
        'vote:asc',
        'address:desc',
        'address:asc',
        'username:desc',
        'username:asc',
        'forgingPK:desc',
        'forgingPK:asc',
      ],
      '/api/delegates'
    );
    checkIntParam('limit', '/api/delegates', { min: 1 });
    checkIntParam('offset', '/api/delegates', { min: 0 });

    // checkReturnObjKeyVal('totalCount', 101, '/api/delegates');

    it('should return delegates array', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(Array.isArray(response.body.delegates));
          expect(
            response.body.delegates.map((d) => d.address).sort()
          ).to.be.deep.equal(delegates.map((d) => d.address).sort());
        });
    });

    [
      // 'approval',
      // 'productivity',
      // 'rank',
      'vote',
      'username',
      'address',
      'forgingPK',
    ].forEach((sortKey: string) => {
      it('should honor orderBy ' + sortKey + ' asc param', async () => {
        return supertest(initializer.apiExpress)
          .get('/api/delegates/?orderBy=' + sortKey + ':asc')
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.true;
            expect(Array.isArray(response.body.delegates)).to.be.true;
            (expect(response.body.delegates).to.be as any).ascendingBy(sortKey);
          });
      });

      it('should honor orderBy ' + sortKey + ' desc param', async () => {
        return supertest(initializer.apiExpress)
          .get('/api/delegates/?orderBy=' + sortKey + ':desc')
          .expect(200)
          .then((response) => {
            expect(response.body.success).is.true;
            expect(Array.isArray(response.body.delegates)).to.be.true;
            (expect(response.body.delegates).to.be as any).descendingBy(
              sortKey
            );
          });
      });
    });

    it('should honor limit param', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/?limit=10')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(Array.isArray(response.body.delegates)).to.be.true;
          expect(response.body.delegates.length).to.be.equal(10);
        });
    });

    it('should honor offset param', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/?offset=30')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(Array.isArray(response.body.delegates)).to.be.true;
          expect(response.body.delegates.length).to.be.equal(71);
        });
    });
  });

  describe('/fee', () => {
    checkIntParam('height', '/api/delegates/fee', { min: 1 });
    checkReturnObjKeyVal('fromHeight', 1, '/api/delegates/fee');
    checkReturnObjKeyVal('toHeight', null, '/api/delegates/fee');
    checkReturnObjKeyVal('height', 103, '/api/delegates/fee');

    it('should return fee value for delegate', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/fee')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.fee).to.be.deep.equal('2500000000');
        });
    });
  });

  describe('/rewards', () => {
    checkIntParam(
      'from',
      '/api/delegates/rewards?username=genesisDelegate32&from=0&to=1'
    );
    checkIntParam(
      'to',
      '/api/delegates/rewards?username=genesisDelegate32&from=0&to=1'
    );
    // check(
    //   'username',
    //   '/api/delegates/rewards'
    // );

    it('should return 404 if delegate not found', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/rewards?username=MEOW&from=0&to=1')
        .expect(404);
    });

    it('should calculate the total forged amount', async () => {
      const now = Date.now() / 1000;
      const thaEpoch = initializer.appManager.container.get<ITimeToEpoch>(
        Symbols.helpers.timeToEpoch
      );
      return (
        supertest(initializer.apiExpress)
          .get(
            `/api/delegates/rewards?username=genesisDelegate32&from=${thaEpoch.fromTimeStamp(
              0
            ) / 1000}&to=${now}`
          )
          // .expect(200)
          .then((response) => {
            expect(response.body).deep.eq({
              success: true,
              cumulative: {
                fees: '0',
                rewards: '1500000000',
                totalBlocks: 1,
              },
              details: [
                {
                  forgingKey:
                    'b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3',
                  fromHeight: 1,
                  fees: '0',
                  rewards: '1500000000',
                  totalBlocks: 1,
                },
              ],
            });
          })
      );
    });

    it('should calculate the forged amount accounting start and end', async () => {
      const start = new Date(new Date().getTime() - 1000).getTime() / 1000;
      const end = new Date().getTime() / 1000;
      return (
        supertest(initializer.apiExpress)
          .get(
            '/api/delegates/rewards?from=' +
              start +
              '&to=' +
              end +
              '&username=genesisDelegate32'
          )
          // .expect(200)
          .then((response) => {
            expect(response.body.success).is.true;
            expect(response.body.cumulative).to.deep.eq({
              fees: '0',
              rewards: '0',
              totalBlocks: 0,
            });
            expect(response.body.details).deep.eq([
              {
                forgingKey:
                  'b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3',
                fromHeight: 1,
                fees: '0',
                rewards: '0',
                totalBlocks: 0,
              },
            ]);
          })
      );
    });

    it('when delegate has different forging PublicKey it should properly work', async function() {
      this.timeout(1000000);
      const blocksModule = initializer.appManager.container.get<IBlocksModule>(
        Symbols.modules.blocks
      );
      const delegateInfo = findDelegateByUsername('genesisDelegate32');
      const delegateWallet = {
        ...Rise.deriveKeypair(delegateInfo.secret),
        address: delegateInfo.address,
      };

      // change publicKey.
      const acct = createRandomWallet();
      // change delegate forgingPK.
      const tx = await createRegDelegateTransactionV2(
        delegateWallet,
        null,
        acct.publicKey
      );

      await confirmTransactions([tx], false);

      tempDelegateWallets[acct.publicKey.toString('hex')] = {
        ...acct,
        origPK: delegateWallet.publicKey.toString('hex'),
      };
      // STILL WITH OLD
      await initializer.goToNextRound();
      // MINE 3
      await initializer.goToNextRound();
      await initializer.goToNextRound();
      await initializer.goToNextRound();

      const epoch = initializer.appManager.container.get<ITimeToEpoch>(
        Symbols.helpers.timeToEpoch
      );

      const start = Math.floor(epoch.fromTimeStamp(0) / 1000);
      const end = Math.floor(epoch.fromTimeStamp(epoch.getTime()) / 1000);
      const response = await supertest(initializer.apiExpress)
        .get(
          `/api/delegates/rewards?username=genesisDelegate32&from=${start}&to=${end}`
        )
        .expect(200);

      expect(response.body).deep.eq({
        success: true,
        cumulative: { fees: '0', rewards: '7500000000', totalBlocks: 5 },
        details: [
          {
            forgingKey:
              'b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3',
            fromHeight: 1,
            fees: '0',
            rewards: '3000000000',
            totalBlocks: 2,
          },
          {
            forgingKey: acct.publicKey.toString('hex'),
            fromHeight: 103,
            fees: '0',
            rewards: '4500000000',
            totalBlocks: 3,
          },
        ],
      });

      delete tempDelegateWallets[acct.publicKey.toString('hex')];

      await initializer.goToPrevRound();
      await initializer.goToPrevRound();
      await initializer.goToPrevRound();
      await initializer.goToPrevRound();
      await initializer.goToPrevRound();

      // clean up vote accounting ....
      await initializer.rawDeleteBlocks(1);
      await initializer.goToNextRound();
    });
  });

  describe('/get', () => {
    // checkPubKey('publicKey', '/api/delegates/get');

    it('should return delegate object by username', async () => {
      const blocksModule = initializer.appManager.container.get<IBlocksModule>(
        Symbols.modules.blocks
      );
      return supertest(initializer.apiExpress)
        .get('/api/delegates/get?username=genesisDelegate32')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body).deep.eq({
            success: true,
            account: {
              address: '15048500907174916103R',
              balance: '108912391000000',
              cmb: 0,
              missedBlocks: 1,
              producedBlocks: 1,
              rewards: '1500000000',
              username: 'genesisDelegate32',
              vote: '108912391000000',
              votesWeight: '108912391000000',
            },
            forgingPKs: [
              {
                forgingPK:
                  'b1cb14cd2e0d349943fdf4d4f1661a5af8e3c3e8b5868d428b9a383d47aa98c3',
                height: 1,
              },
            ],
            info: {
              approval: 0.99,
              productivity: 50,
              rankV1: 64,
              rankV2: 64,
            },
          });
        });
    });

    it('should throw delegate not found if delecate is not there', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/get?username=MEOW') // pk does not exist
        .expect(404)
        .then((response) => {
          expect(response.body.success).is.false;
          expect(response.body.error).to.be.equal('Delegate not found');
        });
    });
  });

  describe('/voters', () => {
    it('should fail if no username is provided');
    it('should return accounts that voted for delegate', async () => {
      const { wallet: newAcc } = await createRandomAccountWithFunds(1e10);
      await createVoteTransactionV1(
        1,
        newAcc,
        Buffer.from(
          'eec7460f47ea4df03cd28a7bc9017028477f247617346ba37b635ee13ef9ac44',
          'hex'
        ),
        true
      );

      return supertest(initializer.apiExpress)
        .get('/api/delegates/voters?username=genesisDelegate33')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.voters).to.be.deep.equal([
            {
              address: '14851457879581478143R',
              balance: '108912391000000',
            },
            {
              address: newAcc.address,
              balance: BigInt(1e10 - 1e8).toString(10) /* voting fees */,
            },
          ]);
        });
    });

    it('should return empty array if delegate does not exist', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/voters?username=test')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.voters).to.be.deep.equal([]);
        });
    });
  });

  describe('/search', () => {
    checkRequiredParam('q', '/api/delegates/search?q=haha');
    checkIntParam('limit', '/api/delegates/search?q=haha', {
      min: 1,
      max: 1000,
    });
    it('should return delegates array matching search criteria', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/search?q=33')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates).to.be.deep.equal([
            {
              username: 'genesisDelegate33',
              cmb: 0,
              address: '14851457879581478143R',
              forgingPK:
                'eec7460f47ea4df03cd28a7bc9017028477f247617346ba37b635ee13ef9ac44',
              vote: '108912391000000',
              votesWeight: '108912391000000',
              producedblocks: 1,
              missedblocks: 1,
              infos: {
                approval: 0.99,
                productivity: 50,
                rankV1: 82,
                rankV2: 82,
              },
            },
          ]);
        });
    });

    it('should honor limit parameter', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/search?q=genesis&limit=30')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.delegates.length).to.be.equal(30);
        });
    });
  });

  describe('/count', () => {
    checkReturnObjKeyVal('count', 101, '/api/delegates/count');
  });

  describe('/getNextForgers', () => {
    let curBlock: SignedAndChainedBlockType;
    let slots: Slots;
    let blocksModel: typeof BlocksModel;
    let blocksModule: IBlocksModule;
    let txModel: typeof TransactionsModel;
    beforeEach(async () => {
      blocksModule = initializer.appManager.container.get<IBlocksModule>(
        Symbols.modules.blocks
      );
      curBlock = blocksModule.lastBlock;
      blocksModel = initializer.appManager.container.getNamed<
        typeof BlocksModel
      >(ModelSymbols.model, Symbols.models.blocks);
      txModel = initializer.appManager.container.getNamed<
        typeof TransactionsModel
      >(ModelSymbols.model, Symbols.models.transactions);
      slots = initializer.appManager.container.get<Slots>(
        dPoSSymbols.helpers.slots
      );
    });

    it('should return current block', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/getNextForgers')
        .expect(200)
        .then((response) => {
          expect(response.body.success).is.true;
          expect(response.body.currentBlock).to.be.deep.equal(
            blocksModel.toStringBlockType(curBlock)
          );
        });
    });
    it('should return currentBlock slot', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/getNextForgers')
        .expect(200)
        .then((response) => {
          expect(response.body.currentBlockSlot).to.be.deep.equal(101);
        });
    });

    it('should return current slot (time)', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/getNextForgers')
        .expect(200)
        .then((response) => {
          expect(response.body.currentSlot).to.be.deep.equal(
            slots.getSlotNumber()
          );
        });
    });

    it('should return next delegates in line to forge', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/getNextForgers?limit=101')
        .expect(200)
        .then((response) => {
          expect(response.body.delegates.length).to.be.equal(slots.delegates);
        });
    });
  });

  describe('/forging/status', () => {
    let cfg: APIConfig;
    beforeEach(async () => {
      cfg = initializer.appManager.container.get(Symbols.generic.appConfig);
      cfg.api.access.restrictedWhiteList = ['127.0.0.1', '::ffff:127.0.0.1'];
    });

    checkPubKey('publicKey', '/api/delegates/forging/status');

    it('should disallow request from unallowed ip', async () => {
      cfg.api.access.restrictedWhiteList = [];
      return supertest(initializer.apiExpress)
        .get('/api/delegates/forging/status')
        .expect(403)
        .then((response) => {
          expect(response.body.error).to.be.equal('Private API access denied');
        });
    });

    it('should check for publicKey only if provided', async () => {
      return supertest(initializer.apiExpress)
        .get(
          '/api/delegates/forging/status?publicKey=241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14'
        )
        .expect(200)
        .then((response) => {
          expect(response.body).to.be.deep.equal({
            delegates: [
              '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
            ],
            enabled: false,
            success: true,
          });
        });
    });

    it('should return all enabled delegates to forge', async () => {
      return supertest(initializer.apiExpress)
        .get('/api/delegates/forging/status')
        .expect(200)
        .then((response) => {
          expect(response.body).to.be.deep.equal({
            delegates: [],
            enabled: false,
            success: true,
          });
        });
    });
  });

  describe('/forging/enable', () => {
    let cfg: APIConfig;
    beforeEach(async () => {
      cfg = initializer.appManager.container.get(Symbols.generic.appConfig);
      cfg.api.access.restrictedWhiteList = ['127.0.0.1', '::ffff:127.0.0.1'];
    });

    checkPostRequiredParam('secret', '/api/delegates/forging/enable', {
      publicKey:
        '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
    });
    checkPostPubKey('publicKey', '/api/delegates/forging/enable', {
      secret: 'aaa',
    });

    it('should disallow request from unallowed ip', async () => {
      cfg.api.access.restrictedWhiteList = [];
      return supertest(initializer.apiExpress)
        .post('/api/delegates/forging/enable')
        .expect(403)
        .then((response) => {
          expect(response.body.error).to.be.equal('Private API access denied');
        });
    });

    it('should throw error if given publicKey differs from computed pk', async () => {
      return supertest(initializer.apiExpress)
        .post('/api/delegates/forging/enable')
        .send({
          publicKey:
            '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
          secret: 'sensereduceweirdpluck',
        })
        .expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Invalid passphrase');
        });
    });

    it('should throw error if forging is already enabled for such account', async () => {
      return supertest(initializer.apiExpress)
        .post('/api/delegates/forging/enable')
        .send({
          publicKey:
            '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
          secret:
            'sense reduce weird pluck result business unable dust garage gaze business anchor',
        })
        .expect(200)
        .then((response) => {
          return supertest(initializer.apiExpress)
            .post('/api/delegates/forging/enable')
            .send({
              publicKey:
                '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
              secret:
                'sense reduce weird pluck result business unable dust garage gaze business anchor',
            })
            .expect(200)
            .then((res) => {
              expect(res.body.error).to.be.equal('Forging is already enabled');
            });
        });
    });

    it('should throw error if account is not found', async () => {
      // Key pair is valid but account does not exist
      return supertest(initializer.apiExpress)
        .post('/api/delegates/forging/enable')
        .send({
          publicKey:
            '0cf75c0afa655b7658d971765d4989d8553d639eeed57eaa45b1991b61db1856',
          secret:
            'unable dust garage gaze business anchor sense reduce weird pluck result business',
        })
        .expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Account not found');
        });
    });

    it('should throw error if account is not a delegate', async () => {
      // Transfer some funds to a new account from a delegate
      const secret =
        'business anchor sense reduce weird pluck result business unable dust garage gaze';
      const wallet = createWallet(secret);
      const tx = await createSendTransactionV1(
        0,
        Math.ceil(Math.random() * 100),
        getRandomDelegateWallet(),
        wallet.address
      );
      await confirmTransactions([tx], false);
      // Try to enable forging on this new non-delegate account
      return supertest(initializer.apiExpress)
        .post('/api/delegates/forging/enable')
        .send({
          publicKey: wallet.publicKey.toString('hex'),
          secret,
        })
        .expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Account not found');
        });
    });
  });

  describe('/forging/disable', () => {
    let cfg: APIConfig;
    beforeEach(async () => {
      cfg = initializer.appManager.container.get(Symbols.generic.appConfig);
      cfg.api.access.restrictedWhiteList = ['127.0.0.1', '::ffff:127.0.0.1'];
    });

    checkPostRequiredParam('secret', '/api/delegates/forging/disable', {});
    checkPostPubKey('publicKey', '/api/delegates/forging/disable', {
      secret: 'aaa',
    });

    it('should disallow request from unallowed ip', async () => {
      cfg.api.access.restrictedWhiteList = [];
      return supertest(initializer.apiExpress)
        .post('/api/delegates/forging/disable')
        .expect(403)
        .then((response) => {
          expect(response.body.error).to.be.equal('Private API access denied');
        });
    });

    it('should throw error if given publicKey differs from computed pk', async () => {
      return supertest(initializer.apiExpress)
        .post('/api/delegates/forging/disable')
        .send({
          publicKey:
            '241cca788519fd0913265ebf1265d9d79eded91520d62b8c1ce700ebd15aff14',
          secret: 'sensereduceweirdpluck',
        })
        .expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Invalid passphrase');
        });
    });

    it('should throw error if forging is already disabled for such account', async () => {
      return supertest(initializer.apiExpress)
        .post('/api/delegates/forging/disable')
        .send({
          publicKey:
            '21ba4bd249c3369c1a1c15a2f309ce993db9396c55d519f17d0138fafee36d66',
          secret:
            'chunk torch ice snow lunar cute school trigger portion gift home canal',
        })
        .expect(200)
        .then((res) => {
          return supertest(initializer.apiExpress)
            .post('/api/delegates/forging/disable')
            .send({
              publicKey:
                '21ba4bd249c3369c1a1c15a2f309ce993db9396c55d519f17d0138fafee36d66',
              secret:
                'chunk torch ice snow lunar cute school trigger portion gift home canal',
            })
            .expect(200)
            .then((resp) => {
              expect(resp.body.error).to.be.equal(
                'Forging is already disabled'
              );
            });
        });
    });

    it('should throw error if account is not found', async () => {
      const forgeModule = initializer.appManager.container.get<ForgeModule>(
        dPoSSymbols.modules.forge
      );
      forgeModule.enableForge({
        privateKey: Buffer.from('aaaa', 'hex') as Buffer & As<'privateKey'>,
        publicKey: Buffer.from(
          'b7717adf51800bce03b1aebdad444220734c423f0014944bfcdb8d615641c61e',
          'hex'
        ) as Buffer & As<'publicKey'>,
      });
      // Key pair is valid but account does not exist
      return supertest(initializer.apiExpress)
        .post('/api/delegates/forging/disable')
        .send({
          publicKey:
            'b7717adf51800bce03b1aebdad444220734c423f0014944bfcdb8d615641c61e',
          secret:
            'pluck result dust unable garage gaze business anchor sense reduce weird business',
        })
        .expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Account not found');
        });
    });

    it('should throw error if account is not a delegate', async () => {
      // Transfer some funds to a new account from a delegate
      const secret =
        'dust pluck sense reduce weird pluck result business unable dust sense gaze';
      const wallet = createWallet(secret);
      const tx = await createSendTransactionV1(
        0,
        Math.ceil(Math.random() * 100),
        getRandomDelegateWallet(),
        wallet.address
      );
      await confirmTransactions([tx], false);
      const forgeModule = initializer.appManager.container.get<ForgeModule>(
        dPoSSymbols.modules.forge
      );
      forgeModule.enableForge({
        privateKey: Buffer.from('aaaa', 'hex') as Buffer & As<'privateKey'>,
        publicKey: wallet.publicKey,
      });
      // Try to disable forging on this new non-delegate account
      return supertest(initializer.apiExpress)
        .post('/api/delegates/forging/disable')
        .send({
          publicKey: wallet.publicKey.toString('hex'),
          secret,
        })
        .expect(200)
        .then((response) => {
          expect(response.body.error).to.be.equal('Account not found');
        });
    });
  });
});
