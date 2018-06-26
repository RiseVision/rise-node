import * as express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { IoCSymbol } from '../../helpers/decorators/iocSymbol';
import { ISystemModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';

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
