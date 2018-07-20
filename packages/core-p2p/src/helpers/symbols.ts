export const p2pSymbols = {
  constants: Symbol.for('p2pSymbol'),
  express: Symbol.for('express'),
  server: Symbol.for('server'),
  // Tag your HTTP controller with this.
  controller: Symbol.for('controller'),
  middleware: Symbol.for('middleware'),
};