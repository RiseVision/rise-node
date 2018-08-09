export const APISymbols = {
  api                  : Symbol.for('rise.api.api'),
  applyLimitsMiddleware: Symbol.for('rise.api.applyLimitsMiddleware'),
  errorHandler         : Symbol.for('rise.api.errorHandler'),
  privateApiGuard      : Symbol.for('rise.api.forgingApisWatchGuard'),
  successInterceptor   : Symbol.for('rise.api.successInterceptor'),
};
