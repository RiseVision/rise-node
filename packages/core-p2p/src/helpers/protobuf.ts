import { ICoreModule, LaunchpadSymbols } from '@risevision/core-launchpad';
import { ILogger, Symbols } from '@risevision/core-types';
import * as fs from 'fs';
import { inject, injectable, postConstruct } from 'inversify';
import * as path from 'path';
import * as protobuf from 'protobufjs';
import { IConversionOptions, Root, Type } from 'protobufjs';

export type MyConvOptions<T> = IConversionOptions & {
  postProcess?: (obj: T) => T;
};

@injectable()
export class ProtoBufHelper {
  public lastError: string;

  @inject(Symbols.helpers.logger)
  private logger: ILogger;
  private protos: { [k: string]: Root } = {};

  @inject(LaunchpadSymbols.coremodules)
  private modules: Array<ICoreModule<any>>;
  @postConstruct()
  public init() {
    this.autoLoadProtos();
  }

  /**
   * Verifies that payload satisfies the requirements of the message type definition
   * @param {object} payload The data to be transported via ProtoBuf
   * @param {string} namespace The proto file to load messages from
   * @param {string} messageType (optional) specific message type to lookup in the proto
   * @returns {boolean} true if message is verified, else false.
   */
  public validate(
    payload: object,
    namespace: string,
    messageType?: string
  ): boolean {
    const message = this.getMessageInstance(namespace, messageType);
    const result = message.verify(payload);
    if (result === null) {
      return true;
    } else {
      this.lastError = `Protobuf verify error [${namespace} ${messageType}]: ${result}`;
      this.logger.debug(
        `Protobuf verify error. ${result}`,
        JSON.stringify({ payload, namespace, messageType })
      );
      return false;
    }
  }

  /**
   * Encode Object to Protocol Buffer
   * @param {object} payload The data to be transported via ProtoBuf
   * @param {string} namespace The proto file to load messages from
   * @param {string} messageType (optional) specific message type to lookup in the proto
   * @returns {Buffer} a Buffer containing the ProtoBuf encoded data
   */
  public encode(payload: any, namespace: string, messageType?: string): Buffer {
    if (!this.validate(payload, namespace, messageType)) {
      return null;
    }
    const message = this.getMessageInstance(namespace, messageType);
    return message.encode(payload).finish() as Buffer;
  }

  /**
   * Decodes Protocol Buffer Data to message object
   * @param {Buffer} data ProtoBuf encoded data
   * @param {string} namespace The proto file to load messages from
   * @param {string} messageType (optional) specific message type to lookup in the proto
   * @returns {any}
   */
  public decode<T = any>(
    data: Buffer,
    namespace: string,
    messageType?: string
  ): T {
    const message = this.getMessageInstance(namespace, messageType);
    if (message !== null) {
      try {
        return message.decode(data) as any;
      } catch (e) {
        if (e instanceof protobuf.util.ProtocolError) {
          // e.instance holds the so far decoded message with missing required fields
          throw new Error(`ProtoBuf Protocol Error ${e.message}`);
        } else {
          // wire format is invalid
          throw new Error(`ProtoBuf Wire format invalid ${e.message}`);
        }
      }
    }
    return null;
  }

  /**
   * Decodes Protocol Buffer Data to message object then converts it to plain javascript object using the provided
   * conversion options
   * @param {Buffer} data
   * @param {IConversionOptions} converters
   * @param {string} namespace
   * @param {string} messType
   * @returns {T}
   */
  public decodeToObj<T = any>(
    data: Buffer,
    namespace: string,
    messType?: string,
    converters: MyConvOptions<T> = {}
  ): T {
    let message: T;
    let inst;
    let postProcess: (obj: T) => T = (a) => a;
    if (typeof converters.postProcess !== 'undefined') {
      postProcess = converters.postProcess;
      delete converters.postProcess;
    }
    try {
      inst = this.getMessageInstance(namespace, messType);
      message = this.decode(data, namespace, messType);
    } catch (e) {
      throw new Error(`decodeToObject error: ${e.message}`);
    }
    return postProcess(inst.toObject(message, converters));
  }

  public loadProto(filename: string, namespace: string) {
    if (typeof this.protos[namespace] !== 'undefined') {
      throw new Error(
        `Proto[${namespace}] already defined and redefinition attempted in ${filename}`
      );
    }
    let root: Root;
    try {
      root = protobuf.loadSync(filename);
      this.protos[namespace] = root;
    } catch (err) {
      this.logger.error(err.message);
      throw err;
    }
  }

  private getMessageInstance(namespace: string, messageType?: any): Type {
    const typeToLookup = messageType ? `${messageType}` : `${namespace}`;
    if (typeof this.protos[namespace] !== 'undefined') {
      let instance: Type;
      const proto = this.protos[namespace];
      try {
        instance = proto.lookupType(typeToLookup);
      } catch (e) {
        this.logger.error(
          `ProtoBuf: cannot find message ${typeToLookup} in ${namespace}`
        );
        return null;
      }
      return instance;
    } else {
      this.logger.error(
        `Unable to find ProtoBuf with package ${namespace} and messageType ${messageType}`
      );
    }
  }

  private autoLoadProtos() {
    for (const module of this.modules) {
      const protoDir = path.join(module.directory, 'proto');
      if (!fs.existsSync(protoDir)) {
        continue;
      }
      const files = fs.readdirSync(protoDir);
      files.forEach((filePath: string) => {
        if (filePath.match(/\.proto$/)) {
          const namespace = path.basename(filePath, '.proto');
          this.loadProto(path.join(protoDir, filePath), namespace);
        }
      });
    }
  }
}
