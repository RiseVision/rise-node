import 'reflect-metadata';
import * as z_schema from 'z-schema';
import { castFieldsToNumberUsingSchema } from '../';

/**
 * Method validator. It will validate arguments tagged with SchemaValid decorator.
 */
export function ValidateSchema() {
  // tslint:disable-next-line
  return function (target: { schema: z_schema }, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
    // Do nothing for now.
    const old = descriptor.value;
    // tslint: disable-next-line

    const isPromise  = Reflect.getMetadata('design:returntype', target, propertyKey) === 'Promise';
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

          if (!this.schema.validate(args[schemaToValidate.index], schemaToValidate.obj)) {
            const errorMessage = schemaToValidate.opts.errorString ||
              `${this.schema.getLastError().details[0].path} - ${this.schema.getLastErrors()[0].message}`;
            if (isPromise) {
              return Promise.reject(errorMessage);
            }
            throw new Error(errorMessage);
          }
        }
      }
      return old.apply(this, args);
    };
  };
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
      opts = { errorString: opts };
    }
    curSchema.push({ index: parameterIndex, obj: schemaObj, opts });
    Reflect.defineMetadata('__schema', curSchema, target, propertyKey);
  };
}
