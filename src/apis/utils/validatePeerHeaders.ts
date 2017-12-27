import * as express from 'express';
import { inject, injectable } from 'inversify';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { castFieldsToNumberUsingSchema } from '../../helpers';
import { IoCSymbol } from '../../helpers/decorators/iocSymbol';
import { IPeersLogic } from '../../ioc/interfaces/logic';
import { IPeersModule, ISystemModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { BasePeerType } from '../../logic';
import transportSchema from '../../schema/transport';

@Middleware({ type: 'before' })
@injectable()
@IoCSymbol(Symbols.api.utils.validatePeerHeadersMiddleware)
export class ValidatePeerHeaders implements ExpressMiddlewareInterface {

  @inject(Symbols.generic.zschema)
  private schema: z_schema;
  @inject(Symbols.logic.peers)
  private peersLogic: IPeersLogic;

  @inject(Symbols.modules.system)
  private systemModule: ISystemModule;
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;

  public use(request: express.Request, response: any, next: (err?: any) => any) {
    castFieldsToNumberUsingSchema(
      transportSchema.headers,
      request.headers
    );
    if (!this.schema.validate(request.headers, transportSchema.headers)) {
      this.removePeer(request);
      return next(new Error(`${this.schema.getLastError().details[0].path
      } - ${this.schema.getLastErrors()[0].message}`));
    }
    if (!this.systemModule.networkCompatible(request.headers.nethash as string)) {
      this.removePeer(request);
      return next({
        expected: this.systemModule.getNethash(),
        message : 'Request is made on the wrong network',
        received: request.headers.nethash,
      });
    }

    if (!this.systemModule.versionCompatible(request.headers.version)) {
      this.removePeer(request);
      return next({
        expected: this.systemModule.getMinVersion(),
        message : 'Request is made from incompatible version',
        received: request.headers.version,
      });
    }
    const p = this.peersLogic.create(this.computeBasePeerType(request));
    p.applyHeaders(request.headers as any);
    this.peersModule.update(p);
    next();
  }

  private removePeer(request: express.Request) {
    this.peersLogic.remove(this.computeBasePeerType(request));
  }

  private computeBasePeerType(request: express.Request): BasePeerType {
    return { ip: request.ip, port: parseInt(request.headers.port as string, 10) };
  }
}
