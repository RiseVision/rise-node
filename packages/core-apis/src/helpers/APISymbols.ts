import { Symbols } from '@risevision/core-types';

export const APISymbols = {
  api: Symbol.for('rise.api'),
  applyLimitsMiddleware: Symbol.for('rise.api.applyLimitsMiddleware'),
  class: Symbol.for('rise.api.class'),
  errorHandler: Symbol.for('rise.api.errorHandler'),
  express: Symbol.for('rise.api.express'),
  middleware: Symbol.for('rise.api.middleware'),
  privateApiGuard: Symbol.for('rise.api.privateAPIGuard'),
  socketIO: Symbols.generic.socketIO,
  socketIOAPI: Symbol.for('rise.api.socketIOAPI'),
  successInterceptor: Symbol.for('rise.api.successInterceptor'),
};
