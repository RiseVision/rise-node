import shebang from 'rollup-plugin-add-shebang';
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';

export default {
  input: 'build/main.js',
  output: {
    file: 'dist/rise-manager',
    format: 'cjs',
  },
  plugins: [
    shebang({
      include: 'dist/rise-manager',
    }),
    nodeResolve(),
    commonjs(),
  ],
};
