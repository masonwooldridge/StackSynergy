export const CARD_CACHE_TTL = 86400000;
export class CardDataError extends Error {
  status: number;
  retryAfter: number;
  constructor(message: string, status = 502, retryAfter = 0) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
export function retrySeconds(
  value: string | null,
  now: number,
  fallback: number,
) {
  const n =
    value && /^\d+(?:\.\d+)?$/.test(value)
      ? Number(value)
      : value
        ? (Date.parse(value) - now) / 1000
        : NaN;
  return Math.min(
    86400,
    Math.max(fallback, Number.isFinite(n) ? Math.ceil(n) : fallback),
  );
}
export function validCardPayload(path: string, value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const card = (x: unknown) =>
    !!x &&
    typeof x === "object" &&
    typeof (x as typeof v).id === "string" &&
    typeof (x as typeof v).name === "string" &&
    (typeof (x as typeof v).type_line === "string" ||
      (Array.isArray((x as typeof v).card_faces) &&
        ((x as typeof v).card_faces as Record<string, unknown>[]).length > 0 &&
        ((x as typeof v).card_faces as Record<string, unknown>[]).every(
          (f) =>
            !!f && typeof f === "object" && typeof f.type_line === "string",
        ))) &&
    Array.isArray((x as typeof v).color_identity) &&
    !!(x as typeof v).legalities;
  if (path.startsWith("/cards/autocomplete") || path.startsWith("/catalog/"))
    return Array.isArray(v.data) && v.data.every((x) => typeof x === "string");
  if (path.startsWith("/sets"))
    return (
      Array.isArray(v.data) &&
      v.data.every(
        (x) => !!x && typeof x === "object" && typeof x.code === "string",
      )
    );
  if (path.startsWith("/cards/search"))
    return (
      Array.isArray(v.data) &&
      v.data.every(card) &&
      (!v.has_more || typeof v.next_page === "string")
    );
  return card(v);
}
type Hit = { data: string; expires: number };
export function createCardProvider(options: {
  read: (path: string) => Hit | undefined;
  write: (path: string, data: string, expires: number) => void;
  fetch?: typeof fetch;
  now?: () => number;
  spacing?: number;
  maxPending?: number;
}) {
  const now = options.now || Date.now,
    get: typeof fetch =
      options.fetch || ((input, init) => globalThis.fetch(input, init)),
    pending = new Map<
      string,
      {
        promise: Promise<unknown>;
        controller: AbortController;
        users: number;
        done: boolean;
      }
    >();
  let chain = Promise.resolve(),
    next = 0,
    cooldown = 0,
    cooldownStatus = 429;
  const cooldownError = () =>
    new CardDataError(
      `Card data is temporarily unavailable. Wait ${Math.max(1, Math.ceil((cooldown - now()) / 1000))} seconds, then retry explicitly; your settings are retained.`,
      cooldownStatus,
      Math.max(1, Math.ceil((cooldown - now()) / 1000)),
    );
  const envelope = (data: unknown, at: number, cached: boolean) => ({
    ...(data as object),
    cardData: {
      source: cached ? "Scryfall cache" : "Scryfall response",
      retrievedAt: new Date(at).toISOString(),
      expiresAt: new Date(at + CARD_CACHE_TTL).toISOString(),
    },
  });
  const pause = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Cancelled", "AbortError"));
        return;
      }
      const abort = () => {
        clearTimeout(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve();
      }, ms);
      signal.addEventListener("abort", abort, { once: true });
    });
  return async function scryfall(
    path: string,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (!/^\/(?:cards\/|catalog\/|sets(?:$|\/))/.test(path))
      throw Error("Unsupported card endpoint");
    if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
    const hit = options.read(path);
    if (hit && hit.expires > now()) {
      try {
        const value = JSON.parse(hit.data);
        if (validCardPayload(path, value))
          return envelope(value, hit.expires - CARD_CACHE_TTL, true);
      } catch {
        /* Reverify invalid cache; never return malformed facts. */
      }
    }
    if (cooldown > now()) throw cooldownError();
    let task = pending.get(path);
    if (!task) {
      if (pending.size >= (options.maxPending ?? 64))
        throw new CardDataError(
          "Card data queue is busy. Wait 2 seconds and retry explicitly; settings are retained.",
          502,
          2,
        );
      const controller = new AbortController();
      const promise = chain.then(async () => {
        if (cooldown > now()) throw cooldownError();
        await pause(Math.max(0, next - now()), controller.signal);
        if (cooldown > now()) throw cooldownError();
        next = now() + (options.spacing ?? 150);
        let response: Response;
        try {
          response = await get("https://api.scryfall.com" + path, {
            headers: {
              "User-Agent": "StackSynergy/0.1 (local MTG companion)",
              Accept: "application/json;q=0.9,*/*;q=0.8",
            },
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(15000),
            ]),
          });
        } catch {
          if (controller.signal.aborted)
            throw new DOMException("Cancelled", "AbortError");
          cooldown = now() + 2000;
          cooldownStatus = 502;
          throw new CardDataError(
            "Card data connection failed. Wait 2 seconds, then retry explicitly; no partial result was saved.",
            502,
            2,
          );
        }
        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) {
            const wait = retrySeconds(
              response.headers.get("Retry-After"),
              now(),
              response.status === 429 ? 30 : 2,
            );
            cooldown = now() + wait * 1000;
            cooldownStatus = response.status === 429 ? 429 : 502;
            throw cooldownError();
          }
          throw new CardDataError(`Card provider returned ${response.status}`);
        }
        let data: unknown;
        try {
          data = await response.json();
        } catch {
          throw new CardDataError(
            "Card provider returned malformed JSON. No partial result was used; retry explicitly.",
          );
        }
        if (!validCardPayload(path, data))
          throw new CardDataError(
            "Card provider returned incomplete card facts. No partial result was used; retry explicitly.",
          );
        const at = now();
        options.write(path, JSON.stringify(data), at + CARD_CACHE_TTL);
        return envelope(data, at, false);
      });
      task = { promise, controller, users: 0, done: false };
      pending.set(path, task);
      const current = task;
      chain = promise.then(
        () => undefined,
        () => undefined,
      );
      void promise.then(
        () => {
          current.done = true;
          pending.delete(path);
        },
        () => {
          current.done = true;
          pending.delete(path);
        },
      );
    }
    const current = task;
    if (current.users >= 128)
      throw new CardDataError(
        "Card data lookup is busy. Wait 2 seconds and retry explicitly.",
        502,
        2,
      );
    current.users++;
    let abort: (() => void) | undefined;
    try {
      return await (signal
        ? Promise.race([
            current.promise,
            new Promise<never>((_resolve, reject) => {
              abort = () => reject(new DOMException("Cancelled", "AbortError"));
              signal.addEventListener("abort", abort, { once: true });
              if (signal.aborted) abort();
            }),
          ])
        : current.promise);
    } finally {
      if (abort) signal?.removeEventListener("abort", abort);
      current.users--;
      if (!current.users && !current.done) current.controller.abort();
    }
  };
}
