import { expect, test } from "bun:test";
import { pageRows, resolveUnique, touchProject } from "./modelState";

test("compact pages are byte bounded and reject stale or different query cursors", () => {
  const project = { uuid: "fixture" } as ModelProject;
  const rows = Array.from({ length: 10 }, (_, n) => ({ n, name: "x".repeat(20) }));
  const first = pageRows(rows, project, "query", 10, undefined, 100);
  expect(first.items.length).toBe(2);
  expect(pageRows(rows, project, "query", 10, first.next_cursor!, 100).items[0].n).toBe(2);
  expect(() => pageRows(rows, project, "other", 10, first.next_cursor!)).toThrow("STALE_CURSOR");
  touchProject(project);
  expect(() => pageRows(rows, project, "query", 10, first.next_cursor!)).toThrow("STALE_CURSOR");
  expect(() => pageRows(rows, project, "query", 10, "bogus")).toThrow("INVALID_CURSOR");
  expect(() => pageRows(rows, project, "query", 10, Buffer.from("null").toString("base64url"))).toThrow("INVALID_CURSOR");
  expect(() => pageRows(rows, project, "query", 10, undefined, 5)).toThrow("RESULT_TOO_LARGE");
});

test("new lookup requires exact IDs or unique names", () => {
  const items = [{ uuid: "first-id", name: "same" }, { uuid: "second-id", name: "same" }];
  expect(resolveUnique(items, "first-id", "element")).toBe(items[0]);
  expect(() => resolveUnique(items, "same", "element")).toThrow("AMBIGUOUS_ID");
  expect(() => resolveUnique(items, "first", "element")).toThrow("NOT_FOUND");
});
