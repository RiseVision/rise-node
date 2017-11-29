'use strict';

/**
 * Changes the operator sign
 * @param {string[]} diff
 * @returns {string[]}
 */
export function reverse(diff: string[]) {
  const copyDiff = diff.slice();
  for (let i = 0; i < copyDiff.length; i++) {
    const math = copyDiff[i][0] === '-' ? '+' : '-';
    copyDiff[i] = math + copyDiff[i].slice(1);
  }
  return copyDiff;
}

/**
 * Acts over source content adding(+) or deleting(-) public keys based on diff content.
 * @param {Array} source
 * @param {Array} diff
 * @return {Array} Source data without -publicKeys and with +publicKeys from diff.
 */
export function merge(source: string[], diff: string[]) {
  let res = source ? source.slice() : [];
  let index;

  for (const singleDiff of diff) {
    const math = singleDiff[0];
    const publicKey = singleDiff.slice(1);

    if (math === '+') {
      res = res || [];

      index = -1;
      if (res) {
        index = res.indexOf(publicKey);
      }
      if (index !== -1) {
        return false;
      }

      res.push(publicKey);
    }
    if (math === '-') {
      index = -1;
      if (res) {
        index = res.indexOf(publicKey);
      }
      if (index === -1) {
        return false;
      }
      res.splice(index, 1);
      if (!res.length) {
        res = null;
      }
    }
  }
  return res;
}
