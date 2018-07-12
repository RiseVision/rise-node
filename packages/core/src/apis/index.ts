
import { AccountsAPI } from './accountsAPI';
import { BlocksAPI } from './blocksAPI';
import { LoaderAPI } from './loaderAPI';
import './utils/successInterceptor';

export * from './accountsAPI';
export * from './blocksAPI';
export * from './loaderAPI';

export const allControllers = [
  AccountsAPI,
  BlocksAPI,
  LoaderAPI,
];
