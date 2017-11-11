export interface IBus {
  message(what: 'blockchainReady');
  message(what: 'syncStarted');
  message(what: 'unconfirmedTransaction', transaction: any, broadcast: any);
}
