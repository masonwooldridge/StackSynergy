import {
  mechanicalPrerequisites,
  reliableRole,
} from "../shared/mechanicalSupport";
import { expect, it } from "vitest";
import type { Card } from "../shared/model";
import {
  deploymentCost,
  deploymentPenalty,
  manaPayment,
} from "../shared/deploymentCost";
import { strategicProfile } from "../shared/strategicQuality";
const c = (name: string, text: string, cmc = 1, type = "Instant") =>
  ({ id: name, name, oracle_text: text, cmc, type_line: type }) as Card;
it("separates Spree mode payments from printed mana value", () => {
  const card = c(
    "modal",
    "Spree\n+{1}{U} — Counter target spell.\n+{2} — Draw two cards.",
  );
  expect(deploymentCost(card, "interaction")).toMatchObject({
    printedManaValue: 1,
    additionalMana: 2,
  });
  expect(deploymentPenalty(card, "interaction")).toBeGreaterThan(
    deploymentPenalty(c("direct", "Counter target spell.", 2), "interaction"),
  );
});
it("exposes deferred losing obligations rather than treating zero printed mana as free", () => {
  const p = deploymentCost(
    c(
      "pact",
      "Counter target spell.\nAt the beginning of your next upkeep, pay {3}{U}{U}. If you don't, you lose the game.",
      0,
    ),
  );
  expect(p).toMatchObject({
    printedManaValue: 0,
    delayedMana: 5,
    lossRisk: true,
    confidence: "maintenance-dependent",
  });
  expect(p.notes.join(" ")).toContain("Failure loses the game");
});
it("only charges role-relevant activations and handles entry attachment", () => {
  const equipment = c(
    "blade",
    "When this Equipment enters, attach it to target creature you control.\nEquipped creature has hexproof.\nEquip {3}",
    2,
    "Artifact — Equipment",
  );
  expect(deploymentCost(equipment, "protection").equipMana).toBe(0);
  expect(
    strategicProfile(equipment, c("commander", "", 3, "Creature"))
      .firstDeploymentMana,
  ).toBe(2);
  expect(
    deploymentCost(
      c(
        "utility",
        "{6}, {T}: Draw a card.\n{1}, {T}: Destroy target creature.",
      ),
      "interaction",
    ).activationMana,
  ).toBe(1);
});
it("does not invent prices or blanket penalties for sacrifice and alternative-cost engines", () => {
  const sacrifice = c(
    "sacrifice",
    "As an additional cost to cast this spell, sacrifice a creature.\nDraw two cards.",
  );
  expect(deploymentCost(sacrifice, "advantage").nonMana).toContain(
    "sacrifice a creature",
  );
  expect(deploymentPenalty(sacrifice, "advantage")).toBe(0);
  const pitch = c(
    "pitch",
    "You may pay 1 life and exile a blue card from your hand rather than pay this spell's mana cost.\nCounter target spell.",
    5,
  );
  expect(deploymentCost(pitch)).toMatchObject({
    printedManaValue: 5,
    alternative: true,
  });
  expect(deploymentPenalty(pitch, "interaction")).toBe(0);
  expect(manaPayment("{X}{B/P}{E}")).toEqual({
    mana: 0,
    variable: true,
    energy: 1,
  });
});
it("reports finite energy maintenance without pricing energy as mana", () => {
  const prison = c(
    "prison",
    "When this enters, you get {E}{E}.\nAt the beginning of your first main phase, sacrifice this enchantment unless you pay {E}.",
    1,
    "Enchantment",
  );
  const p = deploymentCost(prison);
  expect(p.recurringMana).toBe(0);
  expect(p.confidence).toBe("maintenance-dependent");
  expect(p.notes.join(" ")).toContain("2 initial energy");
});

it("retains supported snow tutoring and rejects empty targets and opponent-kicker-only answers", () => {
  const tutor = c(
    "snow tutor",
    "Search your library for a snow land card, put it onto the battlefield tapped, then shuffle.",
    2,
    "Sorcery",
  );
  const snow = c("snow", "", 0, "Basic Snow Land — Forest");
  expect(mechanicalPrerequisites(tutor, [])).toHaveLength(1);
  expect(mechanicalPrerequisites(tutor, [snow])).toHaveLength(0);
  expect(reliableRole(tutor, "ramp", undefined, [])).toBe(false);
  expect(reliableRole(tutor, "ramp", undefined, [snow])).toBe(true);
  expect(
    reliableRole(
      c("narrow", "Counter target spell if it was kicked."),
      "interaction",
    ),
  ).toBe(false);
  expect(reliableRole(c("broad", "Counter target spell."), "interaction")).toBe(
    true,
  );
});
