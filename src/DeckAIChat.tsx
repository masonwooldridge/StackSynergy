import { MAX_CONVERSATION_TURNS } from "../shared/aiConversationMemory";
import { parseAIRequest, requestSummary } from "../shared/aiConstraints";
import { countAIRequest } from "../shared/aiConstraints";
import { useEffect, useRef, useState } from "react";
import type { Card, Document } from "../shared/model";
import { api, isAbortError } from "./api";
import CommanderPicker from "./CommanderPicker";
import CardThumbnail from "./CardThumbnail";
import AISwapReview, { type AIReview, type ReviewState } from "./AISwapReview";
import { providerTurns } from "./aiConversation";
type Turn = {
  role: "user" | "assistant";
  content: string;
  cards?: Card[];
  review?: AIReview | null;
  reviewState?: ReviewState;
  noSwapReason?: string | null;
};
type Status = { enabled: boolean; model: string; message: string };
export default function DeckAIChat({
  documents,
  scope,
  ownerKey,
  initialDeckId,
  onSave,
  onAccountSaved,
  onInspect,
}: {
  documents: Document[];
  scope: "guest" | "account";
  ownerKey: string;
  initialDeckId: string;
  onSave: (d: Document) => Promise<Document>;
  onAccountSaved: (d: Document) => void;
  onInspect: (c: Card) => void;
}) {
  const [id, setId] = useState(initialDeckId),
    [commander, setCommander] = useState<Card | null>(null),
    [budget, setBudget] = useState("25"),
    [bracket, setBracket] = useState(3),
    [ownedOnly, setOwnedOnly] = useState(false),
    [status, setStatus] = useState<Status | null>(null),
    [turns, setTurns] = useState<Turn[]>([]),
    [loadedKey, setLoadedKey] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [working, setWorking] = useState<"chat" | "apply" | null>(null);
  const deck = documents.find(
      (d) => d.id === id && d.kind === "deck" && !d.deleted,
    ),
    collections = documents.filter(
      (d) => d.kind === "collection" && !d.deleted,
    ),
    pending = useRef<AbortController | null>(null),
    epoch = useRef(0),
    alive = useRef(true),
    selectionKey = ownerKey + ":" + scope + ":" + id + ":" + (commander?.id || ""),
    contextKey = JSON.stringify({
      deck,
      collections,
      budget,
      bracket,
      ownedOnly,
    });
  const activeReview = [...turns]
    .reverse()
    .find((t) => t.review && t.reviewState === "pending")?.review;
  useEffect(() => {
    alive.current = true;
    const c = new AbortController();
    api<Status>("/deck-ai/status", undefined, undefined, c.signal)
      .then(setStatus)
      .catch((e) => {
        if (!isAbortError(e)) setError(e.message);
      });
    return () => {
      alive.current = false;
      c.abort();
      pending.current?.abort();
    };
  }, []);
  useEffect(() => {
    pending.current?.abort();
    epoch.current++;
    setWorking(null);
    let saved: {turns?: Turn[]; budget?: string; bracket?: number; ownedOnly?: boolean} = {};
    try { saved = JSON.parse(sessionStorage.getItem("cardchasm-ai-thread-v1:" + selectionKey) || "{}"); } catch { /* In-memory conversation still works. */ }
    setTurns(Array.isArray(saved.turns) ? saved.turns.filter(t => (t.role === "user" || t.role === "assistant") && typeof t.content === "string").slice(0, MAX_CONVERSATION_TURNS).map(t => ({...t, reviewState: t.reviewState === "pending" ? "stale" : t.reviewState})) : []);
    setBudget(typeof saved.budget === "string" ? saved.budget : "25");
    setBracket(typeof saved.bracket === "number" ? saved.bracket : 3);
    setOwnedOnly(saved.ownedOnly === true);
    setMessage("");
    setLoadedKey(selectionKey);
    setSelected([]);
    setNotice("");
    setError("");
  }, [selectionKey]);
  useEffect(() => {
    if (loadedKey !== selectionKey) return;
    try { sessionStorage.setItem("cardchasm-ai-thread-v1:" + selectionKey, JSON.stringify({turns, budget, bracket, ownedOnly})); } catch { setNotice("Conversation storage is unavailable; keep this page open to retain the current thread."); }
  }, [loadedKey, selectionKey, turns, budget, bracket, ownedOnly]);
  useEffect(() => {
    pending.current?.abort();
    epoch.current++;
    setWorking(null);
    setSelected([]);
    setTurns((all) =>
      all.map((t) =>
        t.reviewState === "pending" ? { ...t, reviewState: "stale" } : t,
      ),
    );
  }, [contextKey]);
  function cancel() {
    pending.current?.abort();
    epoch.current++;
    setWorking(null);
    setNotice(
      "Cancelled locally. No swaps applied. An already-started provider request may still incur charges.",
    );
  }
  async function send() {
    if (!message.trim() || !status?.enabled || working || turns.length >= MAX_CONVERSATION_TURNS - 1) return;
    const token = ++epoch.current,
      c = new AbortController();
    pending.current = c;
    setWorking("chat");
    setError("");
    setNotice("");
    setSelected([]);
    const prior = turns.map((t) =>
        t.reviewState === "pending"
          ? { ...t, reviewState: "stale" as const }
          : t,
      ),
      next: Turn[] = [...prior, { role: "user", content: message.trim() }];
    setTurns(next);
    try {
      const reply = await api<{
        reply: string;
        cards: Card[];
        review: AIReview | null;
        source: string;
        noSwapReason?: string | null;
      }>(
        "/deck-ai/chat",
        {
          scope,
          ...(scope === "account"
            ? { deckId: deck?.id }
            : { deck, collections }),
          commanderId: !deck ? commander?.id : undefined,
          budget: Number(budget),
          bracket: deck?.commanderBracket || bracket,
          ownedOnly,
          turns: providerTurns(next),
        },
        undefined,
        c.signal,
      );
      if (!alive.current || token !== epoch.current) return;
      setTurns([
        ...next,
        {
          role: "assistant",
          content: reply.reply,
          cards: reply.cards,
          review: reply.review,
          reviewState: reply.review ? "pending" : undefined,
          noSwapReason: reply.noSwapReason,
        },
      ]);
      setMessage("");
      setNotice(reply.source);
    } catch (e) {
      if (alive.current && token === epoch.current && !isAbortError(e))
        setError((e as Error).message);
    } finally {
      if (alive.current && token === epoch.current) setWorking(null);
    }
  }
  async function apply() {
    if (!activeReview || !deck || !selected.length) return;
    const token = ++epoch.current,
      c = new AbortController();
    pending.current = c;
    setWorking("apply");
    setError("");
    try {
      const result = await api<{ document: Document; saved: boolean }>(
        "/deck-ai/apply",
        {
          scope,
          reviewId: activeReview.id,
          pairIds: selected,
          ...(scope === "guest" ? { deck, collections } : {}),
        },
        undefined,
        c.signal,
      );
      if (!alive.current || token !== epoch.current) return;
      if (result.saved) onAccountSaved(result.document);
      else await onSave(result.document);
      if (alive.current) {
        setTurns((all) =>
          all.map((t) =>
            t.review?.id === activeReview.id
              ? {
                  ...t,
                  review: {
                    ...t.review!,
                    pairs: t.review!.pairs.filter((p) =>
                      selected.includes(p.id),
                    ),
                    matchingAfter: t.review!.constraints
                      ? countAIRequest(result.document, t.review!.constraints)
                      : t.review!.matchingAfter,
                  },
                  reviewState: "applied",
                }
              : t,
          ),
        );
        setSelected([]);
        setNotice(
          "Reviewed swaps saved. Commander, lands and 100-card count preserved.",
        );
      }
    } catch (e) {
      if (alive.current && token === epoch.current && !isAbortError(e))
        setError((e as Error).message);
    } finally {
      if (alive.current && token === epoch.current) setWorking(null);
    }
  }
  const draft = message.trim()
    ? parseAIRequest(
        [...providerTurns(turns), { role: "user", content: message }],
        {
          commander:
            deck?.entries.find((e) => e.board === "commander")?.card ||
            commander ||
            undefined,
        },
      )
    : null;
  const inputValid =
    budget !== "" &&
    Number.isFinite(Number(budget)) &&
    Number(budget) >= 0 &&
    Number(budget) <= 10000;
  return (
    <section
      className="upgrade-workbench ai-chat"
      aria-label="AI deck assistant"
    >
      <h1>Deck assistant</h1>
      <p>
        Tell me what this deck should do better. Compare every proposed cut and
        addition before you save.
      </p>
      <details className="ai-connection">
        <summary>{status?.enabled ? "AI connected" : "AI connection"}</summary>
        <p role="status">
          {status ? status.message : "Checking AI availability…"}
          {status && (
            <>
              {" "}
              Model: {status.model}. Up to 80 messages, 3 requests/minute and
              10/server/day.
            </>
          )}
        </p>
      </details>
      <fieldset disabled={!!working}>
        <label>
          Deck
          <select
            aria-label="AI deck"
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="">New commander or idea</option>
            {documents
              .filter((d) => d.kind === "deck" && !d.deleted)
              .map((d) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
        {!deck && (
          <>
            <label>Commander (optional)</label>
            <CommanderPicker
              onSelect={setCommander}
              onChange={() => setCommander(null)}
            />
          </>
        )}
        <details className="ai-constraints">
          <summary>
            Constraints · ${budget} ·{" "}
            {ownedOnly ? "Owned only" : "All additions"}
            {deck?.commanderBracket
              ? ` · Bracket ${deck.commanderBracket}`
              : ""}{" "}
            · Edit
          </summary>
          <div className="ai-context-row">
            <label>
              New-purchase budget (USD)
              <input
                aria-label="AI purchase budget"
                type="number"
                min="0"
                max="10000"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
            <label>
              Bracket target
              {deck ? (
                <span className="field-value">
                  {deck.commanderBracket || bracket} · follows this deck’s
                  settings
                </span>
              ) : (
                <select
                  aria-label="AI bracket"
                  disabled={!!deck}
                  value={bracket}
                  onChange={(e) => setBracket(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={ownedOnly}
              onChange={(e) => setOwnedOnly(e.target.checked)}
            />
            Use verified owned additions only
          </label>
        </details>
      </fieldset>
      <p className="builder-help">
        Changes are proposals until you review and apply. Protected deck notes
        and the spending guard stay in force.
      </p>
      <p className="muted">This deck’s conversation is retained in this browser tab through reloads. Up to 80 messages are sent with the latest deck state. Prior assistant text is limited to 2,000 characters per message; review outcomes are retained. Pending reviews require a fresh request after reload.</p>
      <div className="ai-transcript" role="log" aria-label="Deck conversation">
        {turns.map((t, i) => (
          <div className={"ai-turn " + t.role} key={i}>
            <strong>{t.role === "user" ? "You" : "Assistant"}</strong>
            {t.review ? (
              <>
                <p>
                  {t.review.pairs.length} proposed{" "}
                  {t.review.pairs.length === 1 ? "swap" : "swaps"} for{" "}
                  {deck?.name || "this deck"}.
                </p>
                <AISwapReview
                  review={t.review}
                  deck={deck}
                  state={t.reviewState || "stale"}
                  selected={selected}
                  working={!!working}
                  onSelect={(id, on) =>
                    setSelected((a) =>
                      on ? [...a, id] : a.filter((x) => x !== id),
                    )
                  }
                  onApply={() => void apply()}
                  onInspect={onInspect}
                />
              </>
            ) : (
              <>
                <p style={{ whiteSpace: "pre-wrap" }}>{t.content}</p>
                {t.role === "assistant" && (
                  <div className="ai-no-swaps">
                    <strong>No swaps proposed</strong>
                    <p>
                      {t.noSwapReason ||
                        "This reply is advice only. No card changes are queued or saved."}
                    </p>
                  </div>
                )}
                {!!t.cards?.length && (
                  <div className="ai-sources" aria-label="Cards discussed">
                    {t.cards.map((c) => (
                      <button
                        key={c.id}
                        onClick={(e) => {
                          e.currentTarget.focus();
                          onInspect(c);
                        }}
                        aria-label={"Inspect AI source " + c.name}
                      >
                        <CardThumbnail card={c} />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      {working === "chat" && (
        <p role="status">Checking your deck and comparing options…</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="ai-composer">
        <label>
          Your goals
          <textarea
            aria-label="Message the deck assistant"
            maxLength={2000}
            value={message}
            disabled={!!working}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="I run out of cards. Find creature-entry draw that works with Satya; keep my combo pieces."
          />
        </label>
        {draft &&
        (draft.terminology?.recognized.length ||
          draft.clarifications?.length) ? (
          <div
            className="ai-request-recognition"
            aria-label="Recognized MTG request"
          >
            <strong>
              {draft.mode === "explain"
                ? "MTG term lookup"
                : "Recognized request"}
            </strong>
            <p>{requestSummary(draft)}</p>
            {draft.terminology?.recognized.slice(0, 3).map((t) => (
              <details key={t.id}>
                <summary>{t.label}</summary>
                <p>{t.definition}</p>
                {t.caveat && <p>{t.caveat}</p>}
              </details>
            ))}
            {draft.terminology?.corrections.map((c) => (
              <p key={c}>{c}</p>
            ))}
            {draft.clarifications?.map((c) => (
              <p key={c}>{c}</p>
            ))}
          </div>
        ) : null}
        <div className="ai-composer-actions">
          <button
            className="primary"
            disabled={
              !status?.enabled ||
              !!working ||
              !inputValid ||
              !message.trim() ||
              turns.length >= MAX_CONVERSATION_TURNS - 1
            }
            onClick={() => void send()}
          >
            {working === "chat" ? "Thinking…" : "Send to AI"}
          </button>
          {working === "chat" && (
            <button onClick={cancel}>Cancel AI request</button>
          )}
          <button
            disabled={!!working}
            onClick={() => {
              setTurns([]);
              setSelected([]);
              setNotice("New conversation.");
              setError("");
            }}
          >
            New conversation
          </button>
        </div>
      </div>
      {turns.length >= MAX_CONVERSATION_TURNS - 1 && (
        <p>
          This thread has reached 80 messages. Start a new conversation and restate
          the preferences you want carried forward; older constraints are not silently dropped.
        </p>
      )}
    </section>
  );
}
