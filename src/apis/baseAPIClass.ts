import 'reflect-metadata';
import * as z_schema from 'z-schema';

// TODO: Use typescript decorator metadata to determine if it's a promise or not.
export function ValidateSchema(config: { isPromise: boolean } = { isPromise: true }) {
  // tslint:disable-next-line
  return function (target: { schema: z_schema }, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
    // Do nothing for now.
    const old        = descriptor.value;
    // tslint: disable-next-line
    descriptor.value = function (...args) {
      if (Reflect.hasMetadata('__schema', target, propertyKey)) {
        const schemas: Array<{ index: number, obj: any, errorString?: string }> = Reflect
          .getMetadata('__schema', target, propertyKey);

        for (const schemaToValidate of schemas) {
          if (!this.schema.validate(args[schemaToValidate.index], schemaToValidate.obj)) {
            const errorMessage = schemaToValidate.errorString || `${this.schema.getLastError().details[0].path} - ${this.schema.getLastErrors()[0].message}`;
            if (config.isPromise) {
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

export function SchemaValid(schemaObj: any, errorString?: string) {
  return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    const curSchema = Reflect.getMetadata('__schema', target, propertyKey) || [];
    curSchema.push({ index: parameterIndex, obj: schemaObj, errorString });
    Reflect.defineMetadata('__schema', curSchema, target, propertyKey);
  };
}
