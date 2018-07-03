import { IWPHookSubscriber, OnWPAction, OnWPFilter, WordPressHookSystem } from 'mangiafuoco';

// export type hookDecoratorType<K> =
//   <T extends IWPHookSubscriber>(target: T,
//                                 method: string,
//                                 descriptor: TypedPropertyDescriptor<K>) => TypedPropertyDescriptor<K>;

// tslint:disable-next-line max-line-length
export const createFilterDecorator = <K>(filter: string): (hookGetter: () => WordPressHookSystem, priority?: number)
  => <T extends IWPHookSubscriber>(target: T,
                                   method: string,
                                   descriptor: TypedPropertyDescriptor<K>) => TypedPropertyDescriptor<K> => {
  return <T extends IWPHookSubscriber>(hookGetter: () => WordPressHookSystem, priority?: number) => {
    return OnWPFilter<T>(hookGetter, filter, priority) as any;
  };
};

// tslint:disable-next-line max-line-length
export const createActionDecorator = <K>(filter: string): (hookGetter: () => WordPressHookSystem, priority?: number) =>
  <T extends IWPHookSubscriber>(target: T,
                                method: string,
                                descriptor: TypedPropertyDescriptor<K>) => TypedPropertyDescriptor<K> => {
  return <T extends IWPHookSubscriber>(hookGetter: () => WordPressHookSystem, priority?: number) => {
    return OnWPAction<T>(hookGetter, filter, priority) as any;
  };
};
