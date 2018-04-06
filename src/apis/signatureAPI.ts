import { inject, injectable } from 'inversify';
import { Get, JsonController, Put, QueryParams } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';
import sigSchema from '../schema/signatures';
import { DeprecatedAPIError } from './errors';

@JsonController('/api/signatures')
@injectable()
@IoCSymbol(Symbols.api.signatures)
export class SignaturesAPI {
  @inject(Symbols.generic.zschema)
  public schema: z_schema;
  @inject(Symbols.modules.system)
  private system: ISystemModule;

  @Get('/fee')
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
  public async addSignature() {
    throw new DeprecatedAPIError();
  }
}
