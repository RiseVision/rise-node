import { reportedIT } from './benchutils';
import initializer from '../integration/common/init';
import { createFakeBlock } from '../utils/blockCrafter';
import { createSendTransaction, toBufferedTransaction } from '../utils/txCrafter';
import { generateAccount } from '../utils/accountsUtils';
import { Symbols } from '../../src/ioc/symbols';
import { createContainer } from '../utils/containerCreator';
import { z_schema } from '../../src/helpers/z_schema';

const without = {
  id        : 'Block',
  type      : 'object',
  properties: {
    id                  : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    height              : {
      type   : 'integer',
      minimum: 1,
    },
    blockSignature      : {
      type  : 'object',
      format: 'signatureBuf',
    },
    generatorPublicKey  : {
      type  : 'object',
      format: 'publicKeyBuf',
    },
    numberOfTransactions: {
      type   : 'integer',
      minimum: 0,
    },
    payloadHash         : {
      type  : 'object',
      format: 'sha256Buf',
    },
    payloadLength       : {
      type   : 'integer',
      minimum: 0,
    },
    previousBlock       : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    timestamp           : {
      type   : 'integer',
      minimum: 0,
    },
    totalAmount         : {
      type   : 'integer',
      minimum: 0,
    },
    totalFee            : {
      type   : 'integer',
      minimum: 0,
    },
    reward              : {
      type   : 'integer',
      minimum: 0,
    },
    transactions        : {
      type: 'array',
    },
    version             : {
      type   : 'integer',
      minimum: 0,
    },
  },
  required  : [
    'blockSignature',
    'generatorPublicKey',
    'height',
    'id',
    'numberOfTransactions',
    'payloadHash',
    'payloadLength',
    'previousBlock',
    'reward',
    'timestamp',
    'totalAmount',
    'totalFee',
    'transactions',
    'version',
  ],
};

const withConstraint = {
  id        : 'Block',
  type      : 'object',
  properties: {
    id                  : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 2,
    },
    height              : {
      type   : 'integer',
      minimum: 1,
    },
    blockSignature      : {
      type  : 'object',
      format: 'signatureBuf',
    },
    generatorPublicKey  : {
      type  : 'object',
      format: 'publicKeyBuf',
    },
    numberOfTransactions: {
      type   : 'integer',
      minimum: 0,
    },
    payloadHash         : {
      type  : 'object',
      format: 'sha256Buf',
    },
    payloadLength       : {
      type   : 'integer',
      minimum: 0,
    },
    previousBlock       : {
      type     : 'string',
      format   : 'id',
      minLength: 1,
      maxLength: 20,
    },
    timestamp           : {
      type   : 'integer',
      minimum: 0,
    },
    totalAmount         : {
      type   : 'integer',
      minimum: 0,
    },
    totalFee            : {
      type   : 'integer',
      minimum: 0,
    },
    reward              : {
      type   : 'integer',
      minimum: 0,
    },
    transactions        : {
      type       : 'array',
      uniqueItems: true,
    },
    version             : {
      type   : 'integer',
      minimum: 0,
    },
  },
  required  : [
    'blockSignature',
    'generatorPublicKey',
    'height',
    'id',
    'numberOfTransactions',
    'payloadHash',
    'payloadLength',
    'previousBlock',
    'reward',
    'timestamp',
    'totalAmount',
    'totalFee',
    'transactions',
    'version',
  ],
}

const flavors = new Array(2000 / 100).fill(null).map((_, idx) => (idx + 1) * 100);
describe('Schema', function () {
  this.timeout(1000000);

  let zschema: any;
  beforeEach(() => {
    const container = createContainer();
    container.rebind(Symbols.generic.zschema).toConstantValue(new z_schema({}));
    zschema         = container.get(Symbols.generic.zschema);
  });
  reportedIT('without uniqueItems', flavors, async (flavor: number) => {
    const acc   = generateAccount();
    const block = createFakeBlock({
      transactions: new Array(flavor).fill(null)
        .map((t, idx) => toBufferedTransaction(createSendTransaction(acc, '1R', 1, {amount: idx, timestamp: idx})))
    });

    const now = Date.now();
    for (let i = 0; i < 1000; i++) {
      zschema.validate( block, without);
    }
    return ((Date.now() - now) / 1000);
  });

  reportedIT('with uniqueItems', flavors, async (flavor: number) => {
    const acc   = generateAccount();
    const block = createFakeBlock({
      transactions: new Array(flavor).fill(null)
        .map((t, idx) => toBufferedTransaction(createSendTransaction(acc, '1R', 1, {amount: idx, timestamp: idx})))
    });

    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      zschema.validate(block, withConstraint);
    }
    return ((Date.now() - now) / 10);
  });

});
