import { NList, createNStyleList as styles, getNElement, NTagName, cssG, NEvent, delayPromise, NElement } from "../lib/qwqframe.js";
import { processingCode } from "./processingCode.js";

let body = getNElement(document.body);
body.setStyles({
    width: "100%",
    height: "100%",
    margin: "0",
});

/**
 * @type {NElement<HTMLTextAreaElement>}
 */
let textarea = null;

body.addChild(NList.getElement([
    styles({
        width: "100%",
        height: "100%",
        position: "absolute",

        color: "white",

        backgroundColor: "rgb(40, 40, 45)"
    }),

    [
        styles({
            width: "700px",
            height: "500px",
            margin: "auto",
            inset: "0",
            position: "absolute",

            backgroundColor: "rgb(50, 50, 50)"
        }),

        [
            new NTagName("textarea"),
            styles({
                position: "absolute",
                width: "100%",
                height: cssG.diFull("50px"),
                border: "1px solid rgba(255, 255, 255, 0.1)",
                boxSizing: "border-box",

                backgroundColor: "rgb(60, 60, 60)",

                resize: "none",
                color: "white",
                padding: "10px",
                outline: "none"
            }),

            e => textarea = e
        ],
        [
            styles({
                position: "absolute",
                width: "100%",
                height: "50px",
                bottom: "0"
            }),

            [
                "Process",
                styles({
                    position: "absolute",
                    height: "100%",
                    width: "fit-content",

                    backgroundColor: "rgb(56, 56, 56)",

                    padding: "13px",

                    boxSizing: "border-box",

                    cursor: "default",

                    left: "0"
                }),

                new NEvent("mouseenter", (_e, ele) =>
                {
                    ele.animate([{
                    }, {
                        backgroundColor: "rgb(66, 66, 66)"
                    },], {
                        duration: 90,
                        fill: "forwards"
                    });
                }),
                new NEvent("mouseleave", (_e, ele) =>
                {
                    ele.animate([{
                    }, {
                        backgroundColor: "rgb(56, 56, 56)"
                    },], {
                        duration: 90,
                        fill: "forwards"
                    });
                }),

                new NEvent("click", async (_e, ele) =>
                {
                    ele.setText("Processing...");

                    await delayPromise(10);

                    try
                    {
                        textarea.element.value = await processingCode(textarea.element.value, false);
                        ele.setText("Done");
                    }
                    catch (e)
                    {
                        ele.setText("Error");
                        console.error(e);
                    }

                    await delayPromise(450);
                    ele.setText("Process");
                })
            ],

            [
                "QwQ JavaScript Readable\n",
                "WebUI built with qwqFrame",
                styles({
                    position: "absolute",
                    height: "100%",
                    width: "fit-content",

                    boxSizing: "border-box",

                    color: "rgba(255, 255, 255, 0.8)",
                    fontSize: "0.7em",
                    padding: "8px",

                    whiteSpace: "pre-wrap",

                    right: "0"
                })
            ]
        ]
    ]
]));