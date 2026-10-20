import { expect, it } from "vitest";
import { version as react } from "react";
import { version as renderer } from "react-dom";
it("uses exactly matching React and DOM renderer versions", () => {
  expect(react).toBe(renderer);
});
