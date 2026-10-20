import type { SearchFilters as Filters } from "../shared/searchFilters";
import { defaultSearchFilters } from "../shared/searchFilters";
export default function SearchFilters({
  value,
  onChange,
  onApply,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  onApply: () => void;
}) {
  const set = <K extends keyof Filters>(key: K, next: Filters[K]) =>
    onChange({ ...value, [key]: next });
  const text = (key: keyof Filters, label: string, placeholder = "") => (
    <label>
      {label}
      <input
        aria-label={label}
        value={String(value[key])}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value as never)}
      />
    </label>
  );
  const select = (key: keyof Filters, label: string, choices: string[]) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={String(value[key])}
        onChange={(e) => set(key, e.target.value as never)}
      >
        <option value="">Any</option>
        {choices.map((v) => (
          <option key={v} value={v}>
            {v.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
  const range = (lo: keyof Filters, hi: keyof Filters, label: string) => (
    <fieldset className="search-range">
      <legend>{label}</legend>
      <label>
        Minimum
        <input
          aria-label={label + " minimum"}
          type="number"
          min="0"
          step="any"
          placeholder="0"
          value={String(value[lo])}
          onChange={(e) => set(lo, e.target.value as never)}
        />
      </label>
      <span>to</span>
      <label>
        Maximum
        <input
          aria-label={label + " maximum"}
          type="number"
          min="0"
          step="any"
          placeholder="Any"
          value={String(value[hi])}
          onChange={(e) => set(hi, e.target.value as never)}
        />
      </label>
    </fieldset>
  );
  return (
    <div className="search-filter-sheet" aria-label="Search filters">
      <div className="filter-sheet-heading">
        <h2>Filters</h2>
        <button
          onClick={() =>
            onChange({
              ...defaultSearchFilters,
              language: value.language,
              order: value.order,
              direction: value.direction,
            })
          }
        >
          Clear filters
        </button>
      </div>
      <div className="filter-settings search-order-settings">
        <label>
          Language
          <select
            aria-label="Search language"
            value={value.language}
            onChange={(e) => set("language", e.target.value)}
          >
            {[
              ["en", "English"],
              ["ja", "Japanese"],
              ["de", "German"],
              ["fr", "French"],
              ["it", "Italian"],
              ["es", "Spanish"],
              ["pt", "Portuguese"],
              ["ko", "Korean"],
              ["ru", "Russian"],
              ["zhs", "Chinese simplified"],
              ["zht", "Chinese traditional"],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort by
          <select
            aria-label="Sort cards by"
            value={value.order}
            onChange={(e) => set("order", e.target.value)}
          >
            {[
              ["usd", "Price"],
              ["name", "Name"],
              ["cmc", "Mana value"],
              ["released", "Release date"],
              ["rarity", "Rarity"],
              ["set", "Set"],
              ["power", "Power"],
              ["toughness", "Toughness"],
              ["artist", "Artist"],
            ].map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button
          className="sort-direction"
          aria-label={"Sort direction: " + value.direction + ". Reverse sort"}
          onClick={() =>
            set("direction", value.direction === "desc" ? "asc" : "desc")
          }
        >
          {value.direction === "desc" ? "↓" : "↑"}
        </button>
      </div>
      <label className="search-switch">
        Group printings
        <input
          type="checkbox"
          role="switch"
          checked={value.groupPrintings}
          onChange={(e) => set("groupPrintings", e.target.checked)}
        />
      </label>
      <label className="search-switch">
        Ignore nonlegal cards
        <small>Legal in at least one supported format</small>
        <input
          type="checkbox"
          role="switch"
          checked={value.ignoreNonlegal}
          onChange={(e) => set("ignoreNonlegal", e.target.checked)}
        />
      </label>
      <fieldset className="format-filter">
        <legend>
          Legalities <small>Match any selected format</small>
        </legend>
        <div className="filter-chips">
          {[
            "standard",
            "pioneer",
            "modern",
            "legacy",
            "vintage",
            "commander",
            "oathbreaker",
            "brawl",
            "timeless",
            "historic",
            "pauper",
          ].map((f) => (
            <button
              key={f}
              aria-pressed={value.formats.includes(f)}
              onClick={() =>
                set(
                  "formats",
                  value.formats.includes(f)
                    ? value.formats.filter((v) => v !== f)
                    : [...value.formats, f],
                )
              }
            >
              {f}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Colors</legend>
        <div className="filter-settings">
          <label>
            Match mode
            <select
              aria-label="Color match mode"
              value={value.colorMode}
              onChange={(e) =>
                set("colorMode", e.target.value as Filters["colorMode"])
              }
            >
              <option value="exact">Exactly these</option>
              <option value="include">Contains all</option>
              <option value="within">Within these</option>
              <option value="any">Any of these</option>
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={value.identity}
              onChange={(e) => set("identity", e.target.checked)}
            />
            Color identity
          </label>
        </div>
        <div className="filter-colors">
          {[
            ["W", "White"],
            ["U", "Blue"],
            ["B", "Black"],
            ["R", "Red"],
            ["G", "Green"],
            ["C", "Colorless"],
          ].map(([c, name]) => (
            <button
              key={c}
              aria-label={name}
              aria-pressed={value.colors.includes(c)}
              data-color={c}
              onClick={() =>
                set(
                  "colors",
                  value.colors.includes(c)
                    ? value.colors.filter((v) => v !== c)
                    : c === "C"
                      ? ["C"]
                      : [...value.colors.filter((v) => v !== "C"), c],
                )
              }
            >
              {c}
            </button>
          ))}
        </div>
        {range("minColors", "maxColors", "Number of colors")}
      </fieldset>
      <div className="filter-fields">
        {text("type", "Type line", "Legendary Creature Angel")}
        {text("oracle", "Oracle text", "Draw a card")}
        {text("mana", "Mana cost", "{2}{G}{W}")}
        {text("set", "Set code", "mkm")}
        {select("rarity", "Rarity", [
          "common",
          "uncommon",
          "rare",
          "mythic",
          "special",
          "bonus",
        ])}
        {range("minPrice", "maxPrice", "USD price")}
      </div>
      <details className="advanced-search">
        <summary>Stats, finishes & advanced filters</summary>
        <div className="filter-fields">
          {range("minMana", "maxMana", "Mana value")}
          {range("minPower", "maxPower", "Power")}
          {range("minToughness", "maxToughness", "Toughness")}
          {select("finish", "Available finish", ["foil", "nonfoil", "etched"])}
          {text("artist", "Artist")}
          {select("layout", "Layout", [
            "normal",
            "transform",
            "modal_dfc",
            "split",
            "adventure",
            "flip",
            "meld",
            "saga",
            "class",
            "token",
            "double_faced_token",
            "planar",
            "scheme",
            "vanguard",
          ])}
          {select("misc", "Miscellaneous", [
            "reserved",
            "fullart",
            "borderless",
            "promo",
            "reprint",
            "firstprint",
            "funny",
            "digital",
          ])}
        </div>
      </details>
      <button className="primary apply-search-filters" onClick={onApply}>
        Search with filters
      </button>
    </div>
  );
}
