import { z } from "zod";
const cardSchema = z
  .object({ id: z.string().uuid(), name: z.string().min(1).max(300) })
  .passthrough();
const entrySchema = z.object({
  id: z.string().uuid(),
  card: cardSchema,
  qty: z.number().int().min(1).max(10000),
  board: z.enum(["mainboard", "sideboard", "maybeboard", "commander"]),
  language: z.string().max(30),
  condition: z.string().max(40),
  finish: z.string().max(30),
  purchasePrice: z.string().max(30),
  notes: z.string().max(4000),
  tags: z.string().max(500),
});
export const documentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(150),
  kind: z.enum(["deck", "collection", "wishlist"]),
  format: z.enum([
    "commander",
    "standard",
    "modern",
    "pioneer",
    "pauper",
    "legacy",
    "vintage",
  ]),
  notes: z.string().max(10000),
  entries: z.array(entrySchema).max(20000),
  revision: z.number().int().min(0),
  casualProxyAccepted: z.boolean().optional(),
  deleted: z.boolean().optional(),
  commanderBracket:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)]).optional(),
  strategy: z.object({tags:z.array(z.string().max(60)).max(12),creatureTypes:z.array(z.string().max(60)).max(2),labels:z.array(z.string().max(60)).max(12)}).optional(),
});
