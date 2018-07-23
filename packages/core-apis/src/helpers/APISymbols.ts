export const APISymbols = {
  applyLimitsMiddleware: Symbol('applyLimitsMiddleware'),
  errorHandler         : Symbol('errorHandler'),
  privateApiGuard      : Symbol('forgingApisWatchGuard'),
  successInterceptor   : Symbol('successInterceptor'),
};
