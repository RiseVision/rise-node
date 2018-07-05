import { IWPHookSubscriber, OnWPAction, OnWPFilter, WordPressHookSystem } from 'mangiafuoco';

export interface ActionFilterDecoratorType<K> {

  <T extends IWPHookSubscriber>(hookGetter: () => WordPressHookSystem, priority?: number)
    : (target: T,
       method: string,
       descriptor: TypedPropertyDescriptor<K>) => TypedPropertyDescriptor<K>;

  <T extends IWPHookSubscriber & { hookSystem: WordPressHookSystem }>(priority?: number)
    : (target: T,
       method: string,
       descriptor: TypedPropertyDescriptor<K>) => TypedPropertyDescriptor<K>;
}

export const createFilterDecorator = <K>(filter: string): ActionFilterDecoratorType<K> => {
  return <T extends IWPHookSubscriber>(hookGetter: any, priority?: number) => {
    return OnWPFilter<T, K>(hookGetter, filter, priority);
  };
};

export const createActionDecorator = <K>(action: string): ActionFilterDecoratorType<K> => {
  return <T extends IWPHookSubscriber>(hookGetter: any, priority?: number) => {
    return OnWPAction<T, K>(hookGetter, action, priority);
  };
};
