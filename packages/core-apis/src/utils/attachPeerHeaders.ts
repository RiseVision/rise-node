import { IoCSymbol, Symbols } from '@risevision/core-helpers';
import { ISystemModule } from '@risevision/core-interfaces';
import * as express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';

@Middleware({ type: 'before' })
@injectable()
@IoCSymbol(Symbols.api.utils.attachPeerHeaderToResponseObject)
export class AttachPeerHeaders implements ExpressMiddlewareInterface {

  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;

  public use(request: express.Request, response: express.Response, next: (err?: any) => any) {
    response.set(this.systemModule.headers);
    next();
  }

}
