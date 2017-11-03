export interface IBus {
  message(what: 'unconfirmedTransaction', transaction: any, broadcast: any);
}
