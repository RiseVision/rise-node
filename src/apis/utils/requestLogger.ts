import * as express from 'express';
import { WriteStream } from 'fs';
import * as fs from 'fs';
import { inject, injectable } from 'inversify';
import { ExpressMiddlewareInterface, Middleware } from 'routing-controllers';
import { ILogger } from '../../helpers';
import { IoCSymbol } from '../../helpers/decorators/iocSymbol';
import { IBlocksModule } from '../../ioc/interfaces/modules';
import { Symbols } from '../../ioc/symbols';
import { AppConfig } from '../../types/genericTypes';

const startHRTime = process.hrtime();

// tslint:disable-next-line
export type RequestLoggerEntry = {
  height: number
  now: number
  fromStart: [number, number]
  req: {
    body: any
    headers: any
    query: any
    url: string
  }
};

@Middleware({ type: 'before' })
@injectable()
@IoCSymbol(Symbols.api.utils.requestLogger)
export class RequestLogger implements ExpressMiddlewareInterface {

  @inject(Symbols.generic.appConfig)
  private appConfig: AppConfig;
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;

  private isEnabled: boolean;
  private logStream: WriteStream;
  private minHeight: number;

  constructor() {
    this.isEnabled = this.appConfig.requestLogger.enabled;
    if (this.isEnabled) {
      try {
        this.logStream = fs.createWriteStream(this.appConfig.requestLogger.logFileName, {flags: 'a'});
      } catch (err) {
        this.logger.error('requestLogger: error creating write stream', err.stack);
        this.isEnabled = false;
      }
      this.minHeight = this.appConfig.requestLogger.minHeight || 0;
    }
  }

  public use(request: express.Request, response: express.Response, next: (err?: any) => any) {
    // process.hrtime returns a [seconds, nanoseconds] tuple
    const elapsed = process.hrtime(startHRTime);
    if (this.shouldLog(request)) {
      this.log(request, elapsed);
    }
    next();
  }

  private shouldLog(req: express.Request): boolean {
    if (!this.isEnabled || this.minHeight > this.blocksModule.lastBlock.height || req.method.toLowerCase() !== 'post') {
      return false;
    }
    const validUrls = ['/peer/signatures', '/peer/transactions', '/peer/blocks'].filter(
      (prefix) => req.url.startsWith(prefix)
    );
    return validUrls.length === 1;
  }

  private log(req: express.Request, elapsed: [number, number]) {
    const lineObj: RequestLoggerEntry = {
      height: this.blocksModule.lastBlock.height,
      now: Date.now(),
      fromStart: elapsed,
      req: {
        body: req.body,
        headers: req.headers,
        query: req.query,
        url: req.url,
      },
    };
    const lineStr = JSON.stringify(lineObj) + "\n";
    this.logStream.write(lineStr);
  }
}