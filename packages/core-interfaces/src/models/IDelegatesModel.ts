import { IBaseModel } from './IBaseModel';
import { ITransactionsModel } from './ITransactionsModel';

export class IDelegatesModel extends IBaseModel<IDelegatesModel> {
  public username: string;

  public transactionId: string;

  public transaction: ITransactionsModel = null;
}
