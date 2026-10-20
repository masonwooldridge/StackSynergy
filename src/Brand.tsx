export function Crest() {
  return <img className="brand-mark" src="/brand/stacksynergy-icon-192.png" alt="" aria-hidden="true" />;
}

const paths: Record<string, string> = {
  Home: "M3 10 12 3l9 7v11h-6v-7H9v7H3z",
  More: "M4 12h.01M12 12h.01M20 12h.01",
  Discover: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  Collections: "M3 5h18v15H3zM7 2h10M7 9h10M7 13h6",
  Decks: "M7 5h13v17H7zM3 18V2h13",
  Scan: "M3 8V3h5m8 0h5v5m0 8v5h-5M8 21H3v-5M7 12h10",
  Playtest:
    "M5 3h14l2 2v14l-2 2H5l-2-2V5zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01",
  Multiplayer:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3m20 0v-3a4 4 0 0 0-3-4M13 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  Assistant: "M6 5h14v17H6zM2 17V2h14M10 10h6M13 7v6M10 17h6",
  Settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 2h6l1 4 4 1 2 5-3 3v5l-5 2-3-3H6l-4-5 3-3V6z",
};
export function NavIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.Discover} />
    </svg>
  );
}
