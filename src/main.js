#! /usr/bin/env node

import minimist from "minimist";

import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import * as astring from "astring";
import * as prettier from "prettier";
import { Linter } from "eslint";

import { readFile, writeFile } from "fs/promises";

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
    let codeTree = acorn.parse(srcCode, { ecmaVersion: "latest" });
    if (argv.tree)
        await writeFile(argv.tree, JSON.stringify(codeTree, undefined, 4), { encoding: "utf-8" });

    let result = await processingTree(codeTree);

    while (result.doWork == true)
        result = await processingTree(result.tree);

    await writeFile(argv.out, await treeToCode(result.tree), { encoding: "utf-8" });
})();


/**
 * 遍历代码树
 * @param {Object} tree 
 * @returns {Promise<{
 *  tree: Object,
 *  doWork: boolean
 * }>}
 */
async function processingTree(tree)
{
    tree = structuredClone(tree);

    let doWork = false;

    acornWalk.fullAncestor(tree, (now, state, ancestor) =>
    {
        if (now.type == "ExpressionStatement" && now["expression"]) // 可替换的语句
        {
            let expression = now["expression"];

            if (expression.type == "ConditionalExpression") // 三目条件运算符
            {
                delete now["expression"];

                now.type = "IfStatement";
                now["test"] = expression.test;
                now["consequent"] = {
                    type: "ExpressionStatement",
                    expression: expression.consequent
                };
                now["alternate"] = {
                    type: "ExpressionStatement",
                    expression: expression.alternate
                };

                doWork = true;
            }
            else if (
                expression.type == "LogicalExpression" &&
                (expression.operator == "&&" || expression.operator == "||")
            ) // 逻辑运算符
            {
                delete now["expression"];

                now.type = "IfStatement";
                now["test"] = (
                    expression.operator == "&&" ?
                        expression.left :
                        ({
                            type: "UnaryExpression",
                            operator: "!",
                            prefix: true,
                            argument: expression.left
                        })
                );
                now["consequent"] = {
                    type: "ExpressionStatement",
                    expression: expression.right
                };
                now["alternate"] = null;

                doWork = true;
            }
            else if (
                expression.type == "SequenceExpression"
            ) // 逗号运算符
            {
                delete now["expression"];

                now.type = "BlockStatement";
                now["body"] = expression.expressions.map((/** @type {Object} */ o) =>
                {
                    return {
                        type: "ExpressionStatement",
                        expression: o
                    };
                });

                doWork = true;
            }
        }
    });

    // console.log(await treeToCode(tree));

    return {
        tree: tree,
        doWork: doWork
    };
}

/**
 * 通过树生成代码字符串
 * @param {Object} tree
 * @returns {Promise<string>}
 */
async function treeToCode(tree)
{
    let genCode = astring.generate(tree);

    let processedCode = await prettier.format(genCode, {
        semi: true,
        parser: "acorn"
    });

    let linter = new Linter({});
    let lintResult = linter.verifyAndFix(processedCode, {
        env: {
            es2022: true,
            node: true
        },
        parserOptions: {
            ecmaVersion: "latest",
            sourceType: "module"
        },
        rules: {
            indent: ["error", 4],
            semi: ["error", "always"],
            quotes: ["error", "double"],
            "brace-style": ["error", "allman"],
            "nonblock-statement-body-position": ["error", "below"],

            "no-lonely-if": ["error", true]
        }
    });
    if (lintResult.messages.length != 0)
        console.log("lint error:", lintResult.messages.map(o => `${o.message}\n${o.line}:${o.column}\n`).join("\n"));

    return lintResult.output;
}

process.addListener("unhandledRejection", e =>
{
    console.error("Error:", e);
    process.exit(-1);
});