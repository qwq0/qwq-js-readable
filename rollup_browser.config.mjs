import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import terser from '@rollup/plugin-terser';

export default {
    input: "./src/browser.js",
    output: {
        file: "./docs/qwq_js_readable_browser.js",
        inlineDynamicImports: true,
        format: "iife",
        paths: {
        }
    },
    plugins: [
        nodeResolve({
            browser: true,
            mainFields: ["browser", "module", "main"],
            exportConditions: ["browser", "default", "module", "import"]
        }),

        // @ts-ignore
        commonjs({
            transformMixedEsModules: true,
            defaultIsModuleExports: true,
            requireReturnsDefault: "preferred"
        }),

        // @ts-ignore
        json(),

        // @ts-ignore
        nodePolyfills(),

        // @ts-ignore
        terser()
    ]
};