export type RequestFactoryType<T, K> = (options: { data: T, query?: any} ) => K;
