import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import * as astring from "astring";
import * as prettier from "prettier/standalone";
import * as prettierPluginAcorn from "prettier/plugins/acorn";
import * as prettierPluginEstree from "prettier/plugins/estree";
import { Linter } from "../node_modules/eslint/lib/linter/linter.js";

/**
 * 处理代码
 * @param {string} srcCode
 * @param {boolean} moduleMode
 * @returns {Promise<string>}
 */
export async function processingCode(srcCode, moduleMode)
{
    let codeTree = acorn.parse(srcCode, { ecmaVersion: "latest" });


    let result = await processingTree(codeTree);
    let processingCount = 1;

    while (result.doWork == true)
    {
        result = await processingTree(result.tree);

        processingCount++;
        if (processingCount > 100)
            break;
    }

    return await treeToCode(result.tree, moduleMode);
}

/**
 * 遍历处理代码树
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

    /**
     * 代码块的子节点给代码块的预留任务
     * 当回溯到代码块时再执行
     * @type {Map<Object, Map<Object, {
     *  getReplace?: () => Array<Object>
     * }>>}
     */
    let blockTask = new Map();

    /**
     * 展开代码块中的语句
     * @param {Object} now
     * @param {Object | undefined} parent
     * @param {Array<Object>} replacementStatements
     * @returns {Object}
     */
    function expandStatementInBlock(now, parent, replacementStatements)
    {
        if (parent && parent?.type == "BlockStatement") // 如果上层是代码块
        {
            if (!blockTask.has(parent))
                blockTask.set(parent, new Map());
            blockTask.get(parent).set(now, { // 设置父节点的取代任务
                getReplace: () => replacementStatements
            });
        }
        else // 上层不是代码块
        {
            Object.assign(now, {
                type: "BlockStatement",
                body: replacementStatements
            });
            doWork = true;
        }

        return now;
    }

    acornWalk.fullAncestor(tree, (now, state, ancestor) =>
    {
        if (now.type == "ExpressionStatement" && now["expression"]) // 表达式语句
        {
            let expression = now["expression"];

            if (expression.type == "ConditionalExpression") // 三目条件运算符
            {
                delete now["expression"];

                Object.assign(now, {
                    type: "IfStatement",
                    test: expression.test,
                    consequent: {
                        type: "ExpressionStatement",
                        expression: expression.consequent
                    },
                    alternate: {
                        type: "ExpressionStatement",
                        expression: expression.alternate
                    }
                });

                doWork = true;
            }
            else if (
                expression.type == "LogicalExpression" &&
                (expression.operator == "&&" || expression.operator == "||")
            ) // 逻辑运算符
            {
                delete now["expression"];

                Object.assign(now, {
                    type: "IfStatement",
                    test: (
                        expression.operator == "&&" ?
                            expression.left :
                            ({
                                type: "UnaryExpression",
                                operator: "!",
                                prefix: true,
                                argument: expression.left
                            })
                    ),
                    consequent: {
                        type: "ExpressionStatement",
                        expression: expression.right
                    },
                    alternate: null
                });

                doWork = true;
            }
            else if (
                expression.type == "SequenceExpression"
            ) // 逗号运算符
            {
                delete now["expression"];

                expandStatementInBlock(
                    now,
                    ancestor[ancestor.length - 2],
                    expression.expressions.map((/** @type {Object} */ o) =>
                    {
                        return {
                            type: "ExpressionStatement",
                            expression: o
                        };
                    })
                );
            }
            else if (
                expression.type == "AssignmentExpression"
            ) // 赋值运算符
            {
                let rightValue = expression.right;
                if (rightValue.type == "ConditionalExpression") // 赋值套三目运算
                {
                    delete now["expression"];

                    Object.assign(now, {
                        type: "IfStatement",
                        test: rightValue.test,
                        consequent: {
                            type: "ExpressionStatement",
                            expression: {
                                type: "AssignmentExpression",
                                operator: expression.operator,
                                left: structuredClone(expression.left),
                                right: rightValue.consequent
                            }
                        },
                        alternate: {
                            type: "ExpressionStatement",
                            expression: {
                                type: "AssignmentExpression",
                                operator: expression.operator,
                                left: structuredClone(expression.left),
                                right: rightValue.alternate
                            }
                        }
                    });

                    doWork = true;
                }
                else if (rightValue.type == "SequenceExpression") // 赋值套逗号运算符
                {
                    delete now["expression"];

                    expandStatementInBlock(
                        now,
                        ancestor[ancestor.length - 2],
                        [
                            ...rightValue.expressions.slice(0, -1).map((/** @type {Object} */ o) =>
                            {
                                return {
                                    type: "ExpressionStatement",
                                    expression: o
                                };
                            }),
                            {
                                type: "ExpressionStatement",
                                expression: {
                                    type: "AssignmentExpression",
                                    operator: expression.operator,
                                    left: structuredClone(expression.left),
                                    right: rightValue.expressions[rightValue.expressions.length - 1]
                                }
                            }
                        ]
                    );
                }
            }
        }
        else if (now.type == "IfStatement" && now["test"]) // if语句
        {
            let testExpression = now["test"];

            if (
                testExpression.type == "SequenceExpression"
            ) // if语句条件中包含逗号运算符
            {
                delete now["expression"];

                Object.assign(now, {
                    type: "BlockStatement",
                    body: [
                        ...testExpression.expressions.slice(0, -1).map((/** @type {Object} */ o) =>
                        {
                            return {
                                type: "ExpressionStatement",
                                expression: o
                            };
                        }),
                        {
                            type: "ExpressionStatement",
                            expression: {
                                type: "IfStatement",
                                test: testExpression.expressions[testExpression.expressions.length - 1],
                                consequent: now["consequent"],
                                alternate: now["alternate"]
                            }
                        }
                    ]
                });
                doWork = true;
            }
        }
        else if (now.type == "BlockStatement" && now["body"]) // 块语句
        {
            if (blockTask.has(now)) // 有来自子节点的预留任务
            {
                let taskMap = blockTask.get(now);

                let processedBody = (/** @type {Array<Object>} */(now["body"])).map(oldChild =>
                {
                    if (taskMap.has(oldChild)) // 此子节点有预留任务
                    {
                        let ret = [oldChild];

                        let taskObj = taskMap.get(oldChild);
                        if (taskObj.getReplace)
                            ret = taskObj.getReplace();

                        if (ret.length != 1 || ret[0] != oldChild) // 进行了变化
                            doWork = true;

                        return ret;
                    }
                    else
                        return oldChild;
                });

                now["body"] = processedBody.flat(1);
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
* @param {boolean} moduleMode
* @returns {Promise<string>}
*/
async function treeToCode(tree, moduleMode)
{
    let genCode = astring.generate(tree);

    let processedCode = await prettier.format(genCode, {
        parser: "acorn",
        plugins: [
            prettierPluginAcorn,
            // @ts-ignore
            prettierPluginEstree
        ],

        semi: true,
        tabWidth: 4
    });

    let linter = new Linter({});
    let lintResult = linter.verifyAndFix(processedCode, {
        env: {
            es2022: true,
            node: true
        },
        parserOptions: {
            ecmaVersion: "latest",
            sourceType: (moduleMode ? "module" : "script")
        },
        rules: {
            indent: ["error", 4],
            semi: ["error", "always"],
            quotes: ["error", "double"],
            "brace-style": ["error", "allman"],
            "nonblock-statement-body-position": ["error", "below"],

            "no-lonely-if": ["error", true],
            curly: ["error", "multi-or-nest"]
        }
    }, undefined);
    if (lintResult.messages.length != 0)
        console.log("lint error:", lintResult.messages.map(o => `${o.message}\n${o.line}:${o.column}\n`).join("\n"));

    return lintResult.output;
}
