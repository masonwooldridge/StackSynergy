export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  let r: Response;
  try {
    r = await fetch("/api" + path, {
      method: method || (body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw Error(
      "Cannot reach CardChasm. Check your connection and that the local server is running.",
    );
  }
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error(
      "The server is restarting or unavailable. Please refresh and try again.",
    );
  }
  if (!r.ok) throw Error(data.error || "Request failed");
  return data;
}
export function download(name: string, text: string, type = "text/plain") {
  const bridge = (
    window as Window & {
      ReactNativeWebView?: { postMessage: (value: string) => void };
    }
  ).ReactNativeWebView;
  if (bridge) {
    bridge.postMessage(
      JSON.stringify({ type: "cardchasm:export", name, text, mime: type }),
    );
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
