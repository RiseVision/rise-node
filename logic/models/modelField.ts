export type IModelFilter = ({
  type: 'string',
  case?: 'lower' | 'upper',
  maxLength?: number,
  minLength?: number,
  format?: string
} | {
  type: 'boolean'
} | {
  type: 'integer',
  minimum?: number,
  maximum?: number,
} | {
  type: 'array',
  uniqueItems: boolean
}) & { required?: boolean };

export interface IModelField {
  name: string;
  type: 'String' | 'SmallInt' | 'BigInt' | 'Binary' | 'Number' | 'Text';
  filter: IModelFilter;

  conv?: any;
  immutable?: boolean;
  expression?: string;
  alias?: string;
  mod?: any; // TODO: Check this field as i don't have a clue on what it is
}
