import { APIError } from './ApiError';

export class DeprecatedAPIError extends APIError {

  constructor() {
    super('Method is deprecated', 500);
  }

}
