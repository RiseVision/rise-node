import * as ip from 'ip';
import * as z_schema from 'z-schema';

z_schema.registerFormat('id', (str: string) => {
  if (str.length === 0) {
    return true;
  }

  return /^[0-9]+$/g.test(str);
});

z_schema.registerFormat('username', (str: string) => {
  if (typeof str !== 'string') {
    return false;
  }

  return /^[a-z0-9!@$&_.]+$/gi.test(str);
});

z_schema.registerFormat('hex', (str: string) => /^[a-f0-9]*$/i.test(str));

z_schema.registerFormat('publicKey', (str: string) => {
  return /^[a-f0-9]{64}$/i.test(str);
});

z_schema.registerFormat('buffer', (str: Buffer) => {
  return Buffer.isBuffer(str);
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

// tslint:disable-next-line no-identical-functions
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

z_schema.registerFormat('os', (str: string) => /^[a-z0-9-_.+]+$/gi.test(str));

z_schema.registerFormat('version', (str: string) =>
  /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})(-?[a-z]{1})?$/g.test(str)
);

z_schema.registerFormat('txId', (value: string) => {
  return /^[0-9]+$/.test(value);
});

z_schema.registerFormat('address', (str: string) => {
  // tslint:disable-next-line
  return /^[0-9]{1,20}R/.test(str);
});

// var registeredFormats = z_schema.getRegisteredFormats();
// console.log(registeredFormats);

export { z_schema };
