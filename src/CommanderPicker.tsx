import { useEffect, useRef, useState, useId } from "react";
import type { Card } from "../shared/model";
import { image } from "../shared/model";
import { api, isAbortError } from "./api";
import { plainTextInputProps } from "./inputBehavior";
export default function CommanderPicker({
  onSelect,
  onChange,
  disabled = false,
}: {
  onSelect: (card: Card) => void;
  onChange: () => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(""),
    [cards, setCards] = useState<Card[]>([]),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [composing, setComposing] = useState(false),
    [retry, setRetry] = useState(0);
  const pending=useRef<AbortController|null>(null);
  const input = useRef<HTMLInputElement>(null),
    results = useRef<HTMLDivElement>(null),
    chosen = useRef(""),
    generation = useRef(0);
  const helpId = useId();
  useEffect(() => {
    pending.current?.abort();
    const token = ++generation.current;
    let active = true;
    setCards([]);
    setError(false);
    setLoading(false);
    if (query === chosen.current) {
      setMessage("");
      return;
    }
    if (query.trim().length < 2) {
      setMessage(query ? "Type at least 2 letters." : "");
      return;
    }
    if (composing) return;
    const controller=new AbortController();pending.current=controller;
    setLoading(true);
    setMessage("Searching commanders…");
    const timer = setTimeout(() => {
      const term = query.trim().replace(/[’‘]/g, "'");
      void api<{ data: Card[] }>(
        "/cards?q=" +
          encodeURIComponent(
            "is:commander f:commander name:" + JSON.stringify(term),
          ),
        undefined,undefined,controller.signal,
      )
        .then((r) => {
          if (!active || token !== generation.current) return;
          setCards(r.data.slice(0, 12));
          setMessage(
            r.data.length
              ? "Choose a commander below."
              : "No commanders found. Try another name.",
          );
        })
        .catch((e) => {
          if (!active || token !== generation.current || isAbortError(e)) return;
          const empty =
            e instanceof Error && e.message === "Card provider returned 404";
          setError(!empty);
          setMessage(
            empty
              ? "No commanders found. Try another name."
              : (e as Error).message,
          );
        })
        .finally(() => {
          if (active && token === generation.current) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      active = false;
      controller.abort();if(pending.current===controller)pending.current=null;
    };
  }, [query, composing, retry]);
  return (
    <div className="commander-picker">
      <form
        role="search"
        aria-label="Find a commander"
        onSubmit={(e) => {
          e.preventDefault();
          if (composing) return;
          setRetry((n) => n + 1);
        }}
      >
        <label>
          Search commanders
          <input
            {...plainTextInputProps}
            ref={input}
            aria-label="Commander name or idea"
            aria-describedby={helpId}
            type="search"
            enterKeyHint="search"
            value={query}
            disabled={disabled}
            placeholder="Commander name, e.g. Atraxa"
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onChange={(e) => {
              chosen.current = "";
              setQuery(e.target.value);
              onChange();
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && cards.length) {
                e.preventDefault();
                results.current
                  ?.querySelector<HTMLButtonElement>("button")
                  ?.focus();
              }
              if (e.key === "Escape") {
                pending.current?.abort();
                generation.current++;
                setCards([]);
                setLoading(false);
                setMessage("");
              }
            }}
          />
        </label>
        <div className="commander-search-actions">
          <button type="submit" disabled={disabled || query.trim().length < 2}>
            Search
          </button>
          {query && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                chosen.current = "";
                setQuery("");
                onChange();
                input.current?.focus();
              }}
            >
              Clear
            </button>
          )}
        </div>
      </form>
      <p className="builder-help" id={helpId}>
        Search by name, then choose a card. Use ↑/↓ to browse results.
      </p>
      <p
        role={error ? "alert" : "status"}
        className={error ? "error" : "commander-search-status"}
      >
        {message}
      </p>
      {error && (
        <button onClick={() => setRetry((n) => n + 1)}>Retry search</button>
      )}
      <div
        className="commander-search-results"
        ref={results}
        aria-label="Commander search results"
        aria-busy={loading}
        onKeyDown={(event) => {
          const buttons=Array.from(results.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]);
          const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
          if(index<0)return;
          if(event.key==='Escape'){event.preventDefault();input.current?.focus();return;}
          const next=event.key==='ArrowDown'?Math.min(index+1,buttons.length-1):event.key==='ArrowUp'?index-1:event.key==='Home'?0:event.key==='End'?buttons.length-1:null;
          if(next!==null){event.preventDefault();if(next<0)input.current?.focus();else buttons[next]?.focus();}
        }}
      >
        {cards.map((card) => (
          <button
            type="button"
            key={card.id}
            disabled={disabled}
            aria-label={"Use " + card.name}
            onClick={() => {
              pending.current?.abort();
              generation.current++;
              chosen.current = card.name;
              setQuery(card.name);
              setCards([]);
              setLoading(false);
              setMessage(
                "Commander selected. Choose your card pool and budget below.",
              );
              onSelect(card);
            }}
          >
            {image(card) && <img src={image(card)} alt="" />}
            <span>
              <strong>{card.name}</strong>
              <small>{card.type_line}</small>
              <small>
                {(card.color_identity || []).join(" · ") || "Colorless"} ·
                Select commander →
              </small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
