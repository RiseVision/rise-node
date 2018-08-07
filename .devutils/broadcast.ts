import { dposAPI } from 'dpos-api-wrapper';
import { LiskWallet, SendTx } from 'dpos-offline';
import * as moment from 'moment';

const tx = new SendTx()
  .withAmount(1)
  .withFees(1e7)
  .withTimestamp(
    moment.utc()
      .diff(
        new Date(Date.UTC(2016, 4, 24, 17, 0, 0, 0)),
        'seconds'
      )
  )
  .withRecipientId('10745219827355437881R')
  .sign(new LiskWallet('insert seed here.', 'R'));

dposAPI.nodeAddress = 'https://twallet.rise.vision';
dposAPI.buildTransport()
  .then((t) => t.postTransaction(tx))
  .then(console.log);
