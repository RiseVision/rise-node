import { p2pSymbols } from '@risevision/core-p2p';

export const APISymbols = {
  api                  : p2pSymbols.controller,
  applyLimitsMiddleware: Symbol.for('rise.api.applyLimitsMiddleware'),
  errorHandler         : Symbol.for('rise.api.errorHandler'),
  privateApiGuard      : Symbol.for('rise.api.forgingApisWatchGuard'),
  socketIOAPI          : Symbol.for('rise.api.socketIOAPI'),
  successInterceptor   : Symbol.for('rise.api.successInterceptor'),
};
