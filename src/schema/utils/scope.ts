export const scope = (...prefixes) => {
  return suffixes =>
    [].concat(...prefixes, ...suffixes).map(s => s.trim()).join(".");
};
