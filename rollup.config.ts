import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/main.ts',
  onwarn(warning, warn) {
    if (warning.code === 'THIS_IS_UNDEFINED') return
    warn(warning)
  },
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: false,
    exports: 'none',
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
    }),
    resolve({
      preferBuiltins: true,
      exportConditions: ['node'],
    }),
    commonjs(),
  ],
  external: [],
}
