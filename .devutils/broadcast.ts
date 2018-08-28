import { dposAPI } from 'dpos-api-wrapper';
import { LiskWallet, SendTx } from 'dpos-offline';
import * as moment from 'moment';
import { createSendTransaction, createVoteTransaction } from '../tests/utils/txCrafter';
const cfg = require('../etc/devnet/config.json');

const nodes = [
  'http://localhost:10001',
  'http://localhost:10002',
  'http://localhost:10003',
  'http://localhost:10004',
  'http://localhost:10005',
];

const wrappers = nodes.map((node) => dposAPI.newWrapper(node, {timeout: 100000}));

async function broadcast() {
  await Promise.all(wrappers.map((w) => w.buildTransport()));

  for (let i = 0; i < 200; i++) {
    const tx = createSendTransaction(
      new LiskWallet('diamond grain object regular enact tool gadget recipe cactus neutral nominee exile', 'R'),
      '1R',
      10000000,
      {
        amount   : Math.floor(Math.random() * 10000000) + 1,
        timestamp: moment.utc()
          .diff(
            new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
            'seconds'
          ),
      }
    );
    console.log(i);
    wrappers[i % wrappers.length].buildTransport()
      .then((t) => t.postTransaction(tx));

  }
}

async function broadcastVotes(add: boolean) {
  await Promise.all(wrappers.map((w) => w.buildTransport()));
  const delegateSecrets = cfg.forging.secret;
  for (let i = 0; i < delegateSecrets.length; i++) {
    const delegate = new LiskWallet(delegateSecrets[i], 'R');
    const tx = createVoteTransaction(
      delegate,
      100000000,
      {
        amount: 0,
        timestamp: moment.utc()
          .diff(
            new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
            'seconds'
          ),
        asset: {votes: [`${add ? '+' : '-'}${delegate.publicKey}`]},
      }
    );
    console.log(i);
    wrappers[i % wrappers.length].buildTransport()
      .then((t) => t.postTransaction(tx));

  }
}

broadcastVotes(false).then(() => {
  console.log('done');
});