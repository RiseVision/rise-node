export interface IBus {
  message(what: 'syncStarted');
  message(what: 'unconfirmedTransaction', transaction: any, broadcast: any);
}
