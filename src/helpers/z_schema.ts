import * as ip from 'ip';
import * as z_schema from 'z-schema';

/**
 * Uses JSON Schema validator z_schema to register custom formats.
 * - id
 * - address
 * - username
 * - hex
 * - publicKey
 * - csv
 * - signature
 * - queryList
 * - delegatesList
 * - ip
 * - os
 * - version
 * @see {@link https://github.com/zaggino/z-schema}
 * @memberof module:helpers
 * @requires ip
 * @constructor
 * @return {Boolean} True if the format is valid
 */

z_schema.registerFormat('id', (str: string) => {
  if (str.length === 0) {
    return true;
  }

  return /^[0-9]+$/g.test(str);
});

// TODO: Move validator outside so that it can be used everywhere in the code.
z_schema.registerFormat('address', (str: string) => {
  if (str.length === 0) {
    return true;
  }

  return /^[0-9]+[R]$/g.test(str);
});

z_schema.registerFormat('username', (str: string) => {
  if (typeof(str) !== 'string') {
    return false;
  }

  return /^[a-z0-9!@$&_.]+$/ig.test(str);
});

z_schema.registerFormat('hex', (str: string) => /^[a-f0-9]*$/i.test(str));

z_schema.registerFormat('publicKey', (str: string) => {
  if (str.length === 0) {
    return true;
  }

  return /^[a-f0-9]{64}$/i.test(str);
});

z_schema.registerFormat('publicKeyBuf', (str: Buffer) => {
  if (!Buffer.isBuffer(str)) {
    return false;
  }
  return str.length === 32;
});

z_schema.registerFormat('csv', (str: string) => {
  try {
    const a = str.split(',');
    return a.length > 0 && a.length <= 1000;
  } catch (e) {
    return false;
  }
});

z_schema.registerFormat('signature', (str: string) => {
  return /^[a-f0-9]{128}$/i.test(str);
});

z_schema.registerFormat('signatureBuf', (buf: Buffer) => {
  if (!Buffer.isBuffer(buf)) {
    return false;
  }
  return buf.length === 64;
});

z_schema.registerFormat('sha256Buf', (buf: Buffer) => {
  if (!Buffer.isBuffer(buf)) {
    return false;
  }
  return buf.length === 32;
});

z_schema.registerFormat('queryList', (obj: any) => {
  obj.limit = 100;
  return true;
});

z_schema.registerFormat('delegatesList', (obj: any) => {
  obj.limit = 101;
  return true;
});

z_schema.registerFormat('ip', (str) => ip.isV4Format(str));

z_schema.registerFormat('os', (str: string) => /^[a-z0-9-_.+]+$/ig.test(str));

z_schema.registerFormat('version', (str: string) => /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})([a-z]{1})?$/g.test(str));

// var registeredFormats = z_schema.getRegisteredFormats();
// console.log(registeredFormats);

export {z_schema};

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
