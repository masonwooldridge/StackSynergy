import type { ClientRequest, IncomingMessage, ServerResponse } from "node:http";
/** A normal completed response is retained; only a prematurely closed downstream cancels its upstream. */
export function forwardProxyCancellation(
  upstream: ClientRequest,
  _request: IncomingMessage,
  downstream: ServerResponse,
) {
  const abort = () => {
    if (!downstream.writableEnded) upstream.destroy();
  };
  downstream.once("close", abort);
  upstream.once("close", () => downstream.removeListener("close", abort));
}
