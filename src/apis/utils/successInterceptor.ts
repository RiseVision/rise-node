import { injectable } from 'inversify';
import { Action, Interceptor, InterceptorInterface } from 'routing-controllers';
import { IoCSymbol } from '../../helpers/decorators/iocSymbol';
import { Symbols } from '../../ioc/symbols';

@Interceptor()
@injectable()
@IoCSymbol(Symbols.api.utils.successInterceptor)
export class SuccessInterceptor implements InterceptorInterface {
  public intercept(action: Action, result: any): any | Promise<any> {
    if (Buffer.isBuffer(result)) {
      return result;
    }
    return {...{success: true}, ...result};
  }
}
