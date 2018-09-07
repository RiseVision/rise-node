import {
  IBlocksModule,
  IPeersModule,
  ITransportModule,
  Symbols
} from '@risevision/core-interfaces';
import { ConstantsType } from '@risevision/core-types';
import { IoCSymbol } from '@risevision/core-utils';
import { inject, injectable } from 'inversify';
import { ContentType, Controller, Get, UseBefore } from 'routing-controllers';
import { p2pSymbols, ProtoBufHelper, } from '../helpers';
import { AttachPeerHeaders, ValidatePeerHeaders } from './middlewares';

@Controller('/v2/peer')
@injectable()
@IoCSymbol(p2pSymbols.api.transportV2)
@UseBefore(ValidatePeerHeaders)
@UseBefore(AttachPeerHeaders)
@ContentType('application/octet-stream')
export class TransportV2API {
  @inject(Symbols.modules.blocks)
  private blocksModule: IBlocksModule;
  @inject(Symbols.generic.constants)
  private constants: ConstantsType;
  @inject(p2pSymbols.helpers.protoBuf)
  private protoBuf: ProtoBufHelper;
  @inject(Symbols.modules.peers)
  private peersModule: IPeersModule;
  @inject(Symbols.modules.transport)
  private transportModule: ITransportModule;

  @Get('/list')
  public async list() {
    const { peers } = await this.peersModule.list({ limit: this.constants.maxPeers });
    return this.getResponse({ peers }, 'p2p.peers', 'transportPeers');
  }

  @Get('/height')
  public async height() {
    return this.getResponse({ height: this.blocksModule.lastBlock.height }, 'p2p.height', 'height');
  }

  // TODO: Move in multisignatures.
  // @Get('/signatures')
  // public signatures() {
  //   const txs: Array<IBaseTransaction<any>> = this.transactionsModule
  //     .getMultisignatureTransactionList(true, this.constants.maxSharedTxs);
  //   const signatures                        = [];
  //   for (const tx of txs) {
  //     if (tx.signatures && tx.signatures.length > 0) {
  //       signatures.push({
  //         signatures : tx.signatures.map((sig) => {
  //           return Buffer.from(sig, 'hex');
  //         }),
  //         transaction: Long.fromString(tx.id),
  //       });
  //     }
  //   }
  //   return this.getResponse({ signatures }, 'transportSignatures', 'getSignaturesResponse');
  // }

  // @Post('/signatures')
  // public async postSignatures(@Body() body: Buffer) {
  //   // tslint:disable-next-line
  //   type Signature = { transaction: Long, signature?: Buffer };
  //   const obj = this.parseRequest<{ signatures?: Signature[], signature?: Signature }>
  //   (body, 'transportSignatures', 'postSignatures');
  //
  //   const signatures: Signature[] = [];
  //
  //   if (Array.isArray(obj.signatures)) {
  //     signatures.push(...obj.signatures);
  //   }
  //
  //   if (typeof(obj.signature) !== 'undefined' && obj.signature !== null) {
  //     signatures.push(obj.signature);
  //   }
  //
  //   assertValidSchema(this.schema, signatures, {
  //     obj : transportSchema.signatures.properties.signatures,
  //     opts: { errorString: 'Error validating schema.' },
  //   });
  //
  //   const finalSigs: Array<{ signature: string, transaction: string }> = [];
  //   for (const sigEl of signatures) {
  //     finalSigs.push({
  //       signature  : sigEl.signature.toString('hex'),
  //       transaction: sigEl.transaction.toString(),
  //     });
  //   }
  //
  //   await this.transportModule.receiveSignatures(finalSigs);
  //
  //   return this.getResponse({ success: true }, 'APISuccess');
  // }

  // @Get('/transactions')
  // public transactions() {
  //   const transactions                 = this.transactionsModule.getMergedTransactionList(this.constants.maxSharedTxs);
  //   const tmpPT                        = this.ptFactory({ data: { transactions } });
  //   const byteTxs: IBytesTransaction[] = transactions
  //     .map((tx) => tmpPT.generateBytesTransaction(tx))
  //     .map((bt) => {
  //       delete bt.relays;
  //       return bt;
  //     });
  //   return this.getResponse({ transactions: byteTxs }, 'transportTransactions');
  // }
  //
  // @Post('/transactions')
  // public async postTransactions(@Req() req: Request) {
  //   let transactions  = [];
  //   const requestData = this.parseRequest<any>(req.body, 'transportTransactions');
  //   if (typeof requestData.transaction !== 'undefined' && requestData.transaction !== null) {
  //     transactions = [requestData.transaction];
  //   } else {
  //     transactions = requestData.transactions ? requestData.transactions : [];
  //   }
  //   const thePeer = this.peersLogic.create({
  //     ip  : req.ip,
  //     port: parseInt(req.headers.port as string, 10),
  //   });
  //
  //   if (transactions.length > 0) {
  //     await this.transportModule.receiveTransactions(transactions.map(
  //       (tx: IBytesTransaction) =>
  //         this.TransactionsModel.toTransportTransaction(this.transactionLogic.fromBytes(tx))
  //     ), thePeer, true);
  //   }
  //
  //   return this.getResponse({ success: true }, 'APISuccess');
  // }
  //

  private getResponse(payload: any, pbNamespace: string, pbMessageType?: string) {
    if (this.protoBuf.validate(payload, pbNamespace, pbMessageType)) {
      return this.protoBuf.encode(payload, pbNamespace, pbMessageType);
    } else {
      throw new Error('Failed to encode response - ' + this.protoBuf.lastError);
    }
  }

}
