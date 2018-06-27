import { injectable } from 'inversify';
import { Action, Interceptor, InterceptorInterface } from 'routing-controllers';
import { IoCSymbol, Symbols } from '@risevision/core-helpers';

@Interceptor()
@injectable()
@IoCSymbol(Symbols.api.utils.successInterceptor)
export class SuccessInterceptor implements InterceptorInterface {
  public intercept(action: Action, result: any): any | Promise<any> {
    return {...{success: true}, ...result};
  }
}
