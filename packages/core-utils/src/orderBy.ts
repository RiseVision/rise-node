'use strict';

/**
 * Validates sort options, methods and fields.
 * @memberof module:helpers
 * @function
 * @param {array} orderBy
 * @param {string} options
 * @return {Object} error | {sortField, sortMethod}.
 */
export function OrderBy(orderBy: string): <T>(t: T[]) => T[] {
  let sortField;
  let sortMethod;

  if (orderBy) {
    const sort = String(orderBy).split(':');
    sortField = sort[0].replace(/[^\w\s]/gi, '');

    if (sort.length === 2) {
      sortMethod = sort[1] === 'desc' ? 'DESC' : 'ASC';
    }
  }

  if (!sortField) {
    sortField = null;
  }

  if (!sortMethod) {
    sortMethod = 'ASC';
  }

  return <T>(t: T[]) => {
    const newT = t.slice();
    if (!sortField) {
      return newT;
    }
    newT.sort((a, b) => {
      const fa = a[sortField];
      const fb = b[sortField];
      if (typeof fa === 'number' || typeof fa === 'bigint') {
        return (fa as any) - fb;
      } else if (typeof fa === 'string') {
        return fa.localeCompare(fb);
      } else if (Buffer.isBuffer(fa)) {
        return fa.compare(fb);
      }
      throw new Error(`Uncomparable ${sortField}`);
    });

    if (sortMethod === 'DESC') {
      return newT.reverse();
    }
    return newT;
  };
}
