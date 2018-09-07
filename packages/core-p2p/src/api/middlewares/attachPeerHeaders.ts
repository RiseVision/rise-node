import { ISystemModule, Symbols } from '@risevision/core-interfaces';
import * as express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { IoCSymbol } from '@risevision/core-utils';
import { p2pSymbols } from '../../helpers';

@Middleware({ type: 'before' })
@injectable()
@IoCSymbol(p2pSymbols.api.attachPeerHeaders)
export class AttachPeerHeaders implements ExpressMiddlewareInterface {

  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  public use(request: express.Request, response: express.Response, next: (err?: any) => any) {
    response.set(this.systemModule.headers);
    next();
  }

}
