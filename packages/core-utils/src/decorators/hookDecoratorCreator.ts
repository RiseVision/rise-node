import {
  IWPHookSubscriber,
  OnWPAction,
  OnWPFilter,
  WordPressHookSystem,
} from 'mangiafuoco';

// tslint:disable-next-line interface-name
export interface ActionFilterDecoratorType<K = () => Promise<any>> {
  <T extends IWPHookSubscriber>(
    hookGetter: () => WordPressHookSystem,
    priority?: number
  ): (
    target: T,
    method: string,
    descriptor: TypedPropertyDescriptor<K>
  ) => TypedPropertyDescriptor<K>;

  <T extends IWPHookSubscriber & { hookSystem: WordPressHookSystem }>(
    priority?: number
  ): (
    target: T,
    method: string,
    descriptor: TypedPropertyDescriptor<K>
  ) => TypedPropertyDescriptor<K>;
}

export const createFilterDecorator = <K = () => Promise<any>>(
  filter: string
): ActionFilterDecoratorType<K> => {
  const toRet = <T extends IWPHookSubscriber>(
    hookGetter: any,
    priority?: number
  ) => {
    if (typeof hookGetter !== 'function') {
      priority = hookGetter;
      return OnWPFilter<T & { hookSystem: WordPressHookSystem }, K>(
        filter,
        priority
      );
    }
    return OnWPFilter<T, K>(hookGetter, filter, priority);
  };
  Object.defineProperty(toRet, 'name', { value: filter, writable: false });
  return toRet;
};

export const createActionDecorator = <K = () => Promise<any>>(
  action: string
): ActionFilterDecoratorType<K> => {
  const toRet = <T extends IWPHookSubscriber>(
    hookGetter: any,
    priority?: number
  ) => {
    if (typeof hookGetter !== 'function') {
      priority = hookGetter;
      return OnWPAction<T & { hookSystem: WordPressHookSystem }, K>(
        action,
        priority
      );
    }
    return OnWPAction<T, K>(hookGetter, action, priority);
  };
  Object.defineProperty(toRet, 'name', { value: action, writable: false });
  return toRet;
};
