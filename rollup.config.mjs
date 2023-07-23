import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';

const configs = {
  input: {
    index: 'src/index',
    client: 'src/client/index',
    common: 'src/common/index',
    'storage/mongo': 'src/storage/mongo/index',
    'storage/progres': 'src/storage/progres/index',
    'fileStorage/database': 'src/fileStorage/database/index',
  },
  external: [
    /node_modules/
  ],
};

const resolvePlugin = resolve({
  extensions: [
    '.web.ts', '.web.tsx', '.web.mjs', '.web.js',
    '.ts', '.tsx', '.mjs', '.js',
  ]
});

const rollupPlugins = [
  typescript({ declaration: false }),
  babel({
    babelrc: false,
    exclude: 'node_modules/**',
    babelHelpers: 'bundled',
  }),
  commonjs({
    transformMixedEsModules: true,
  }),
  json(),
];

export default [
  {
    ...configs,
    output: [
      {
        entryFileNames: '[name].js',
        chunkFileNames: 'internals/[name]-[hash].js',
        dir: './dist',
        format: 'cjs',
        sourcemap: true,
      },
      {
        entryFileNames: '[name].mjs',
        chunkFileNames: 'internals/[name]-[hash].mjs',
        dir: './dist',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      resolvePlugin,
      ...rollupPlugins
    ],
  },
  {
    ...configs,
    output: [
      {
        entryFileNames: '[name].d.ts',
        chunkFileNames: 'internals/[name]-[hash].d.ts',
        dir: './dist',
        format: 'es',
        sourcemap: true,
      },
    ],
    plugins: [
      resolvePlugin,
      dts()
    ],
  },
];