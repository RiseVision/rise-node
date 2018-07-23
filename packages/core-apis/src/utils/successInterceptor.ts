import { IoCSymbol } from '@risevision/core-utils';
import { injectable } from 'inversify';
import { Action, Interceptor, InterceptorInterface } from 'routing-controllers';
import { APISymbols } from '../helpers';

@Interceptor()
@injectable()
@IoCSymbol(APISymbols.successInterceptor)
export class SuccessInterceptor implements InterceptorInterface {
  public intercept(action: Action, result: any): any | Promise<any> {
    return {...{success: true}, ...result};
  }
}
