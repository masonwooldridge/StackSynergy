export function Crest() {
  return (
    <svg viewBox="0 0 40 48" fill="none" aria-hidden="true">
      <path d="M20 2 37 12v23L20 46 3 35V12Z" stroke="currentColor" />
      <path
        d="m20 8 11 7v16l-11 9-11-9V15Z"
        stroke="currentColor"
        opacity=".4"
      />
      <path
        d="m24 12-9 12h9l-8 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  Assistant: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z",
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
