import { inject, injectable } from 'inversify';
import { Get, JsonController, QueryParam } from 'routing-controllers';
import * as z_schema from 'z-schema';
import { IoCSymbol } from '../helpers/decorators/iocSymbol';
import { SchemaValid, ValidateSchema } from '../helpers/decorators/schemavalidators';
import { ISystemModule } from '../ioc/interfaces/modules';
import { Symbols } from '../ioc/symbols';

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
  public fees(@QueryParam('height', { required: true }) @SchemaValid({ type: 'integer', minimum: 1 })height: number) {
    const feesForHeight = this.system.getFees(height);
    const { fees }      = feesForHeight;
    delete feesForHeight.fees;
    return { ...feesForHeight, ...{ fee: fees.secondsignature } };
  }

}
