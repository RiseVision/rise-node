import { injectable } from 'inversify';

import { BaseStubClass } from '../BaseStubClass';
import { spyMethod, stubMethod } from '../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class ByteBufferStub extends BaseStubClass {
  /**
   * Allows to get all data pushed by the methods writing to the ByteBuffer in the right sequence
   */
  public sequence: any[];
  public capacity;
  public littleEndian;
  public noAssert;

  public constructor(capacity?: number, littleEndian?: boolean, noAssert?: boolean) {
    super();
    this.capacity = capacity ? capacity : 16;
    this.sequence = [];
  }

  @spyMethod
  public writeByte(b) {
    this.sequence.push(b);
  }

  @spyMethod
  public writeInt(i) {
    this.sequence.push(i);
  }

  @spyMethod
  public writeLong(l) {
    this.sequence.push(l);
  }

  @spyMethod
  public flip() {
  }

  @stubMethod()
  public toBuffer() {
  }

  // TODO Add more methods when needed
}
