import * as Long from 'long';

export class Longnum {

  public static fromBuffer(buf: Buffer): Long {
    const intList = [];
    for (const value of buf) {
      intList.push(value);
    }
    return Long.fromBytes(intList, true);
  }
}
