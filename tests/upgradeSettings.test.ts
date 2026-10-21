import { expect, it } from "vitest";
import {
  upgradeSettingsKey,
  readUpgradeSettings,
  encodeUpgradeSettings,
} from "../shared/upgradeSettings";
it("round-trips reload constraints while isolating deck, owner and library mode", () => {
  const memory = new Map<string, string>(),
    a = upgradeSettingsKey("guest:guest", "A"),
    b = upgradeSettingsKey("guest:guest", "B");
  memory.set(a, encodeUpgradeSettings("37", true));
  expect(readUpgradeSettings(memory.get(a) || null)).toEqual({
    budget: "37",
    ownedOnly: true,
  });
  expect(readUpgradeSettings(memory.get(b) || null)).toEqual({
    budget: "25",
    ownedOnly: false,
  });
  expect(upgradeSettingsKey("account:alice", "A")).not.toBe(a);
  expect(upgradeSettingsKey("account:bob", "A")).not.toBe(
    upgradeSettingsKey("account:alice", "A"),
  );
});
it("retains an empty draft and zero cap while rejecting malformed/negative/nonfinite persisted controls", () => {
  for (const budget of ["", "0"])
    expect(
      readUpgradeSettings(encodeUpgradeSettings(budget, false)).budget,
    ).toBe(budget);
  for (const raw of [
    "{",
    JSON.stringify({ version: 2, budget: "37" }),
    encodeUpgradeSettings("-1", true),
    encodeUpgradeSettings("Infinity", true),
    encodeUpgradeSettings(" ", true),
  ])
    expect(readUpgradeSettings(raw)).toEqual({
      budget: "25",
      ownedOnly: false,
    });
});
