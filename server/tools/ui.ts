/// <reference types="three" />
/// <reference types="blockbench-types" />
import { z } from "zod";
import { createTool, type ToolSpec } from "@/lib/factories";
import { captureAppScreenshot } from "@/lib/util";
import { STATUS_EXPERIMENTAL, STATUS_STABLE } from "@/lib/constants";
import { mouseButtonEnum, coordinateSchema } from "@/lib/zodObjects";

// ============================================================================
// UI Tool Parameter Schemas
// ============================================================================

/** Parameters for triggering an action */
export const triggerActionParametersSchema = z.object({
  action: z
    .string()
    .describe("Action ID from Blockbench's BarItems registry."),
  confirmDialog: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Whether or not to automatically confirm any dialogs that appear as a result of the action."
    ),
  confirmEvent: z
    .string()
    .optional()
    .describe("Stringified form of event arguments."),
});

/** Parameters for risky eval */
export const riskyEvalParametersSchema = z.object({
  code: z
    .string()
    .refine((val) => !/console\.|\/\/|\/\*/.test(val), {
      message:
        "Code must not include 'console.', '//' or '/* */' comments.",
    })
    .describe(
      "JavaScript code to evaluate. Do not pass `console` commands or comments."
    ),
});

/** Click position with optional button */
export const clickPositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  button: mouseButtonEnum.optional().default("left").describe("Mouse button to use."),
});

/** Drag parameters */
export const dragParametersSchema = z
  .object({
    to: coordinateSchema,
    duration: z
      .number().finite().min(0).max(10000)
      .optional()
      .default(100)
      .describe("Duration of the drag in milliseconds."),
  })
  .optional()
  .describe("Drag options. If set, will perform a drag from position to 'to'.");

/** Parameters for emulating clicks */
export const emulateClicksParametersSchema = z.object({
  position: clickPositionSchema,
  drag: dragParametersSchema,
});

/** Parameters for filling a dialog */
export const fillDialogParametersSchema = z.object({
  values: z
    .string()
    .describe("Stringified form of values to fill the dialog with."),
  confirm: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Whether to confirm or cancel the dialog after filling it. True to confirm, false to cancel."
    ),
});

// ============================================================================
// UI Tool Docs
// ============================================================================

export const uiToolDocs: ToolSpec[] = [
  {
    name: "trigger_action",
    description: "Triggers an action in the Blockbench editor.",
    annotations: {
      title: "Trigger Action",
      destructiveHint: true,
      openWorldHint: true,
    },
    parameters: triggerActionParametersSchema,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "risky_eval",
    description:
      "Evaluates JavaScript and returns its result, including without an open project. Does not create an automatic Undo edit: scripts that modify a project must use Undo.initEdit with the relevant aspects and Undo.finishEdit themselves. Script errors are reported as tool errors. Do not pass console commands or comments.",
    annotations: {
      title: "Eval",
      destructiveHint: true,
      openWorldHint: true,
    },
    parameters: riskyEvalParametersSchema,
    status: STATUS_STABLE,
  },
  {
    name: "emulate_clicks",
    description: "Emulates clicks on the given interface elements.",
    annotations: {
      title: "Emulate Clicks",
      destructiveHint: true,
      openWorldHint: true,
    },
    parameters: emulateClicksParametersSchema,
    status: STATUS_EXPERIMENTAL,
  },
  {
    name: "fill_dialog",
    description: "Fills the dialog with the given values.",
    annotations: {
      title: "Fill Dialog",
      destructiveHint: true,
      openWorldHint: true,
    },
    parameters: fillDialogParametersSchema,
    status: STATUS_EXPERIMENTAL,
  },
];

