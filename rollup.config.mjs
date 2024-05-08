import _ from 'lodash';
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
    'adapters/storage/progres': 'src/adapters/storage/progres/index',
    'adapters/file/database': 'src/adapters/file/database/index',
    'adapters/file/filesystem': 'src/adapters/file/filesystem/index',
    'adapters/file/google-cloud-storage': 'src/adapters/file/google-cloud-storage/index',
  },
  external: [
    /node_modules/
  ],
};

const resolvePlugin = resolve({
  extensions: [
    ..._.uniq(['.web', '']).flatMap(x => [`${x}.tsx`, `${x}.jsx`]),
    ..._.uniq(['.web', '']).flatMap(x => [`${x}.ts`, `${x}.mjs`, `${x}.js`]),
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