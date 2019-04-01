import { HTTPError } from './httpError';

export class DeprecatedAPIError extends HTTPError {
  constructor() {
    super('Method is deprecated', 500);
  }
}
