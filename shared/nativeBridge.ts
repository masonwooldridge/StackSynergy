export const MAX_BRIDGE_BYTES = 12 * 1024 * 1024;
export type NativeScan = { type: "cardchasm:scan"; id: string; image: string };
export type NativeExport = {
  type: "cardchasm:export";
  name: string;
  text: string;
  mime: string;
};
export function parseNativeScan(raw: unknown): NativeScan | null {
  if (typeof raw !== "string" || raw.length > MAX_BRIDGE_BYTES) return null;
  try {
    const value = JSON.parse(raw);
    if (
      value.type !== "cardchasm:scan" ||
      typeof value.id !== "string" ||
      value.id.length > 100 ||
      typeof value.image !== "string" ||
      !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value.image)
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function parseNativeExport(raw: unknown): NativeExport | null {
  if (typeof raw !== "string" || raw.length > MAX_BRIDGE_BYTES) return null;
  try {
    const value = JSON.parse(raw);
    if (
      value.type !== "cardchasm:export" ||
      typeof value.name !== "string" ||
      typeof value.text !== "string" ||
      !["text/plain", "text/csv", "application/json"].includes(value.mime)
    )
      return null;
    const name = value.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    if (!name || name === "." || name === "..") return null;
    return { ...value, name };
  } catch {
    return null;
  }
}
export function serverOrigin(input: string): string {
  const url = new URL(input.trim());
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error(
      "Enter only an HTTP or HTTPS server address, without a path or credentials.",
    );
  return url.origin;
}
