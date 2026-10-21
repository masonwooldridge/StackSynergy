export class CardDataUnavailable extends Error { retryAfterSeconds:number;constructor(message:string,retryAfterSeconds=0){super(message);this.retryAfterSeconds=retryAfterSeconds;} }
export class NetworkError extends Error {}
export const isAbortError=(error:unknown)=>!!error&&typeof error==="object"&&"name" in error&&error.name==="AbortError";
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
  signal?: AbortSignal,
): Promise<T> {
  let r: Response;
  try {
    r = await fetch("/api" + path, {
      signal,
      method: method || (body ? "POST" : "GET"),
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch(error) {
    if(signal?.aborted||isAbortError(error))throw error;
    throw new NetworkError(
      "Cannot reach StackSynergy. Check your connection and that the local server is running.",
    );
  }
  let data;
  try {
    data = await r.json();
  } catch(error) {
    if(signal?.aborted||isAbortError(error))throw error;
    throw new NetworkError(
      "The server is restarting or unavailable. Please refresh and try again.",
    );
  }
  if (!r.ok) {if(data.cardDataFailure||r.status===429)throw new CardDataUnavailable(data.error||"Card data temporarily unavailable; retry later.",Number(data.retryAfterSeconds||r.headers.get("Retry-After"))||0);throw Error(data.error || "Request failed");}
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
