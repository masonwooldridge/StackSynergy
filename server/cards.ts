import Database from "better-sqlite3";
import { createCardProvider } from "./cardProvider.ts";
import { createCardCache } from "./cardCache.ts";
const cache = new Database(process.env.CARD_CACHE || "data/cards.sqlite");
export const scryfall = createCardProvider(createCardCache(cache));
