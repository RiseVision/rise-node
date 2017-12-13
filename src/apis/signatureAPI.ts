import { Get, JsonController, QueryParam } from 'routing-controllers';
import { SystemModule } from '../system';
import { SchemaValid, ValidateSchema } from './baseAPIClass';

// TODO : this is not possible to create due to limitation of routing-controllers
// We'll need to set up dependency injection first to let this work properly.
@JsonController('/signatures')
export class SignaturesAPI {

  constructor(private system: SystemModule, public schema: any) {

  }

  @Get('/fee')
  @ValidateSchema({ isPromise: false })
  public fees(@QueryParam('height', { required: true }) @SchemaValid({ type: 'integer', minimum: 1 })height: number) {
    const feesForHeight = this.system.getFees(height);
    const { fees }      = feesForHeight;
    delete feesForHeight.fees;
    return { ...feesForHeight, ...{ fee: fees.secondsignature } };
  }

}
