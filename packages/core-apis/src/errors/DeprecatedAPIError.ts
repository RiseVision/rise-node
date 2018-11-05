import { HTTPError } from '@risevision/core-utils';

export class DeprecatedAPIError extends HTTPError {
  constructor() {
    super('Method is deprecated', 500);
  }
}
