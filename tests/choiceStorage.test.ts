import { afterEach, expect, it, vi } from "vitest";
import { withChoiceLock } from "../src/choiceStorage";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("uses a per-deck lock and returns the edit result", async () => {
  const request = vi.fn(
    async (_key: string, _options: unknown, fn: () => unknown) => fn(),
  );
  vi.stubGlobal("navigator", { locks: { request } });
  expect(await withChoiceLock("deck:A", () => 42)).toBe(42);
  expect(request.mock.calls[0][0]).toBe("stacksynergy:deck:A");
});
it("supports the optimistic fallback without the Locks API", async () => {
  vi.stubGlobal("navigator", {});
  expect(await withChoiceLock("deck:A", () => 42)).toBe(42);
});
it("does not run an unsafe fallback write after lock failure", async () => {
  const edit = vi.fn();
  vi.stubGlobal("navigator", {
    locks: {
      request: () =>
        Promise.reject(
          new DOMException("fixture lock failure", "SecurityError"),
        ),
    },
  });
  await expect(withChoiceLock("deck:A", edit)).rejects.toThrow(
    "fixture lock failure",
  );
  expect(edit).not.toHaveBeenCalled();
});
it("retains callback storage failures instead of claiming a saved choice", async () => {
  vi.stubGlobal("navigator", {
    locks: {
      request: async (_key: string, _options: unknown, fn: () => unknown) =>
        fn(),
    },
  });
  await expect(
    withChoiceLock("deck:A", () => {
      throw new Error("fixture storage quota");
    }),
  ).rejects.toThrow("fixture storage quota");
});

it("bounds a queued lock wait without performing a fallback write", async () => {
  vi.useFakeTimers();
  const edit = vi.fn();
  vi.stubGlobal("navigator", {
    locks: {
      request: (_key: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          ),
        ),
    },
  });
  const result = withChoiceLock("deck:A", edit);
  const failure = expect(result).rejects.toThrow("it has not been saved");
  await vi.advanceTimersByTimeAsync(15000);
  await failure;
  expect(edit).not.toHaveBeenCalled();
});
