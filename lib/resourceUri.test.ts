import { expect, test } from "bun:test";
import { createResourceIdBuilder, findByResourceId, slugify } from "./resourceUri";

test("indexed resource IDs preserve legacy Unicode, collision and empty-name URIs", () => {
  const items = ["Café", "cafe", "", "🌳", "unique", "a".repeat(50), "a".repeat(51)]
    .map((name, n) => ({ name, uuid: `${n}1234567-0000-0000-0000-000000000000` }));
  const idFor = createResourceIdBuilder(items);
  for (const item of items) {
    const slug = slugify(item.name);
    const legacy = !slug ? item.uuid : items.filter(other => slugify(other.name) === slug).length > 1
      ? `${slug}~${item.uuid.slice(0, 8)}` : slug;
    expect(idFor(item)).toBe(legacy);
    expect(findByResourceId(items, idFor(item))).toBe(item);
  }
});

test("listing reads names linearly and rebuilds correctly after renaming", () => {
  let reads = 0;
  const items = Array.from({ length: 1000 }, (_, n) => ({ uuid: String(n), get name() { reads++; return `node_${n}`; } }));
  const idFor = createResourceIdBuilder(items);
  items.map(idFor);
  expect(reads).toBe(1000);
  const renamed = [{ uuid: "a", name: "same" }, { uuid: "b", name: "other" }];
  expect(createResourceIdBuilder(renamed)(renamed[0])).toBe("same");
  renamed[1].name = "same";
  expect(createResourceIdBuilder(renamed)(renamed[0])).toBe("same~a");
});
