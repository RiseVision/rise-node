/**
 * Removes empty stuff from object either recursively or not
 * @param {T} obj
 * @param {boolean} recursive
 * @return {T}
 */
export function removeEmptyObjKeys<T>(obj: T, recursive: boolean = false): T {
  for (const key in obj) {
    if (obj[key] === null || typeof(obj[key]) === 'undefined') {
      delete obj[key];
    } else {
      if (typeof(obj[key]) === 'object' && recursive) {
        removeEmptyObjKeys(obj[key], true);
      }
    }
  }
  return obj;
}
