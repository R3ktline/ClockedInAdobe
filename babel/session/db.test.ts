import { describe, expect, it } from "vitest";
import { loadAll, put, remove } from "./db";

describe("db", () => {
  it("writes, overwrites, reads back and deletes", () => {
    put("gaps", [["a", { n: 1 }], ["b", { n: 2 }]]);
    put("gaps", [["a", { n: 3 }]]);
    expect(loadAll<{ n: number }>("gaps").map(([id, v]) => `${id}${v.n}`).sort()).toEqual(["a3", "b2"]);
    remove("gaps", "a");
    expect(loadAll("gaps").map(([id]) => id)).toEqual(["b"]);
    expect(loadAll("defaults")).toEqual([]); // collections do not leak into each other
  });
});
