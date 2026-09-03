import { expect, test } from "bun:test";
import { EditorQueue } from "./editorExecution";

test("editor queue serializes async clients and continues after failure/cancellation", async () => {
  const queue = new EditorQueue();
  const order: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = queue.run(async () => { order.push("start"); await gate; order.push("finish"); });
  const aborted = new AbortController();
  const second = queue.run(() => { order.push("cancelled"); }, aborted.signal).then(() => false, () => true);
  aborted.abort();
  const third = queue.run(() => { order.push("third"); throw new Error("fixture"); }).then(() => "", error => error.message);
  const fourth = queue.run(() => { order.push("fourth"); });
  await Promise.resolve();
  expect(order).toEqual(["start"]);
  release();
  const [, cancelled, failure] = await Promise.all([first, second, third, fourth]);
  expect(cancelled).toBe(true);
  expect(failure).toBe("fixture");
  expect(order).toEqual(["start", "finish", "third", "fourth"]);
});
