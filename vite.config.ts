import * as path from 'node:path';
import dts from 'unplugin-dts/vite';
import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, './src/index.ts'),
            name: 'xstream',
            formats: ['es', 'cjs', 'iife', 'umd'],
            fileName: format => `xstream.${format}.js`
        },
        minify: true
    },
    plugins: [
        dts({
            processor: 'ts',
            outDirs: path.resolve(__dirname, './dist/types')
        })
    ]
});
