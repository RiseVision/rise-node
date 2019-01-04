import * as _ from 'lodash';

export const toTransportable = (obj: any, maxRecursionLevel: number = 5) => {
  if (maxRecursionLevel < 0) {
    throw new Error('Object cannot be transformed to transport format');
  }
  if (Array.isArray(obj)) {
    return obj
      .map((item) => toTransportable(item, maxRecursionLevel - 1));
  }
  const toRet = _.cloneDeep(obj);
  const keys = Object.keys(obj);
  for (const key of keys) {
    if (Array.isArray(toRet[key]) || typeof(toRet[key]) === 'object') {
       toRet[key] = toTransportable(obj, maxRecursionLevel - 1);
    } else if (Buffer.isBuffer(toRet[key])) {
      toRet[key] = toRet[key].toString('hex');
    } else if (typeof(toRet[key]) === 'bigint') {
      toRet[key] = `${toRet[key]}`;
    } // else - no manipulation
  }
  return toRet;
};
