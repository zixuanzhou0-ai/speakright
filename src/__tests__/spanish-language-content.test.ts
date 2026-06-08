import { describe, expect, it } from "vitest";
import { REQUIRED_SPANISH_UNITS } from "@/lib/language-critical-units";
import { LANGUAGE_LEARNING_DECKS } from "@/lib/language-learning-decks";
import {
  expectDeckTargetsResolvable,
  expectRequiredUnits,
  expectSourceBackedUnits,
} from "./language-content-helpers";

describe("Spanish pronunciation content", () => {
  it("covers the Spanish IPA-first beta inventory", () => {
    expectRequiredUnits("es-ES", REQUIRED_SPANISH_UNITS);
  });

  it("keeps Spanish units source-backed and learner-facing", () => {
    expectSourceBackedUnits("es-ES");
  });

  it("expands Spanish diagnostic, contrast, and sentence decks", () => {
    const deck = LANGUAGE_LEARNING_DECKS["es-ES"];

    expect(deck.diagnosticWords.length).toBeGreaterThanOrEqual(22);
    expect(deck.contrastDeck.length).toBeGreaterThanOrEqual(16);
    expect(deck.sentenceDeck.length).toBeGreaterThanOrEqual(16);
    expectDeckTargetsResolvable("es-ES");
  });

  it("marks dialect-sensitive Spanish units honestly", () => {
    const deckText = [
      ...LANGUAGE_LEARNING_DECKS["es-ES"].contrastDeck.map((item) => item.focus),
      ...LANGUAGE_LEARNING_DECKS["es-ES"].sentenceDeck.map((item) => item.focus),
    ].join(" ");

    expect(deckText).toMatch(/es-ES|Castilian|拉美|方言|seseo/i);
  });
});
