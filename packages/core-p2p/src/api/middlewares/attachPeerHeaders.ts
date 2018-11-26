import { ISystemModule, Symbols } from '@risevision/core-interfaces';
import { IoCSymbol } from '@risevision/core-utils';
import * as express from 'express';
import { inject, injectable } from 'inversify';
import { p2pSymbols } from '../../helpers';
import { ITransportMiddleware } from '../../interfaces/ITransportMiddleware';

@injectable()
@IoCSymbol(p2pSymbols.transportMiddlewares.attachPeerHeaders)
export class AttachPeerHeaders implements ITransportMiddleware {
  public when: 'before' = 'before';

  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  public use(
    request: express.Request,
    response: express.Response,
    next: (err?: any) => any
  ) {
    response.set(this.systemModule.headers);
    next();
  }
}
