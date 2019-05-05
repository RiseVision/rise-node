import * as _ from 'lodash';
import { Model } from 'sequelize-typescript';
import {
  addAttribute,
  addScopeOptions,
  getAttributes,
  getScopeOptions,
} from 'sequelize-typescript';
import { ScopeFindOptions } from 'sequelize-typescript/dist/scopes/shared/scope-find-options';
import { deepAssign } from 'sequelize-typescript/dist/shared/object';

export function mergeScopeOptions(
  from: ScopeFindOptions,
  into: ScopeFindOptions
) {
  const toRet = deepAssign({}, from, into);
  if (typeof into === 'undefined') {
    return toRet;
  }
  const attrs = into.attributes;
  if (Array.isArray(attrs)) {
    if (Array.isArray(from.attributes)) {
      toRet.attributes = _.uniq(attrs.concat(from.attributes));
    } else {
      toRet.attributes = {
        exclude: from.attributes.exclude,
        include: _.uniq(attrs.concat(from.attributes.include)),
      };
    }
  } else if (typeof attrs === 'object') {
    if (Array.isArray(from.attributes)) {
      toRet.attributes = {
        exclude: attrs.exclude,
        include: _.uniq(attrs.include.concat(from.attributes)),
      };
    } else {
      toRet.attributes = {
        exclude: _.uniq(attrs.exclude.concat(from.attributes.exclude)),
        include: _.uniq(attrs.include.concat(from.attributes.include)),
      };
    }
  }
  return toRet;
}

// tslint:disable
export function mergeModels(what: typeof Model, into: typeof Model) {
  const newAttrs = getAttributes(what.prototype);
  what.isInitialized = true;
  // Merge scopes.
  const fromScopeOptions = getScopeOptions(what.prototype) || {};
  const intoScopeOptions = getScopeOptions(into.prototype) || {};

  Object.keys(fromScopeOptions).forEach((scope) => {
    if (fromScopeOptions[scope] && intoScopeOptions[scope]) {
      intoScopeOptions[scope] = mergeScopeOptions(
        fromScopeOptions[scope] as any,
        intoScopeOptions[scope] as any
      );
    } else if (fromScopeOptions[scope]) {
      intoScopeOptions[scope] = fromScopeOptions[scope];
    }
  });
  addScopeOptions(into.prototype, intoScopeOptions);

  // Add methods.
  Object.getOwnPropertyNames(what.prototype)
    .filter((name) => name !== 'constructor')
    .forEach((method) => {
      into.prototype[method] = what.prototype[method];
    });

  Object.keys(newAttrs).forEach((k) =>
    addAttribute(into.prototype, k, newAttrs[k])
  );
}
