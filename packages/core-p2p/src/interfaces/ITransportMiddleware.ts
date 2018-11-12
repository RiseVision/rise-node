import { ExpressMiddlewareInterface } from 'routing-controllers';

export interface ITransportMiddleware extends ExpressMiddlewareInterface {
  readonly when: 'before' | 'after';
}
