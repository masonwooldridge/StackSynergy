import { useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import { api } from "./api";
import type { Card } from "../shared/model";
import { scanQueries, visiblePrintingHint } from "../shared/scanner";
export default function Scanner({
  onSelect,
  initialImage,
  onImageConsumed,
}: {
  onSelect: (c: Card) => void;
  initialImage?: string | null;
  onImageConsumed?: () => void;
}) {
  const nativeScanRef = useRef<(image: string) => void>(() => {});
  useEffect(() => {
    nativeScanRef.current = (image) => {
      void recognize(image).finally(() => onImageConsumed?.());
    };
  });
  useEffect(() => {
    if (initialImage) nativeScanRef.current(initialImage);
  }, [initialImage]);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [continuous, setContinuous] = useState(false);
  const captureRef = useRef<() => void>(() => {});
  const [status, setStatus] = useState(
    "Use clear lighting and fill the frame with one card.",
  );
  const [queue, setQueue] = useState<
    {
      text: string;
      confidence: number;
      cards: Card[];
      hint: ReturnType<typeof visiblePrintingHint>;
    }[]
  >([]);
  const seen = useRef(new Set<string>());
  useEffect(
    () => () => stream.current?.getTracks().forEach((t) => t.stop()),
    [],
  );
  async function camera() {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
      }
      setActive(true);
    } catch {
      setStatus(
        "Camera unavailable or denied. Upload a photo or use card search.",
      );
    }
  }
  async function recognize(source: string | File) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let worker;
    try {
      worker = await createWorker("eng");
      setStatus("Reading card text on this device…");
      const { data } = await worker.recognize(source);
      const lines = scanQueries(data.text);
      const signature = lines.slice(0, 2).join("|").toLowerCase();
      if (seen.current.has(signature)) {
        setStatus("Duplicate frame skipped.");
        return;
      }
      const candidates: Card[] = [];
      for (const line of lines) {
        try {
          const result = await api<{ data: string[] }>(
            `/cards?mode=autocomplete&q=${encodeURIComponent(line)}`,
          );
          for (const name of result.data.slice(0, 2)) {
            const card = await api<Card>(
              `/cards?mode=named&q=${encodeURIComponent(name)}`,
            );
            if (!candidates.some((c) => c.oracle_id === card.oracle_id))
              candidates.push(card);
          }
        } catch {
          /* Try another OCR line; never create guessed cards. */
        }
        if (candidates.length >= 2) break;
      }
      seen.current.add(signature);
      setQueue((q) => [
        ...q,
        {
          text: data.text,
          confidence: data.confidence,
          cards: candidates,
          hint: visiblePrintingHint(data.text),
        },
      ]);
      setStatus(
        candidates.length
          ? "Review identity and printing. Matches require explicit saving."
          : "No verified match. Try a sharper image or card search.",
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      await worker?.terminate();
      busyRef.current = false;
      setBusy(false);
    }
  }
  function capture() {
    if (!video.current) return;
    const c = document.createElement("canvas");
    c.width = video.current.videoWidth;
    c.height = video.current.videoHeight;
    c.getContext("2d")?.drawImage(video.current, 0, 0);
    void recognize(c.toDataURL("image/png"));
  }
  useEffect(() => {
    captureRef.current = capture;
  });
  useEffect(() => {
    if (!continuous || !active) return;
    const timer = setInterval(() => {
      if (!busyRef.current) captureRef.current();
    }, 4000);
    return () => clearInterval(timer);
  }, [continuous, active]);
  return (
    <section className="panel">
      <div className="eyebrow">SCAN & REVIEW</div>
      <h2>From cardboard to collection.</h2>
      <p>
        OCR proposes identities from visible English text. Confidence describes
        OCR, not exact printing. Language, finish and printing always need your
        review.
      </p>
      <video
        ref={video}
        playsInline
        muted
        className={active ? "camera" : "camera hidden"}
      />
      <div className="toolbar">
        <button onClick={camera} disabled={busy || active}>
          Enable camera
        </button>
        <button onClick={capture} disabled={!active || busy}>
          Capture card
        </button>
        {active && (
          <button
            onClick={() => {
              stream.current?.getTracks().forEach((t) => t.stop());
              setActive(false);
            }}
          >
            Stop camera
          </button>
        )}
        <label className="button">
          Upload photos
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            onChange={async (e) => {
              for (const f of Array.from(e.target.files || []))
                await recognize(f);
            }}
          />
        </label>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={continuous}
          onChange={(e) => setContinuous(e.target.checked)}
          disabled={!active}
        />{" "}
        Continuous capture every 4 seconds (review before saving)
      </label>
      <button
        onClick={() => {
          seen.current.clear();
          setStatus("Duplicate memory reset.");
        }}
      >
        Reset duplicate memory
      </button>
      <p role="status">{status}</p>
      {queue.map((q, i) => (
        <article key={i} className="scan-review">
          <h3>
            Review {i + 1} · OCR {Math.round(q.confidence)}%
          </h3>
          {q.hint && (
            <p>
              Possible footer: {q.hint.set.toUpperCase()} #{q.hint.collector}.
              Verify manually in printing selection.
            </p>
          )}
          <details>
            <summary>Recognized text</summary>
            <pre>{q.text}</pre>
          </details>
          {q.cards.map((c) => (
            <button key={c.id} onClick={() => onSelect(c)}>
              {c.name} → choose printing
            </button>
          ))}
          <button onClick={() => setQueue((v) => v.filter((_, j) => j !== i))}>
            Dismiss
          </button>
        </article>
      ))}
    </section>
  );
}
