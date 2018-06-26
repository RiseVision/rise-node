import { injectable } from 'inversify';

import { BaseStubClass } from '../../BaseStubClass';
import { stubMethod } from '../../stubDecorator';

// tslint:disable no-empty

@injectable()
export default class TransactionTypeStub extends BaseStubClass {
  public txType;

  constructor() {
    super();
    this.txType = 0;
  }

  public get type() {
    return this.txType;
  }

  @stubMethod()
  public calculateFee() {}

  @stubMethod()
  public verify() {}

  @stubMethod()
  public process() {}

  @stubMethod()
  public getBytes() {}

  @stubMethod()
  public apply() {}

  @stubMethod()
  public applyUnconfirmed() {}

  @stubMethod()
  public undo() {}

  @stubMethod()
  public undoUnconfirmed() {}

  @stubMethod()
  public objectNormalize() {}

  @stubMethod()
  public dbRead() {}

  @stubMethod()
  public dbSave() {}

  @stubMethod()
  public afterSave() {}

  @stubMethod()
  public ready() {}

}
