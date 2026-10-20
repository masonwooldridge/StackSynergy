import { useCallback, useEffect, useState } from "react";
const screens = new Set([
  "Home",
  "Discover",
  "Collections",
  "Decks",
  "More",
  "Scan",
  "Playtest",
  "Multiplayer",
  "Assistant",
  "Settings",
]);
export function readRoute(search: string) {
  const params = new URLSearchParams(search);
  const screen = params.get("screen") || "Home";
  return {
    page: screens.has(screen) ? screen : "Home",
    selected: params.get("document") || "",
  };
}
export function useAppRoute() {
  const [route, setRoute] = useState(() => ({
    ...readRoute(location.search),
    pop: true,
    scroll: 0,
  }));
  useEffect(() => {
    const pop = () =>
      setRoute({
        ...readRoute(location.search),
        pop: true,
        scroll: history.state?.scroll || 0,
      });
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!route.pop) {
      history.replaceState({ ...history.state, scroll: window.scrollY }, "");
      const url = new URL(location.href);
      url.searchParams.set("screen", route.page);
      if (route.selected) url.searchParams.set("document", route.selected);
      else url.searchParams.delete("document");
      if (url.href !== location.href) history.pushState({ scroll: 0 }, "", url);
    }
    const frame = requestAnimationFrame(() =>
      window.scrollTo(0, route.pop ? route.scroll : 0),
    );
    return () => cancelAnimationFrame(frame);
  }, [route]);
  const setPage = useCallback(
    (page: string) =>
      setRoute((r) => (r.page === page ? r : { ...r, page, pop: false })),
    [],
  );
  const setSelected = useCallback(
    (selected: string) =>
      setRoute((r) =>
        r.selected === selected ? r : { ...r, selected, pop: false },
      ),
    [],
  );
  return { page: route.page, selected: route.selected, setPage, setSelected };
}
