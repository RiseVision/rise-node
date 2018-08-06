export const APISymbols = {
  api: Symbol('api'),
  applyLimitsMiddleware: Symbol('applyLimitsMiddleware'),
  errorHandler         : Symbol('errorHandler'),
  privateApiGuard      : Symbol('forgingApisWatchGuard'),
  successInterceptor   : Symbol('successInterceptor'),
};
