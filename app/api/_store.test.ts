import { describe, expect, it } from "vitest";
import { storeConfig } from "./_store";

describe("storeConfig", () => {
  it("finds stores built in code and stores given as data", () => {
    expect(storeConfig("taraba")?.brand.name).toBe("Taraba");
    expect(storeConfig("croiala")?.registry.home?.productList?.neutral).toBe("grid_standard");
  });

  it("rejects ids that could reach outside data/stores", () => {
    for (const id of ["../package", "..%2Fpackage", "Croiala", "a/b", "", "x".repeat(33)]) expect(storeConfig(id)).toBeUndefined();
    expect(storeConfig("no-such-store")).toBeUndefined();
  });
});
