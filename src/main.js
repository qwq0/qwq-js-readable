#! /usr/bin/env node

import minimist from "minimist";
import { readFile, writeFile } from "fs/promises";
import * as acorn from "acorn";
import { processingCode } from "./processingCode.js";

(async () =>
{
    let argv = minimist(process.argv.slice(2));

    if (!argv.out)
        throw "need --out argv";
    if (argv._.length == 0)
        throw "need input file";
    if (argv._.length > 1)
        throw "too many input files";

    let srcCode = await readFile(argv._[0], { encoding: "utf-8" });

    if (argv.tree)
        await writeFile(argv.tree, JSON.stringify(acorn.parse(srcCode, { ecmaVersion: "latest" }), undefined, 4), { encoding: "utf-8" });

    await writeFile(argv.out, await processingCode(srcCode, Boolean(argv.module)), { encoding: "utf-8" });
})();



process.addListener("unhandledRejection", e =>
{
    console.error("Error:", e);
    process.exit(-1);
});