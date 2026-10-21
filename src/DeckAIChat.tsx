import {withChoiceLock} from "./choiceStorage";
import {cardPreferenceStorageKey,migrateCardPreferences,messagePreferences, normalizePreferences, preferenceFor, setCardPreference, type CardPreference} from "../shared/cardPreferences";
import {budgetConflict, type BudgetMeaning} from "../shared/assistantBudget";
import { MAX_CONVERSATION_TURNS } from "../shared/aiConversationMemory";
import { parseAIRequest, requestSummary } from "../shared/aiConstraints";
import { countAIRequest } from "../shared/aiConstraints";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Card, Document } from "../shared/model";
import { api, isAbortError, NetworkError } from "./api";
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
type BudgetThreadContext = {cap:number;meaning:BudgetMeaning;start:number};
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
    [budgetMeaning, setBudgetMeaning] = useState<BudgetMeaning>("purchases"),
    [bracket, setBracket] = useState(3),
    [ownedOnly, setOwnedOnly] = useState(false),
    [status, setStatus] = useState<Status | null>(null),
    [turns, setTurns] = useState<Turn[]>([]),
    [loadedKey, setLoadedKey] = useState(""),
    [preferences, setPreferences] = useState<CardPreference[]>([]),
    [preferenceBase, setPreferenceBase] = useState<string|null>(null),
    [preferenceLoadFailed,setPreferenceLoadFailed] = useState(false),
    [ignoreTranscriptRejections, setIgnoreTranscriptRejections] = useState(false),
    [clearedPreferences, setClearedPreferences] = useState<{preferences:CardPreference[];ignore:boolean;raw?:string;afterRaw?:string}|null>(null),
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
    preferenceStorageKey = cardPreferenceStorageKey(ownerKey,scope,id,commander?.oracle_id || commander?.id || ""),
    contextKey = JSON.stringify({
      deck,
      collections,
      budget,
      budgetMeaning,
      bracket,
      ownedOnly,
    });
  const budgetThread = useRef<BudgetThreadContext | null>(null);
  const documentsRef=useRef(documents);documentsRef.current=documents;
  const preferenceRaw=useRef<string|null>(null);
  const currentSelection=useRef(selectionKey);currentSelection.current=selectionKey;
  const preferenceBaseRef=useRef(preferenceBase);preferenceBaseRef.current=preferenceBase;
  const workingRef=useRef(working);workingRef.current=working;
  const adoptChoices = useCallback((raw:string|null,notice:string)=>{
    preferenceRaw.current=raw;setPreferenceBase(raw);setClearedPreferences(null);setSelected([]);
    setTurns(all=>all.map(t=>t.reviewState==="pending"?{...t,reviewState:"stale"}:t));
    if(workingRef.current==="chat"){pending.current?.abort();pending.current=null;epoch.current++;setWorking(null);}
    try{const value=raw?JSON.parse(raw):{version:1,preferences:[],ignoreTranscriptRejections:false};if(value.version!==1||!Array.isArray(value.preferences))throw Error();setPreferences(normalizePreferences(value.preferences));setIgnoreTranscriptRejections(value.ignoreTranscriptRejections===true);setPreferenceLoadFailed(false);setNotice(notice);}catch{setPreferenceLoadFailed(true);setNotice("Remembered choices changed but could not be read. The stored value has been preserved.");}
  },[]);
  function currentChoices(){try{const raw=localStorage.getItem(preferenceStorageKey);if(raw!==preferenceBaseRef.current){adoptChoices(raw,"Another tab changed this deck's choices. Latest choices loaded; repeat your action. Your draft is retained.");return false;}return true;}catch{setError("Remembered choices could not be checked. Keep this page open and restore device storage before retrying.");return false;}}

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
    pending.current = null;
    epoch.current++;
    setWorking(null);
    let saved: {turns?: Turn[]; budget?: string; budgetMeaning?: BudgetMeaning; bracket?: number; ownedOnly?: boolean; draft?: string; budgetContext?: BudgetThreadContext} = {};
    try { saved = JSON.parse(sessionStorage.getItem("cardchasm-ai-thread-v1:" + selectionKey) || "{}"); } catch { /* In-memory conversation still works. */ }
    const storedContext=saved.budgetContext;
    budgetThread.current=storedContext && Number.isFinite(storedContext.cap) && (storedContext.meaning === "deck" || storedContext.meaning === "purchases") && Number.isInteger(storedContext.start) && storedContext.start >= 0 && storedContext.start < (saved.turns?.length || 0) ? storedContext : saved.turns?.length ? {cap:Number(saved.budget)||25,meaning:saved.budgetMeaning === "deck"?"deck":"purchases",start:0}:null;
    setTurns(Array.isArray(saved.turns) ? saved.turns.filter(t => (t.role === "user" || t.role === "assistant") && typeof t.content === "string").slice(0, MAX_CONVERSATION_TURNS).map(t => ({...t, reviewState: t.reviewState === "pending" ? "stale" : t.reviewState})) : []);
    setBudget(typeof saved.budget === "string" ? saved.budget : "25");
    setBudgetMeaning(saved.budgetMeaning === "deck" ? "deck" : "purchases");
    setBracket(typeof saved.bracket === "number" ? saved.bracket : 3);
    setOwnedOnly(saved.ownedOnly === true);
    setPreferenceLoadFailed(false);
    try {
      const stored = localStorage.getItem(preferenceStorageKey);preferenceRaw.current=stored;setPreferenceBase(stored);
      if (stored) { const value=JSON.parse(stored); if(value.version !== 1 || !Array.isArray(value.preferences)) throw Error("Unsupported remembered-choice storage"); setPreferences(normalizePreferences(value.preferences));setIgnoreTranscriptRejections(value.ignoreTranscriptRejections === true); }
      else {
        const known=[...documentsRef.current.flatMap(d=>d.entries.map(e=>e.card)),...(saved.turns||[]).flatMap(t=>[...(t.cards||[]),...(t.review?.pairs||[]).map(p=>p.add)])];
        const migrated=migrateCardPreferences(saved.turns||[],known,documentsRef.current.find(d=>d.id===id)?.entries.map(e=>e.card)||[]);
        setPreferences(migrated);setIgnoreTranscriptRejections(false);
      }
    } catch {setPreferenceLoadFailed(true);setPreferences([]);setIgnoreTranscriptRejections(false);setNotice("Remembered choices could not be loaded; the original stored value has not been deliberately cleared.");}
    setClearedPreferences(null);
    setMessage(typeof saved.draft === "string" ? saved.draft.slice(0,2000) : "");
    setLoadedKey(selectionKey);
    setSelected([]);
    setNotice("");
    setError("");
  }, [selectionKey, preferenceStorageKey, id]);
  useEffect(() => {
    if (loadedKey !== selectionKey) return;
    try { sessionStorage.setItem("cardchasm-ai-thread-v1:" + selectionKey, JSON.stringify({turns, budget, budgetMeaning, bracket, ownedOnly, draft:message,budgetContext:budgetThread.current})); } catch { setNotice("Conversation storage is unavailable; keep this page open to retain the current thread."); }
  }, [loadedKey, selectionKey, turns, budget, budgetMeaning, bracket, ownedOnly, message]);
  useEffect(() => {
    pending.current?.abort();
    pending.current = null;
    epoch.current++;
    setWorking(null);
    setSelected([]);
    setTurns((all) =>
      all.map((t) =>
        t.reviewState === "pending" ? { ...t, reviewState: "stale" } : t,
      ),
    );
  }, [contextKey]);
  useEffect(()=>{
    function changed(event:StorageEvent){if(event.storageArea===localStorage&&event.key===preferenceStorageKey)adoptChoices(localStorage.getItem(preferenceStorageKey),"Remembered choices changed in another tab. Current choices loaded; ask for a fresh review.");}
    window.addEventListener("storage",changed);return()=>window.removeEventListener("storage",changed);
  },[preferenceStorageKey,adoptChoices]);
  useEffect(() => {
    if (loadedKey !== selectionKey || preferenceLoadFailed) return;
    let cancelled=false;
    void withChoiceLock(preferenceStorageKey,()=>{if(cancelled||currentSelection.current!==selectionKey)return;const actual=localStorage.getItem(preferenceStorageKey);if(actual!==preferenceBase){adoptChoices(actual,"Current choices synchronized with another tab. Your draft is retained; review current choices before requesting again.");return;}const next=JSON.stringify({version:1,preferences,ignoreTranscriptRejections});if(next!==actual){localStorage.setItem(preferenceStorageKey,next);preferenceRaw.current=next;setPreferenceBase(next);}}).catch(()=>{if(!cancelled)setNotice("Card choices could not be saved on this device. Keep this page open; durable memory is unavailable.");});
    return()=>{cancelled=true;};
  },[loadedKey,selectionKey,preferenceStorageKey,preferences,ignoreTranscriptRejections,preferenceLoadFailed,preferenceBase,adoptChoices]);
  function remember(card:Card,state:CardPreference["state"]) {
    if(!navigator.locks&&!currentChoices())return;
    const key=preferenceStorageKey,selection=selectionKey;
    void withChoiceLock(key,()=>{const raw=localStorage.getItem(key),value=raw?JSON.parse(raw):{version:1,preferences:[],ignoreTranscriptRejections:false};if(value.version!==1||!Array.isArray(value.preferences))throw Error("Stored choices could not be read; clear explicitly before editing.");const next=JSON.stringify({version:1,preferences:setCardPreference(normalizePreferences(value.preferences),card,state),ignoreTranscriptRejections:value.ignoreTranscriptRejections===true});localStorage.setItem(key,next);if(currentSelection.current===selection)adoptChoices(next,"Card choice saved for this deck.");}).catch(e=>{if(currentSelection.current===selection)setError((e as Error).message);});
  }
  function clearChoices(){
    if(!navigator.locks&&!currentChoices())return;
    const key=preferenceStorageKey,selection=selectionKey;
    void withChoiceLock(key,()=>{const raw=localStorage.getItem(key);let value={preferences:[] as CardPreference[],ignoreTranscriptRejections:false};try{if(raw)value=JSON.parse(raw);}catch{/* Preserve the exact corrupt value for explicit undo. */}const next=JSON.stringify({version:1,preferences:[],ignoreTranscriptRejections:true});localStorage.setItem(key,next);if(currentSelection.current===selection){adoptChoices(next,"Remembered choices cleared explicitly.");setClearedPreferences({preferences:normalizePreferences(value.preferences),ignore:value.ignoreTranscriptRejections===true,raw:raw||undefined,afterRaw:next});}}).catch(e=>{if(currentSelection.current===selection)setError((e as Error).message);});
  }
  function undoClear(){
    const prior=clearedPreferences;if(!prior)return;
    const key=preferenceStorageKey,selection=selectionKey;
    void withChoiceLock(key,()=>{const raw=localStorage.getItem(key);if(raw!==prior.afterRaw){if(currentSelection.current===selection)adoptChoices(raw,"Choices changed after the clear; undo would overwrite a newer decision. Current choices loaded.");return;}const next=prior.raw||JSON.stringify({version:1,preferences:prior.preferences,ignoreTranscriptRejections:prior.ignore});localStorage.setItem(key,next);if(currentSelection.current===selection)adoptChoices(next,"Earlier choices restored.");}).catch(e=>{if(currentSelection.current===selection)setError((e as Error).message);});
  }
  function cancel() {
    pending.current?.abort();
    pending.current = null;
    epoch.current++;
    setWorking(null);
    setNotice(
      "Cancelled locally. No swaps applied. An already-started provider request may still incur charges.",
    );
  }
  async function send() {
    if (!message.trim() || !status?.enabled || working || pending.current || turns.length >= MAX_CONVERSATION_TURNS - 1) return;
    if(!currentChoices())return;
    if(preferenceLoadFailed) {setError("Stored card choices could not be read. Clear remembered choices explicitly before requesting recommendations.");return;}
    const conflict = budgetConflict(message, Number(budget), budgetMeaning);
    if (conflict) { setError(conflict); return; }
    const priorAssistant=[...turns].reverse().find(t=>t.role==='assistant');
    let remembered=preferences;
    try {remembered=messagePreferences(preferences,message,[...documents.flatMap(d=>d.entries.map(e=>e.card)),...turns.flatMap(t=>[...(t.cards||[]),...(t.review?.pairs||[]).map(p=>p.add)])],priorAssistant?.review?.pairs.map(p=>p.add)||priorAssistant?.cards||[]);} catch(e) {setError((e as Error).message);return;}
    setPreferences(remembered);
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
      next: Turn[] = prior[prior.length-1]?.role === "user" && prior[prior.length-1]?.content === message.trim() ? prior : [...prior, { role: "user", content: message.trim() }];
    const previousBudget = budgetThread.current;
    budgetThread.current={cap:Number(budget),meaning:budgetMeaning,start:previousBudget && previousBudget.cap === Number(budget) && previousBudget.meaning === budgetMeaning ? previousBudget.start : previousBudget ? next.length-1 : 0};
    setTurns(next);
    try {
      const reply = await api<{
        reply: string;
        cards: Card[];
        review: AIReview | null;
        source: string;
        noSwapReason?: string | null;
        cardPreferences?: CardPreference[];
      }>(
        "/deck-ai/chat",
        {
          scope,
          ...(scope === "account"
            ? { deckId: deck?.id }
            : { deck, collections }),
          commanderId: !deck ? commander?.id : undefined,
          budget: Number(budget),
          budgetMeaning,
          budgetContextStart:budgetThread.current.start,
          cardPreferences: remembered,
          ignoreTranscriptRejections,
          bracket: deck?.commanderBracket || bracket,
          ownedOnly,
          turns: providerTurns(next),
        },
        undefined,
        c.signal,
      );
      if (!alive.current || token !== epoch.current) return;
      let returned=reply.cardPreferences ? normalizePreferences(reply.cardPreferences) : remembered;
      const suggested=reply.review?.pairs.map(p=>p.add)||reply.cards;
      for(const card of suggested) if(!deck?.entries.some(e=>(e.card.oracle_id||e.card.id)===(card.oracle_id||card.id)) && preferenceFor(returned,card)?.state!=='rejected') returned=setCardPreference(returned,card,"suggested");
      setPreferences(returned);
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
      if (alive.current && token === epoch.current) {pending.current = null;setWorking(null);}
    }
  }
  async function apply() {
    if (!activeReview || !deck || !selected.length || pending.current) return;
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
        setError(e instanceof NetworkError ? "Apply response could not be confirmed. Keep this selection and retry; the server can return the same result without applying it twice. If the server restarted, refresh the deck before requesting another review." : (e as Error).message);
    } finally {
      if (alive.current && token === epoch.current) {pending.current = null;setWorking(null);}
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
            Constraints · ${budget} · {budgetMeaning === "deck" ? "Total deck incl. commander" : "New purchases"} ·{" "}
            {ownedOnly ? "Owned only" : "All additions"}
            {deck?.commanderBracket
              ? ` · Bracket ${deck.commanderBracket}`
              : ""}{" "}
            · Edit
          </summary>
          <label>Budget applies to<select aria-label="AI budget meaning" value={budgetMeaning} onChange={e => setBudgetMeaning(e.target.value as BudgetMeaning)}><option value="purchases">New purchases only</option><option value="deck">Total deck (including commander and lands)</option></select></label>
          <p>{budgetMeaning === "deck" ? "Every selected printing counts, including owned cards, commander and lands. Unknown quotes block swaps; selected subsets are rechecked before saving." : "Only needed new copies count. Cuts provide no sale credit; owned copies cost $0."}</p>
          <div className="ai-context-row">
            <label>
              Budget cap (USD)
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
      <details className="ai-card-preferences"><summary>Remembered card choices for this deck · {preferences.length}</summary>
        <p>Latest choices are saved on this device for this deck/account. Rejected and previously suggested cards are excluded from new recommendations by Oracle identity. Discussion can still explain them. Allow again explicitly reverses an exclusion.</p>
        {preferenceLoadFailed&&<p role="alert">Stored choices could not be read and have not been overwritten. Clear explicitly to start again.</p>}
        {preferences.map(pref=><div key={pref.oracleId||pref.cardId}><span>{pref.name} · {pref.state === "allowed" ? "Allowed again" : pref.state === "rejected" ? "Rejected" : "Previously suggested"}</span><button disabled={!!working} onClick={()=>remember({id:pref.cardId,oracle_id:pref.oracleId,name:pref.name},pref.state==="allowed"?"rejected":"allowed")}>{pref.state === "allowed" ? "Reject " : "Allow again "}{pref.name}</button></div>)}
        {ignoreTranscriptRejections&&<p>Earlier transcript exclusions were explicitly cleared; new choices still apply.</p>}
        <button disabled={!!working||(!preferences.length&&!preferenceLoadFailed)} onClick={clearChoices}>Clear remembered choices</button>
        {clearedPreferences&&<button disabled={!!working} onClick={undoClear}>Undo clear remembered choices</button>}
      </details>
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
                {t.review.pairs.map(p=><button key={p.id} disabled={!!working} onClick={()=>remember(p.add,"rejected")}>Reject suggestion {p.add.name}</button>)}
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
                    {t.cards.filter(c=>!deck?.entries.some(e=>(e.card.oracle_id||e.card.id)===(c.oracle_id||c.id))).map(c=><button key={"reject:"+c.id} disabled={!!working} onClick={()=>remember(c,"rejected")}>Reject suggestion {c.name}</button>)}
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
              budgetThread.current=null;
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
