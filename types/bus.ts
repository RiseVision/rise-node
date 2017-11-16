export interface IBus {
  message(what: 'finishRound', round: number);
  message(what: 'blockchainReady');
  message(what: 'syncStarted');
  message(what: 'unconfirmedTransaction', transaction: any, broadcast: any);
}
