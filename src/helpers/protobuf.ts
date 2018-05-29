import * as fs from 'fs';
import { inject, injectable, postConstruct } from 'inversify';
import * as path from 'path';
import * as protobuf from 'protobufjs';
import { Root, Type } from 'protobufjs';
import { Symbols } from '../ioc/symbols';
import { ILogger } from './logger';

@injectable()
export class ProtoBufHelper {
  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  private messageTypes: { [k: string]: Root };

  @postConstruct()
  public init() {
    this.loadProtos();
  }

  public validate(payload: any, namespace: string, messageType?: string): boolean {
    const message = this.getMessageInstance(namespace, messageType);
    const result = message.verify(payload);
    if (result === null) {
      return true;
    } else {
      this.logger.error(result);
      return false;
    }
  }

  public encode(payload: any, namespace: string, messageType?: string): Buffer {

  }

  public decode(data: Buffer, namespace: string, messageType?: string): any {

  }

  private getMessageInstance(namespace:string, messageType?: any): Type {
    const typeToLookup = messageType ? `${namespace}.${messageType}` : `${namespace}.${namespace}`;
    if (typeof this.messageTypes[namespace] !== 'undefined') {
      return this.messageTypes[namespace].lookupType(typeToLookup;
    } else {
      this.logger.error(`Unable to find ProtoBuf with package ${namespace} and messageType ${messageType}`);
    }
  }

  private loadProtos() {
    const files = fs.readdirSync('./proto/');
    files.forEach((filePath: string) => {
      if (filePath.match(/\.proto$/)) {
        const namespace = path.basename(filePath, '.proto');
        protobuf.load(filePath, (err: Error, root: Root) => {
          if (err) {
            this.logger.error(err.message);
            throw err;
          } else {
            this.messageTypes[namespace] = root;
          }
        });
      }
    });
  }
}
