import { useState } from "react";
import type { Card } from "../shared/model";
import { image } from "../shared/model";
export default function CardThumbnail({
  card,
  price,
}: {
  card: Card;
  price?: string;
}) {
  const src =
    card.card_faces?.[0]?.image_uris?.small ||
    card.image_uris?.small ||
    image(card);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className="card-thumbnail card-art-preview" aria-hidden="true">
      {src && failed !== src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(src)}
        />
      ) : (
        <span className="card-thumbnail-fallback">
          Image
          <br />
          unavailable
        </span>
      )}
      {price && <span className="card-art-price">{price}</span>}
    </span>
  );
}
