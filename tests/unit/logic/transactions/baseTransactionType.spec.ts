import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import { TransactionType } from '../../../../src/helpers';
import { BaseTransactionType, IBaseTransaction, IConfirmedTransaction } from '../../../../src/logic/transactions';

chai.use(chaiAsPromised);

const expect = chai.expect;

class TestTransactionType extends BaseTransactionType<any> {
  // Implement abstract methods only
  public calculateFee(tx: IBaseTransaction<any>, sender: any, height: number): number {
    return undefined;
  }

  public objectNormalize(tx: IBaseTransaction<any>): IBaseTransaction<any> {
    return undefined;
  }

  public dbRead(raw: any): any {
    return undefined;
  }

  public dbSave(tx: IConfirmedTransaction<any> & { senderId: string }): any {
    return undefined;
  }
}

// tslint:disable no-unused-expression
describe('logic/transactions/baseTransactionType', () => {
  let instance: TestTransactionType;
  let tx: any;
  let sender: any;

  beforeEach(() => {
    instance = new TestTransactionType(1);
    tx       = {
      amount         : 0,
      asset          : {},
      fee            : 10,
      id             : '8139741256612355994',
      senderId       : '1233456789012345R',
      senderPublicKey: '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3',
      signatures     : ['sig1', 'sig2'],
      timestamp      : 0,
      type           : TransactionType.MULTI,
    };

    sender = {
      address  : '1233456789012345R',
      balance  : 10000000,
      publicKey: '6588716f9c941530c74eabdf0b27b1a2bac0a1525e9605a37e6c0b3817e58fe3',
    };
  });

  describe('constructor', () => {
    it('should assign the passed txtype to this.type', () => {
      expect(instance.type).to.be.equal(1);
    });
  });

  describe('ready', () => {
    it('should return true if sender multisignatures is not an array or sender.multisignatures is empty', () => {
      sender.multisignatures = 'multisig';
      expect(instance.ready(tx, sender)).to.be.true;
      sender.multisignatures = [];
      expect(instance.ready(tx, sender)).to.be.true;
    });

    it('should return false if sender multisignatures is a non-empty array but tx.signatures not an array', () => {
      sender.multisignatures = ['sig1', 'sig2'];
      tx.signatures          = 'notAnArray';
      expect(instance.ready(tx, sender)).to.be.false;
    });

    it('should return true if sender multisignatures and tx.signatures length is more or equal to multimin', () => {
      sender.multisignatures = ['sig1', 'sig2'];
      tx.signatures          = ['txSig1', 'txSig2', 'txSig3'];
      sender.multimin        = 2;
      expect(instance.ready(tx, sender)).to.be.true;
    });

    it('should return false if sender multisignatures and tx.signatures length is less than multimin', () => {
      sender.multisignatures = ['sig1', 'sig2'];
      tx.signatures          = ['txSig1', 'txSig2', 'txSig3'];
      sender.multimin        = 10;
      expect(instance.ready(tx, sender)).to.be.false;
    });
  });

  describe('verify', () => {
    it('should resolve', () => {
      expect(instance.verify(tx, sender)).to.be.fulfilled;
    });
  });

  describe('process', () => {
    it('should resolve', () => {
      expect(instance.process(tx, sender)).to.be.fulfilled;
    });
  });

  describe('getBytes', () => {
    it('should return emptyBuffer', () => {
      expect(instance.getBytes(tx, false, false)).to.be.deep.equal(new Buffer(0));
    });
  });

  describe('apply', () => {
    it('should resolve', () => {
      expect(instance.apply(tx, {} as any, sender)).to.be.fulfilled;
    });
  });

  describe('applyUnconfirmed', () => {
    it('should resolve', () => {
      expect(instance.applyUnconfirmed(tx, sender)).to.be.fulfilled;
    });
  });

  describe('undo', () => {
    it('should resolve', () => {
      expect(instance.undo(tx, {} as any, sender)).to.be.fulfilled;
    });
  });

  describe('undoUnconfirmed', () => {
    it('should resolve', () => {
      expect(instance.undoUnconfirmed(tx, sender)).to.be.fulfilled;
    });
  });

  describe('afterSave', () => {
    it('should resolve', () => {
      expect(instance.afterSave(tx)).to.be.fulfilled;
    });
  });

  describe('restoreAsset', () => {
    it('should resolve', () => {
      expect(instance.restoreAsset(tx, {} as any)).to.be.fulfilled;
    });
  });
});
