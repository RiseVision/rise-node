import { dposAPI } from 'dpos-api-wrapper';
import { LiskWallet } from 'dpos-offline';
import * as moment from 'moment';
import { createSendTransaction, createVoteTransaction } from '../tests/utils/txCrafter';

const secrets = require('../etc/devnet/config.json').forging.secret;

const nodes = [
  'http://localhost:10001',
  'http://localhost:10002',
  'http://localhost:10003',
  'http://localhost:10004',
  'http://localhost:10005',
];

const wrappers = nodes.map((node) => dposAPI.newWrapper(node, { timeout: 100000 }));

async function broadcast() {
  await Promise.all(wrappers.map((w) => w.buildTransport()));

  for (let i = 0; i < 1000; i++) {
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
    console.log(tx.id, nodes[i % wrappers.length]);
    wrappers[i % wrappers.length].buildTransport()
      .then((t) => t.postTransaction(tx));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function broadcastVote(add: boolean) {
  await Promise.all(wrappers.map((w) => w.buildTransport()));

  for (let i = 0; i < 101; i++) {
    const wallet = new LiskWallet(secrets[i % secrets.length], 'R');
    const tx   = createVoteTransaction(
      wallet,
      100000000,
      {
        asset    : {
          votes: [
            `${add ? '+' : '-'}${wallet.publicKey}`,
          ],
        },
        amount   : 0,
        timestamp: moment.utc()
          .diff(
            new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
            'seconds'
          ),
      }
    );
    const wrapper = wrappers[i % wrappers.length];
    console.log(tx.id, nodes[i % wrappers.length]);
    wrappers[i % wrappers.length].buildTransport()
      .then((t) => t.postTransaction(tx));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

broadcastVote(false).then(() => {
  console.log('DONE')
});
