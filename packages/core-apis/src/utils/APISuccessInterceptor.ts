import { IoCSymbol, toTransportable } from '@risevision/core-utils';
import { injectable } from 'inversify';
import { Action, Interceptor, InterceptorInterface } from 'routing-controllers';
import { APISymbols } from '../helpers';

@injectable()
@IoCSymbol(APISymbols.successInterceptor)
@Interceptor()
export class APISuccessInterceptor implements InterceptorInterface {
  public intercept(action: Action, result: any): any | Promise<any> {
    return { success: true, ...toTransportable(result) };
  }
}
