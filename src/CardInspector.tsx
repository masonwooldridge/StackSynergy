import "./CardInspector.css";
import { useEffect, useRef, useState } from "react";
import type { Card } from "../shared/model";
import { image } from "../shared/model";
export default function CardInspector({
  card,
  onClose,
  onEdit,
}: {
  card: Card;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const [pane, setPane] = useState<"image" | "rules">("image");
  const [face, setFace] = useState(0),
    [zoom, setZoom] = useState(false),
    [art, setArt] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const controls = Array.from(
          root.current?.querySelectorAll<HTMLElement>("button,a[href]") || [],
        ).filter((e) => e.offsetParent !== null);
        if (e.shiftKey && document.activeElement === controls[0]) {
          e.preventDefault();
          controls[controls.length - 1]?.focus();
        } else if (
          !e.shiftKey &&
          document.activeElement === controls[controls.length - 1]
        ) {
          e.preventDefault();
          controls[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const current = card.card_faces?.[face] || card;
  const pictures = current.image_uris || card.image_uris;
  const src =
    (art && pictures?.art_crop) ||
    pictures?.large ||
    pictures?.png ||
    image(card, face);
  return (
    <div
      className="full-card-viewer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={root}
        className="full-card-viewer"
        data-pane={pane}
        role="dialog"
        aria-modal="true"
        aria-label={"Card details: " + card.name}
      >
        <header>
          <span className="journal-kicker">STACKSYNERGY / CARD DETAILS</span>
          <button onClick={onClose} aria-label="Close full card details">
            Close ×
          </button>
        </header>
        <div className="viewer-mode">
          <button
            aria-pressed={pane === "image"}
            onClick={() => setPane("image")}
          >
            Card image
          </button>
          <button
            aria-pressed={pane === "rules"}
            onClick={() => setPane("rules")}
          >
            Read rules &amp; stats
          </button>
          {pane === "rules" && (card.card_faces?.length || 0) > 1 && (
            <button
              onClick={() => setFace((f) => (f + 1) % card.card_faces!.length)}
            >
              Other face
            </button>
          )}
        </div>
        <div className="full-card-viewer-layout">
          <div>
            <div className={"card-image-viewport" + (zoom ? " zoomed" : "")}>
              {src && failedImage !== src ? (
                <img
                  src={src}
                  alt={current.name}
                  onError={() => setFailedImage(src)}
                />
              ) : (
                <p>Card image unavailable.</p>
              )}
            </div>
            <div className="toolbar">
              <button aria-pressed={zoom} onClick={() => setZoom((v) => !v)}>
                {zoom ? "Fit card" : "Zoom image"}
              </button>
              {pictures?.art_crop && (
                <button aria-pressed={art} onClick={() => setArt((v) => !v)}>
                  {art ? "Full card" : "Artwork only"}
                </button>
              )}
              {(card.card_faces?.length || 0) > 1 && (
                <button
                  onClick={() => {
                    setFace((f) => (f + 1) % card.card_faces!.length);
                    setArt(false);
                  }}
                >
                  Other face
                </button>
              )}
            </div>
            <p className="muted">
              Zoom to inspect small text. Scroll the enlarged image; mobile
              pinch zoom remains available.
            </p>
          </div>
          <div>
            <h2>{current.name}</h2>
            <p>{current.mana_cost || card.mana_cost || "No mana cost"}</p>
            <p>{current.type_line || card.type_line}</p>
            <p className="oracle">
              {current.oracle_text || card.oracle_text || "No rules text."}
            </p>
            {current.power !== undefined && (
              <p>
                Power / toughness: {current.power} / {current.toughness}
              </p>
            )}
            {current.loyalty !== undefined && <p>Loyalty: {current.loyalty}</p>}
            <p>
              {card.set_name || card.set?.toUpperCase()} · #
              {card.collector_number || "—"}
            </p>
            {card.scryfall_uri && (
              <a
                className="viewer-printing-link"
                href={card.scryfall_uri}
                target="_blank"
                rel="noreferrer"
              >
                Rulings &amp; printing on Scryfall ↗
              </a>
            )}
            {onEdit && (
              <p>
                <button onClick={onEdit}>Edit printing / copies</button>
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
