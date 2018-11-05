import { ILogger, ISequence, Symbols } from '@risevision/core-interfaces';
import { p2pSymbols, TransportModule } from '@risevision/core-p2p';
import { inject, injectable, named } from 'inversify';
import z_schema from 'z-schema';
import { MultisigSymbols } from './helpers';
import { MultisignaturesModule } from './multisignatures';
import { GetSignaturesRequest } from './p2p/';

const loaderSchema = require('../schema/loader.json');

@injectable()
export class MultisigLoader {
  @inject(Symbols.helpers.logger)
  private logger: ILogger;

  @inject(Symbols.generic.zschema)
  private schema: z_schema;

  @inject(Symbols.modules.transport)
  private transportModule: TransportModule;

  @inject(Symbols.helpers.sequence)
  @named(Symbols.names.helpers.balancesSequence)
  private defaultSequence: ISequence;

  @inject(MultisigSymbols.module)
  private multisigModule: MultisignaturesModule;

  @inject(p2pSymbols.transportMethod)
  @named(MultisigSymbols.p2p.getSignatures)
  private getSignaturesRequest: GetSignaturesRequest;

  /**
   * Loads pending multisignature transactions
   */
  private async loadSignatures() {
    this.logger.log('Loading signatures');
    const res = await this.transportModule.getFromRandomPeer(
      {},
      this.getSignaturesRequest,
      {}
    );

    // TODO: lerna This should be in getSignature request
    if (!this.schema.validate(res, loaderSchema.loadSignatures)) {
      throw new Error('Failed to validate /signatures schema');
    }

    const { signatures } = res;

    // Process multisignature transactions and validate signatures in sequence
    await this.defaultSequence.addAndPromise(async () => {
      for (const multiSigTX of signatures) {
        for (const signature of multiSigTX.signatures) {
          try {
            await this.multisigModule.onNewSignature({
              relays: Number.MAX_SAFE_INTEGER,
              signature,
              transaction: multiSigTX.transaction,
            });
          } catch (err) {
            this.logger.warn(
              `Cannot process multisig signature for ${
                multiSigTX.transaction
              } `,
              err
            );
          }
        }
      }
      return void 0;
    });
  }
}
