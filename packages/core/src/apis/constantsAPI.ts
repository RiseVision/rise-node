import { ICoreModule, LaunchpadSymbols } from '@risevision/core-launchpad';
import { IoCSymbol } from '@risevision/core-utils';
import { inject, injectable } from 'inversify';
import { Get, JsonController } from 'routing-controllers';
import { CoreSymbols } from '../symbols';
import * as _ from 'lodash';

@JsonController('/api/constants')
@IoCSymbol(CoreSymbols.api.constants)
@injectable()
export class ConstantsAPI {
  @inject(LaunchpadSymbols.coremodules)
  private coremodules: Array<ICoreModule<any>>;

  @Get('/')
  public getConstants() {
    const allConstants = {};
    for (const module of this.coremodules) {
      allConstants[module.name] = _.cloneDeep(module.constants);
    }

    // Each root element is a module
    for (const outerKey in allConstants) {
      const moduleConstants = allConstants[outerKey];
      // Inner keys may be either an actual constant or module constants
      for (const innerKey in moduleConstants) {
        //If it is a module constants element, merge the constants to the outer object
        if (innerKey.match(/@.+\/.+/)) {
          const otherModuleConstants = moduleConstants[innerKey];
          allConstants[innerKey] = allConstants[innerKey] || {};
          allConstants[innerKey] = _.merge(allConstants[innerKey], otherModuleConstants);
          delete allConstants[outerKey][innerKey];
        }
      }
      // Delete empty items
      if (Object.keys(allConstants[outerKey]).length === 0) {
        delete allConstants[outerKey];
      }
    }

    return {
      constants: allConstants
    };
  }
}
