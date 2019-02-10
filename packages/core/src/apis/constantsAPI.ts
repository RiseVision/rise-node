import { IoCSymbol } from '@risevision/core-utils';
import { inject, injectable } from 'inversify';
import { Get, JsonController } from 'routing-controllers';
import { CoreSymbols } from '../symbols';
import * as _ from 'lodash';

@JsonController('/api/constants')
@IoCSymbol(CoreSymbols.api.constants)
@injectable()
export class ConstantsAPI {
  @inject(CoreSymbols.allConstants)
  private constants: any;

  @Get('/')
  public getConstants() {
    const allConstants = _.cloneDeep(this.constants);
    // Each root element is a module
    Object.keys(allConstants).forEach((outerKey) => {
      const moduleC = allConstants[outerKey];
      // Inner keys may be either an actual constant or module constants
      Object.keys(moduleC).forEach((innerKey) => {
        //If it is a module constants element, merge the constants to the outer object
        if (innerKey.match(/@.+\/.+/)) {
          const otherModuleC = moduleC[innerKey];
          allConstants[innerKey] = allConstants[innerKey] || {};
          allConstants[innerKey] = _.merge(allConstants[innerKey], otherModuleC);
          delete allConstants[outerKey][innerKey];
        }
      });
      // Delete empty items
      if (Object.keys(allConstants[outerKey]).length === 0) {
        delete allConstants[outerKey];
      }
    });
    return {
      constants: allConstants
    };
  }
}
