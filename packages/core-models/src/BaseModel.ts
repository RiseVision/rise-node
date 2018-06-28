import { Container } from 'inversify';

export class BaseModel<T> {
  public static container: Container;
  public static options: any;
}
