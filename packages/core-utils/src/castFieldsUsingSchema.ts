
// Exports

export function castFieldsToNumberUsingSchema(schema: any, obj: any) {
  if (typeof(obj) === 'undefined') {
    return;
  }
  if (schema.type === 'integer') {
    return parseInt(obj, 10);
  } else if (schema.type === 'object') {
    Object.keys(schema.properties)
      .filter((k) => typeof(obj[k]) !== 'undefined')
      .forEach((k) => obj[k] = castFieldsToNumberUsingSchema(schema.properties[k], obj[k]));
  } else if (schema.type === 'array' && Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      obj[idx] = castFieldsToNumberUsingSchema(schema.items, item);
    });
  }
  return obj;
}
