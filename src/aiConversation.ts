export function providerTurns(
  turns: { role: "user" | "assistant"; content: string; reviewState?: string; cards?: {id: string}[]; review?: {pairs: {cutName: string; add: {name: string; id?: string}}[]} | null }[],
) {
  return turns.map((t) => {
    const outcome = t.review ? "[Previous review outcome: " + (t.reviewState || "proposed") + "; " + t.review.pairs.map(p => "cut " + p.cutName + " -> add " + p.add.name).join("; ") + ". Latest deck state overrides this historical outcome.]\n" : "";
    const ids = [...new Set([...(t.cards || []).map(c => c.id), ...(t.review?.pairs || []).map(p => p.add.id).filter((id): id is string => !!id)])].slice(0, 8);
    const references = t.role === "assistant" && ids.length ? "[Historical card references: " + ids.join(",") + "]\n" : "";
    return {role: t.role, content: (references + outcome + t.content).slice(0, 2000)};
  });
}
