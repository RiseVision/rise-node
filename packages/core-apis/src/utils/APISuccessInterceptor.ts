import { IoCSymbol } from '@risevision/core-utils';
import { injectable } from 'inversify';
import { Action, InterceptorInterface } from 'routing-controllers';
import { APISymbols } from '../helpers';

@injectable()
@IoCSymbol(APISymbols.successInterceptor)
export class APISuccessInterceptor implements InterceptorInterface {
  public intercept(action: Action, result: any): any | Promise<any> {
    return {...{success: true}, ...result};
  }
}
