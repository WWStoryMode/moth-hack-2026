// A WebSocket to the station on the same origin, with automatic reconnect. On every (re)connect it calls
// `hello` so the page can re-identify itself (host:resume or player:join), which is how phones survive
// a network blip or a screen lock.
import { WS_PATH, type ClientMsg, type ServerMsg } from "../shared/protocol.ts";

export type SocketStatus = "connecting" | "open" | "closed";

export type Station = { send(msg: ClientMsg): void; close(): void };

export function connectStation(opts: {
  onMessage: (msg: ServerMsg) => void;
  onStatus: (s: SocketStatus) => void;
  hello: (send: (msg: ClientMsg) => void) => void;
}): Station {
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const send = (msg: ClientMsg) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };

  function open() {
    opts.onStatus("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}${WS_PATH}`);
    ws.onopen = () => {
      retry = 0;
      opts.onStatus("open");
      opts.hello(send);
    };
    ws.onmessage = (e) => {
      try {
        opts.onMessage(JSON.parse(String(e.data)) as ServerMsg);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      if (closed) return;
      opts.onStatus("closed");
      timer = setTimeout(open, Math.min(5000, 500 * 2 ** retry++));
    };
  }

  open();
  return {
    send,
    close() {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}

/** Whether a station server is reachable (false on a static deploy). */
export async function stationAvailable(): Promise<boolean> {
  try {
    const r = await fetch("/healthz", { cache: "no-store" });
    return r.ok && (r.headers.get("content-type") ?? "").includes("json");
  } catch {
    return false;
  }
}

/** sessionStorage that never throws (private mode, blocked storage). */
export const session = {
  get<T>(key: string): T | null {
    try {
      const v = sessionStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // fine: reconnect-by-name still works while the page stays open
    }
  },
  remove(key: string) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
