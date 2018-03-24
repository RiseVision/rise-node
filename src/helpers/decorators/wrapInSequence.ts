import { Sequence } from '../sequence';

export function WrapInSequence<T>(which: 'balancesSequence' | 'dbSequence' | 'defaultSequence') {
  return (target: T,
          method: string,
          descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) => {
    const oldValue = descriptor.value;
    descriptor.value = function wrapInSequence(...args: any[]) {
      return (this[which] as Sequence)
        .addAndPromise(() => oldValue.apply(this, args));
    };
  };
}

/**
 * Decorator to wrap method in Balance Sequence
 */
export const WrapInBalanceSequence = WrapInSequence<{balancesSequence: Sequence}>('balancesSequence');

/**
 * Decorator to wrap method in DB Sequence
 */
export const WrapInDBSequence = WrapInSequence<{dbSequence: Sequence}>('dbSequence');

/**
 * Decorator to wrap method in Default Sequence
 */
export const WrapInDefaultSequence = WrapInSequence<{defaultSequence: Sequence}>('defaultSequence');