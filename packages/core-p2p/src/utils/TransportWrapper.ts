import { inject, injectable } from 'inversify';
import { p2pSymbols, ProtoBufHelper } from '../helpers';

export type WrappedTransportMessage = { success: false, error: string } |
  { success: true, wrappedResponse: Buffer };

@injectable()
export class TransportWrapper {

  @inject(p2pSymbols.helpers.protoBuf)
  private protoBufHelper: ProtoBufHelper;

  public async wrapResponse(r: WrappedTransportMessage): Promise<Buffer> {
    return this.protoBufHelper.encode(r, 'p2p.transport', 'transportMethod');
  }

  public async unwrapResponse(b: Buffer): Promise<WrappedTransportMessage> {
    return this.protoBufHelper.decode(b, 'p2p.transport', 'transportMethod');
  }
}
