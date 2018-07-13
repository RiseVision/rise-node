import 'reflect-metadata';
import * as z_schema from 'z-schema';
import { castFieldsToNumberUsingSchema } from '../';

/**
 * Method validator. It will validate arguments tagged with SchemaValid decorator.
 */
export function ValidateSchema() {
  // tslint:disable-next-line max-line-length
  return (target: { schema: z_schema }, propertyKey: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<any>>) => {
    // Do nothing for now.
    const old = descriptor.value;
    descriptor.value = function schemaValidator(...args) {
      if (Reflect.hasMetadata('__schema', target, propertyKey)) {
        const schemas: Array<{
          index: number,
          obj: any,
          opts: { errorString?: string, castNumbers?: boolean }
        }> = Reflect.getMetadata('__schema', target, propertyKey);

        for (const schemaToValidate of schemas) {
          if (schemaToValidate.opts.castNumbers) {
            castFieldsToNumberUsingSchema(
              schemaToValidate.obj,
              args[schemaToValidate.index]
            );
          }

          try {
            assertValidSchema(this.schema, args[schemaToValidate.index], schemaToValidate);
          } catch (err) {
            return Promise.reject(err);
          }

        }
      }
      return old.apply(this, args);
    };
  };
}

export function assertValidSchema(schema: z_schema,
                                  objToValidate: any,
                                  schemaToValidate: { obj: any, opts?: { errorString?: string } }) {
  if (!schema.validate(objToValidate, schemaToValidate.obj)) {
    const errorMessage = (schemaToValidate.opts || {}).errorString ||
      `${schema.getLastError().details[0].path} - ${schema.getLastErrors()[0].message}`;
    throw new Error(errorMessage);
  }

}

/**
 * Argument Decorator to be used with ValidateSchema
 * @param schemaObj The schema object
 * @param opts Options to override errors
 */
export function SchemaValid(schemaObj: any, opts: string | { errorString?: string, castNumbers?: boolean } = {}) {
  return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    const curSchema = Reflect.getMetadata('__schema', target, propertyKey) || [];
    if (typeof(opts) === 'string') {
      opts = {errorString: opts};
    }
    curSchema.push({index: parameterIndex, obj: schemaObj, opts});
    Reflect.defineMetadata('__schema', curSchema, target, propertyKey);
  };
}
