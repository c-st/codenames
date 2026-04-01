import { useCallback, useEffect, useRef, useState } from "react";

const INITIAL_RECONNECT_DELAY = 500;
const MAX_RECONNECT_DELAY = 15000;
const BACKOFF_MULTIPLIER = 2;
const PING_INTERVAL = 25000;
const PONG_TIMEOUT = 5000;

const useWebSocket = (url: string, skip: boolean) => {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const pongTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const intentionalCloseRef = useRef(false);
  const [incomingMessage, setIncomingMessage] = useState<string>();
  const [isConnected, setIsConnected] = useState(false);

  const clearTimers = useCallback(() => {
    clearTimeout(reconnectTimerRef.current);
    clearInterval(pingTimerRef.current);
    clearTimeout(pongTimerRef.current);
  }, []);

  const startPing = useCallback(() => {
    clearInterval(pingTimerRef.current);
    pingTimerRef.current = setInterval(() => {
      if (
        socketRef.current &&
        socketRef.current.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(JSON.stringify({ type: "ping" }));
        pongTimerRef.current = setTimeout(() => {
          // No pong received — connection is dead, force close to trigger reconnect
          console.warn("Pong timeout — closing stale connection");
          socketRef.current?.close(4000, "Pong timeout");
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }, []);

  const connect = useCallback(() => {
    if (skip) return;

    intentionalCloseRef.current = false;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setIncomingMessage(undefined);
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      console.log("WebSocket connected", url);
      startPing();
    };

    ws.onmessage = (event) => {
      const data = event.data;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "pong") {
          clearTimeout(pongTimerRef.current);
          return;
        }
      } catch {
        // Not JSON, pass through
      }
      setIncomingMessage(data);
    };

    ws.onclose = (e) => {
      setIsConnected(false);
      clearInterval(pingTimerRef.current);
      clearTimeout(pongTimerRef.current);
      console.info("WebSocket disconnected", e.code, e.reason);

      if (!intentionalCloseRef.current) {
        const delay = reconnectDelayRef.current;
        console.info(`Reconnecting in ${delay}ms...`);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * BACKOFF_MULTIPLIER,
            MAX_RECONNECT_DELAY
          );
          connect();
        }, delay);
      }
    };

    ws.onerror = (e) => {
      console.error("WebSocket error", e);
      // onclose will fire after onerror, which handles reconnection
    };
  }, [url, skip, startPing]);

  useEffect(() => {
    connect();
    return () => {
      intentionalCloseRef.current = true;
      clearTimers();
      socketRef.current?.close(1000);
    };
  }, [connect, clearTimers]);

  const sendMessage = (message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    } else {
      console.warn("WebSocket not connected, message not sent", message);
    }
  };

  const closeConnection = (code: number = 1000) => {
    intentionalCloseRef.current = true;
    clearTimers();
    socketRef.current?.close(code);
  };

  return {
    incomingMessage,
    isConnected,
    sendMessage,
    closeConnection,
  };
};

export default useWebSocket;
