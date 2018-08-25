export type RequestFactoryType<T, K> = (options: { data: T, query?: any} ) => K;
export const requestFactory = (what: (new () => any)) => (ctx) => (options) => {
  const toRet = ctx.container.resolve(what);
  toRet.options = options;
  return toRet;
};

