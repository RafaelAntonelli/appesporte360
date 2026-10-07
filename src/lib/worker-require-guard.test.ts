import { describe, expect, it } from "vitest";
import { guardWorkerRequire } from "./worker-require-guard";

describe("Worker module initialization", () => {
  it("removes reliance on unavailable import.meta.url from bundler helpers", () => {
    expect(guardWorkerRequire("const require = createRequire(import.meta.url);"))
      .toBe('const require = createRequire("file:///");');
  });

  it("also normalizes the Nitro-generated fallback", () => {
    const input = 'createRequire(import.meta.url || "file:///")';
    expect(guardWorkerRequire(input)).toBe('createRequire("file:///")');
    expect(guardWorkerRequire(guardWorkerRequire(input))).toBe(guardWorkerRequire(input));
  });

  it("leaves explicit module paths and unrelated code intact", () => {
    const input = 'createRequire("/app/package.json"); const url = import.meta.url;';
    expect(guardWorkerRequire(input)).toBe(input);
  });
});