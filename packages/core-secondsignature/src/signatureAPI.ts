import { DeprecatedAPIError } from '@risevision/core-apis';
import { ISystemModule, Symbols } from '@risevision/core-interfaces';
import { inject, injectable } from 'inversify';
import { Get, JsonController, Put, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { IoCSymbol, SchemaValid, ValidateSchema } from '@risevision/core-utils';
import { SigSymbols } from './symbols';

@JsonController('/api/signatures')
@injectable()
@IoCSymbol(SigSymbols.api)
export class SignaturesAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.modules.system)
  private system: ISystemModule;

  @Get('/fee')
  @ValidateSchema()
  public async fees(@SchemaValid(
    {
      id: 'signatures.getFee',
      type: 'object',
      properties: {
        height: {
          type: 'integer',
          minimum: 1,
        },
      },
    },
    { castNumbers: true }
  )
  @QueryParams()
  params: {
    height?: number;
  }) {
    const feesForHeight = this.system.getFees(params.height);
    const { fees } = feesForHeight;
    delete feesForHeight.fees;
    return { ...feesForHeight, ...{ fee: fees.secondsignature } };
  }

  @Put('/')
  public async addSignature() {
    throw new DeprecatedAPIError();
  }
}
