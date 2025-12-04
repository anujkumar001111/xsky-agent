import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import copy from 'rollup-plugin-copy';

const commonPlugins = [
  resolve({
    browser: false,
    preferBuiltins: true
  }),
  commonjs(),
  json(),
  typescript({
    tsconfig: './tsconfig.json'
  })
];

export default [
  // Main process
  {
    input: 'src/main/index.ts',
    output: {
      file: 'dist/main.js',
      format: 'cjs',
      sourcemap: true
    },
    external: ['electron', '@xsky/ai-agent-core', '@xsky/ai-agent-electron'],
    plugins: [
      ...commonPlugins,
      copy({
        targets: [
          { src: 'src/renderer/index.html', dest: 'dist' },
          { src: 'src/renderer/styles.css', dest: 'dist' },
          { src: '.env', dest: 'dist', rename: '.env' } // Copy .env if exists
        ]
      })
    ]
  },
  // Preload script
  {
    input: 'src/preload/preload.ts',
    output: {
      file: 'dist/preload.js',
      format: 'cjs',
      sourcemap: true
    },
    external: ['electron'],
    plugins: commonPlugins
  },
  // Renderer process
  {
    input: 'src/renderer/renderer.ts',
    output: {
      file: 'dist/renderer.js',
      format: 'iife',
      sourcemap: true,
      name: 'renderer' // Required for iife format
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json'
      })
    ]
  }
];
