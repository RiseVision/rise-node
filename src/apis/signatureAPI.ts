import * as z_schema from 'z-schema';
import { Get, JsonController, QueryParam } from 'routing-controllers';
import { SchemaValid, ValidateSchema } from './baseAPIClass';
import { inject, injectable } from 'inversify';
import { Symbols } from '../ioc/symbols';
import { ISystemModule } from '../ioc/interfaces/modules';

@JsonController('/signatures')
@injectable()
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
