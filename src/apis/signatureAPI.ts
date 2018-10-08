import { inject, injectable } from 'inversify';
import { Get, JsonController, Put, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { ResponseSchema, OpenAPI } from 'rc-openapi-gen';
import { DeprecatedEndpoint } from '../helpers/decorators/deprecatedEndpoint'
import { ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import sigSchema from '../schema/signatures';
import { md } from '../helpers/strings';

@JsonController('/api/signatures')
@injectable()
@IoCSymbol(Symbols.api.signatures)
export class SignaturesAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.modules.system)
  private system: ISystemModule;

  @Get('/fee')
  @OpenAPI({
    summary: "Get Signature Fee",
    description: md`
      Get the fee for adding a second signature at a certain height of the blockchain
      (omit the height for the current fee).
    `
  })
  @ResponseSchema('responses.signatures.fees')
  @ValidateSchema()
  public async fees(@SchemaValid(sigSchema.getFee, {castNumbers: true})
              @QueryParams()
                params: { height?: number }) {
    const feesForHeight = this.system.getFees(params.height);
    const {fees}        = feesForHeight;
    delete feesForHeight.fees;
    return {...feesForHeight, ...{fee: fees.secondsignature}};
  }

  @Put('/')
  @OpenAPI({
    summary: 'Add Signature',
    description: md`
      _**Deprecated**: Please use the [Transactions API](#tag/Transactions-API)_.
      Adds a second signature to an account
    `
  })
  @DeprecatedEndpoint()
  public async addSignature() {}
}
