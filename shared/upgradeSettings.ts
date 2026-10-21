export function upgradeSettingsKey(scope: string, id: string) {
  return "cardchasm-upgrade-constraints-v1:" + scope + ":" + id;
}
export function readUpgradeSettings(raw: string | null): {
  budget: string;
  ownedOnly: boolean;
} {
  const fallback = { budget: "25", ownedOnly: false };
  try {
    const saved = raw ? JSON.parse(raw) : null;
    return saved?.version === 1 &&
      typeof saved.budget === "string" &&
      (saved.budget === "" ||
        (saved.budget.trim() !== "" &&
          Number.isFinite(Number(saved.budget)) &&
          Number(saved.budget) >= 0))
      ? { budget: saved.budget, ownedOnly: saved.ownedOnly === true }
      : fallback;
  } catch {
    return fallback;
  }
}
export function encodeUpgradeSettings(budget: string, ownedOnly: boolean) {
  return JSON.stringify({ version: 1, budget, ownedOnly });
}
