import * as _ from "lodash";

export const scope = (...prefixes) => {
  return suffixes =>
    [].concat(...prefixes, ...suffixes).map(s => s.trim()).join(".");
};

export const md = (strings, ...values) =>
  _(strings)
    .map(string => string.replace(/\n\s+/g, "\n"))
    .zip(_.map(values, _.toString))
    .flatten()
    .join("");
