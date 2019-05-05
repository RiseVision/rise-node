import { Model } from 'sequelize-typescript';
import { Diff, Omit } from 'utility-types';
export type RecursivePartial<T> = { [P in keyof T]?: RecursivePartial<T[P]> };

export { Diff, Omit };

export type Partial<T> = { [P in keyof T]?: T[P] };
export type FieldsInT<T> = Array<keyof T>;
export type FieldsInModel<T extends Model<T>> = Array<
  keyof Omit<T, keyof Model<any>>
>;
export type ModelAttributes<T extends Model<T>> = Partial<
  Omit<T, keyof Model<any>>
>;
