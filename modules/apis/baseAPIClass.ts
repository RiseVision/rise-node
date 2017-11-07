
export function ValidateSchema(target: { schema: any }, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
  // Do nothing for now.
  const old        = descriptor.value;
  // tslint: disable-next-line
  descriptor.value = async function (...args) {
    if (Reflect.hasMetadata('__schema', target, propertyKey)) {
      const schemas: Array<{ index: number, obj: any }> = Reflect
        .getMetadata('__schema', target, propertyKey);

      for (const schemaToValidate of schemas) {
        if (!this.schema.validate(args[schemaToValidate.index], schemaToValidate.obj)) {
          throw new Error(this.schema.getLastErrors()[0].message);
        }
      }
    }
    return old.apply(this, args);
  };
}

export function SchemaValid(schemaObj: any) {
  return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
    const curSchema = Reflect.getMetadata('__schema', target, propertyKey) || [];
    curSchema.push({index: parameterIndex, obj: schemaObj});
    Reflect.defineMetadata('__schema', curSchema, target, propertyKey);
  };
}
