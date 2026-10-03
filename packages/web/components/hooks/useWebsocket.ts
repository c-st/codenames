import { useCallback, useEffect, useRef, useState } from "react";

const useWebSocket = (
  url: string,
  skip: boolean,
  resolveUrl?: () => string,
) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [incomingMessages, setIncomingMessages] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [serverClockOffset, setServerClockOffset] = useState(0);

  useEffect(() => {
    setIsConnected(false);
    setIncomingMessages([]);
    if (skip || !url) return;
    let disposed = false;
    let delay = 500;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let pingTimer: ReturnType<typeof setInterval>;
    let pongTimer: ReturnType<typeof setTimeout>;
    let connectTimer: ReturnType<typeof setTimeout>;
    let batchTimer: ReturnType<typeof setTimeout>;
    let pending: string[] = [];
    let pingAt = 0;
    let clockKnown = false;
    let stopped = false;

    const clearConnectionTimers = () => {
      clearInterval(pingTimer);
      clearTimeout(pongTimer);
      clearTimeout(connectTimer);
    };
    const connect = () => {
      if (disposed || stopped) return;
      clearTimeout(reconnectTimer);
      clearConnectionTimers();
      const ws = new WebSocket(resolveUrl?.() ?? url);
      socketRef.current = ws;
      connectTimer = setTimeout(
        () => ws.close(4000, "Connection timeout"),
        10000,
      );
      const ping = () => {
        if (ws.readyState !== WebSocket.OPEN) return;
        pingAt = Date.now();
        ws.send(JSON.stringify({ type: "ping" }));
        clearTimeout(pongTimer);
        pongTimer = setTimeout(
          () => ws.close(4000, "Heartbeat timeout"),
          10000,
        );
      };
      ws.onopen = () => {
        if (disposed || socketRef.current !== ws) return;
        clearTimeout(connectTimer);
        setIsConnected(true);
        delay = 500;
        ping();
        pingTimer = setInterval(ping, 25000);
      };
      ws.onmessage = (event) => {
        if (
          disposed ||
          socketRef.current !== ws ||
          typeof event.data !== "string"
        )
          return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === "pong") {
            clearTimeout(pongTimer);
            if (typeof parsed.serverTime === "number") {
              setServerClockOffset(
                parsed.serverTime - (pingAt + Date.now()) / 2,
              );
              clockKnown = true;
            }
            return;
          }
          if (!clockKnown && typeof parsed.gameState?.serverTime === "number") {
            setServerClockOffset(parsed.gameState.serverTime - Date.now());
          }
        } catch {
          /* Schema validation happens in the game hook. */
        }
        pending.push(event.data);
        // Batch without dropping intermediate events when React coalesces renders.
        clearTimeout(batchTimer);
        batchTimer = setTimeout(() => {
          setIncomingMessages(pending);
          pending = [];
        }, 0);
      };
      ws.onclose = (event) => {
        if (disposed || socketRef.current !== ws) return;
        setIsConnected(false);
        clearConnectionTimers();
        if (event.code === 1000) stopped = true;
        if (stopped) return;
        reconnectTimer = setTimeout(
          connect,
          delay * (0.8 + Math.random() * 0.4),
        );
        delay = Math.min(delay * 2, 15000);
      };
      ws.onerror = () => {
        /* Close callback handles retry. */
      };
    };
    const recover = () => {
      if (document.visibilityState === "hidden" || disposed || stopped) return;
      const ws = socketRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED) connect();
      else if (ws.readyState === WebSocket.OPEN) {
        pingAt = Date.now();
        ws.send(JSON.stringify({ type: "ping" }));
        clearTimeout(pongTimer);
        pongTimer = setTimeout(
          () => ws.close(4000, "Resume heartbeat timeout"),
          10000,
        );
      }
    };
    connect();
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      clearTimeout(batchTimer);
      clearConnectionTimers();
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", recover);
      const ws = socketRef.current;
      socketRef.current = null;
      ws?.close(1000);
    };
  }, [url, skip, resolveUrl]);

  const sendMessage = useCallback((message: string) => {
    const ws = socketRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(message);
    return true;
  }, []);
  const closeConnection = useCallback(
    (code = 1000) => socketRef.current?.close(code),
    [],
  );
  return {
    incomingMessages,
    isConnected,
    sendMessage,
    closeConnection,
    serverClockOffset,
  };
};

export default useWebSocket;
