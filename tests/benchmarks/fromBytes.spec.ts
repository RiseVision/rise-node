import { Container } from 'inversify';
import * as Long from 'long';
import { BlockLogic, TransactionLogic } from '../../src/logic';
import initializer from '../integration/common/init';
import { createFakeBlock } from '../utils/blockCrafter';
import { createRandomTransactions, toBufferedTransaction } from '../utils/txCrafter';
import { reportedIT } from './benchutils';
import { IBlockLogic, ITransactionLogic } from '../../src/ioc/interfaces/logic';
import { Symbols } from '../../src/ioc/symbols';
import { IBaseTransaction, IBytesTransaction } from '../../src/logic/transactions';

class SimpleMicroSecondTimer {
  private startTime: [number, number];
  private intermediate: { [k: string]: [number, number]};
  public start() {
    this.startTime = process.hrtime();
    this.intermediate = {};
    this.intermediate.start = this.startTime;
  }

  public elapsed(label?: string): number {
    label = label || '_step_' + Object.keys(this.intermediate).length;
    const now = process.hrtime(this.startTime);
    this.intermediate[label] = now;
    return now[0] * 1000000 + now[1] / 1000;
  }

  public getAllSteps(): {[k: string]: number} {
    const toRet = {};
    Object.keys(this.intermediate).forEach((key, index) => {
      let microseconds = 0;
      if (key !== 'start')  {
        microseconds = this.intermediate[key][0] * 1000000 + this.intermediate[key][1] / 1000;
      }
      toRet[key] = microseconds;
    });
    return toRet;
  }

}

describe('FromBytes benchmark', function() {
  initializer.setup();
  this.timeout(1000000);
  let txLogic: ITransactionLogic;
  let blockLogic: IBlockLogic;

  before(() => {
    txLogic = initializer.appManager.container.get(Symbols.logic.transaction);
    blockLogic = initializer.appManager.container.get(Symbols.logic.block);
  });

  const getTxBytes = (transactions) => {
    return transactions
      .map((tx) => toBufferedTransaction(tx))
      .map((tx) => generateBytesTransaction(tx));
  };

  const generateBytesTransaction = (tx: IBaseTransaction<any>): IBytesTransaction => {
    return {
      bytes                : txLogic.getBytes(tx),
      fee                  : tx.fee,
      hasRequesterPublicKey: typeof tx.requesterPublicKey !== 'undefined' && tx.requesterPublicKey != null,
      hasSignSignature     : typeof tx.signSignature !== 'undefined' && tx.signSignature != null,
    };
  };

  describe('TransactionLogic.fromBytes', () => {
    const flavors = [1000];
    reportedIT('send', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const bytesTxs = getTxBytes(createRandomTransactions({
        send: txNum,
      }));
      console.log(`Created ${txNum} BytesTransactions`);
      timer.start();
      const realTxs = bytesTxs.map((tx) => txLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });

    reportedIT('vote', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const bytesTxs = getTxBytes(createRandomTransactions({
        vote: txNum,
      }));
      console.log(`Created ${txNum} BytesTransactions`);
      timer.start();
      const realTxs = bytesTxs.map((tx) => txLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });

    reportedIT('delegate', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const bytesTxs = getTxBytes(createRandomTransactions({
        delegate: txNum,
      }));
      console.log(`Created ${txNum} BytesTransactions`);
      timer.start();
      const realTxs = bytesTxs.map((tx) => txLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });

    reportedIT('signature', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const bytesTxs = getTxBytes(createRandomTransactions({
        signature: txNum,
      }));
      console.log(`Created ${txNum} BytesTransactions`);
      timer.start();
      const realTxs = bytesTxs.map((tx) => txLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });

    reportedIT('mixed', flavors, async (txNum: number) => {
      const timer = new SimpleMicroSecondTimer();
      const bytesTxs = getTxBytes(createRandomTransactions({
        delegate: txNum / 4,
        send: txNum / 4,
        signature: txNum / 4,
        vote: txNum / 4,
      }));
      console.log(`Created ${txNum} BytesTransactions`);
      timer.start();
      const realTxs = bytesTxs.map((tx) => txLogic.fromBytes(tx));
      return Promise.resolve(timer.elapsed() / txNum);
    });
  });
  describe('BlockLogic.fromBytes', () => {
    it('empty');
    it('with 1 tx');
    it('with 10 txs');
    it('with 25txs');
  });

});