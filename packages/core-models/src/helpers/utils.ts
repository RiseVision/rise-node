import * as _ from 'lodash';
import {
  getScopeOptionsGetters,
  Model,
  resolveScopes,
  ScopeOptions,
  ScopeOptionsGetters,
  setScopeOptionsGetters,
} from 'sequelize-typescript';
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
): ScopeFindOptions {
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
  let { getScopes, getDefaultScope } = getScopeOptionsGetters(what.prototype);
  let {
    getScopes: intoGetScopes,
    getDefaultScope: intoGetDefaultScope,
  } = getScopeOptionsGetters(into.prototype);

  getScopes = getScopes || (() => ({}));
  getDefaultScope = getDefaultScope || (() => ({}));
  intoGetScopes = intoGetScopes || (() => ({}));
  intoGetDefaultScope = intoGetDefaultScope || (() => ({}));

  const fromScopes = { ...getScopes() };
  const intoScopes = { ...intoGetScopes() };

  const newIntoScopeGetter: { [scope: string]: ScopeFindOptions } = {};

  Object.keys(fromScopes).forEach((scope) => {
    if (fromScopes[scope] && intoScopes[scope]) {
      newIntoScopeGetter[scope] = mergeScopeOptions(
        fromScopes[scope] as any,
        intoScopes[scope] as any
      );
    } else if (fromScopes[scope]) {
      newIntoScopeGetter[scope] = fromScopes[scope] as ScopeFindOptions;
    }
  });

  Object.keys(intoScopes).forEach((scope) => {
    if (typeof newIntoScopeGetter[scope] === 'undefined') {
      newIntoScopeGetter[scope] = intoScopes[scope] as ScopeFindOptions;
    }
  });

  // Handle default.
  const resolvedFromDefaultScope = getDefaultScope();
  const resolvedToDefaultScope = intoGetDefaultScope();

  const resolvedDefaultScope = mergeScopeOptions(
    resolvedFromDefaultScope as any,
    resolvedToDefaultScope as any
  ) as any;

  setScopeOptionsGetters(into.prototype, {
    getDefaultScope() {
      return resolvedDefaultScope;
    },
    getScopes() {
      return newIntoScopeGetter as any;
    },
  });

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
