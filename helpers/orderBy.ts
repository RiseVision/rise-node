'use strict';

/**
 * Validates sort options, methods and fields.
 * @memberof module:helpers
 * @function
 * @param {array} orderBy
 * @param {string} options
 * @return {Object} error | {sortField, sortMethod}.
 */
export function OrderBy(orderBy: string,
                                options: {
                                  quoteField?: boolean,
                                  sortField?: string,
                                  sortMethod?: string,
                                  sortFields?: string[],
                                  fieldPrefix?: string | ((f: string) => string)
                                }): { sortField: string, sortMethod: 'DESC' | 'ASC', error?: string } {

  options            = (typeof options === 'object') ? options : {};
  options.sortField  = options.sortField || null;
  options.sortMethod = options.sortMethod || null;
  options.sortFields = Array.isArray(options.sortFields) ? options.sortFields : [];

  options.quoteField = typeof (options.quoteField) === 'undefined' ? true : Boolean(options.quoteField);

  let sortField;
  let sortMethod;

  if (orderBy) {
    const sort = String(orderBy).split(':');
    sortField  = sort[0].replace(/[^\w\s]/gi, '');

    if (sort.length === 2) {
      sortMethod = sort[1] === 'desc' ? 'DESC' : 'ASC';
    }
  }

  function prefixField(f) {
    if (!f) {
      return f;
    } else if (typeof options.fieldPrefix === 'string') {
      return options.fieldPrefix + f;
    } else if (typeof options.fieldPrefix === 'function') {
      return options.fieldPrefix(f);
    } else {
      return f;
    }
  }

  function quoteField(f) {
    if (f && options.quoteField) {
      return `"${f}"`;
    } else {
      return f;
    }
  }

  const emptyWhiteList = options.sortFields.length === 0;

  const inWhiteList = options.sortFields.length >= 1 && options.sortFields.indexOf(sortField) > -1;

  if (sortField) {
    if (emptyWhiteList || inWhiteList) {
      sortField = prefixField(sortField);
    } else {
      return {
        error: 'Invalid sort field',
      } as any;
    }
  } else {
    sortField = prefixField(options.sortField);
  }

  if (!sortMethod) {
    sortMethod = options.sortMethod;
  }

  return {
    sortField: quoteField(sortField),
    sortMethod,
  };
}