export function registerUITools() {
  createTool(
    uiToolDocs[0].name,
    {
      ...uiToolDocs[0],
      async execute({ action, confirmEvent: args, confirmDialog }) {
        let parsedArgs: Record<string, unknown> = {};
        if (args) {
          try {
            parsedArgs = JSON.parse(args);
          } catch (e) {
            throw new Error(
              `Invalid JSON in confirmEvent: ${e instanceof Error ? e.message : e}`
            );
          }
        }

        if (!(action in BarItems)) {
          throw new Error(`Action "${action}" not found.`);
        }
        const barItem = BarItems[action];

        if (barItem && barItem instanceof Action) {
          const { event, ...rest } = parsedArgs;
          barItem.trigger(
            new Event(event || "click", {
              ...rest,
            })
          );
        }

        if (confirmDialog) {
          Dialog.open?.confirm();
        }


        let result;

        try {
          result = await captureAppScreenshot();
        } catch (e) {
          result = `Action "${action}" executed, but failed to capture app screenshot: ${e}`;
        }

        return result;
      },
    },
    uiToolDocs[0].status
  );

  createTool(
    uiToolDocs[1].name,
    {
      ...uiToolDocs[1],
      async execute({ code }) {
        // Undo is project-scoped. Arbitrary code may inspect the start screen,
        // switch projects, or manage its own edit with different Undo aspects.
        const result = await eval(code.trim());
        if (result !== undefined) {
          return JSON.stringify(result);
        }
        return "(Code executed successfully, but no result was returned.)";
      },
    },
    uiToolDocs[1].status
  );

  createTool(
    uiToolDocs[2].name,
    {
      ...uiToolDocs[2],
      async execute({ position, drag }) {
        const { x, y, button } = position;
        const target = document.elementFromPoint(x, y);
        if (!target) throw new Error("No element at the requested viewport coordinates.");
        const buttonCode = button === "left" ? 0 : button === "middle" ? 1 : 2;
        const buttons = buttonCode === 0 ? 1 : buttonCode === 1 ? 4 : 2;
        const emit = (type: string, point: { x: number; y: number }, pressed: boolean) => {
          const options = { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, button: buttonCode, buttons: pressed ? buttons : 0 };
          if (type !== "click" && type !== "contextmenu") target.dispatchEvent(new PointerEvent(type.replace("mouse", "pointer"), { ...options, pointerId: 1, pointerType: "mouse", isPrimary: true }));
          target.dispatchEvent(new MouseEvent(type, options));
        };
        emit("mousedown", position, true);
        if (drag) {
          const steps = Math.max(1, Math.min(120, Math.ceil(drag.duration / 16)));
          for (let step = 1; step <= steps; step++) {
            await new Promise(resolve => setTimeout(resolve, drag.duration / steps));
            emit("mousemove", { x: x + (drag.to.x - x) * step / steps, y: y + (drag.to.y - y) * step / steps }, true);
          }
          emit("mouseup", drag.to, false);
        } else {
          emit("mouseup", position, false);
          emit(buttonCode === 2 ? "contextmenu" : "click", position, false);
        }

        // Capture a screenshot after the click
        return await captureAppScreenshot();
      },
    },
    uiToolDocs[2].status
  );

  createTool(
    uiToolDocs[3].name,
    {
      ...uiToolDocs[3],
      async execute({ values, confirm }) {
        if (!Dialog.stack.length) {
          throw new Error("No dialogs found in the Blockbench editor.");
        }
        if (!Dialog.open) {
          Dialog.stack[Dialog.stack.length - 1]?.focus();
        }
        let parsedValues: Record<string, unknown>;
        try {
          parsedValues = JSON.parse(values);
        } catch (e) {
          throw new Error(
            `Invalid JSON in values: ${e instanceof Error ? e.message : e}`
          );
        }

        const keys = Object.keys(Dialog.open?.getFormResult() ?? {});
        const valuesToFill = Object.entries(parsedValues).reduce(
          (acc, [key, value]) => {
            if (keys.includes(key)) {
              acc[key as keyof FormResultValue] = value as FormResultValue;
            }
            return acc;
          },
          {} as Record<keyof FormResultValue, FormResultValue>
        );
        Dialog.open?.setFormValues(valuesToFill, true);

        if (confirm) {
          Dialog.open?.confirm();
        } else {
          Dialog.open?.cancel();
        }

        return JSON.stringify({
          result: `Current dialog stack is now ${Dialog.stack.length} deep.`,
          dialogs: Dialog.stack.map((d) => ({
            id: d.id,
            values: d.getFormResult(),
          })),
        });
      },
    },
    uiToolDocs[3].status
  );
}
