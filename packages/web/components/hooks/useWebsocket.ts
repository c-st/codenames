import { useEffect, useRef, useState } from "react";

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

const useWebSocket = (url: string, skip: boolean) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [incomingMessage, setIncomingMessage] = useState<string>();
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldReconnectRef = useRef(true);

  const connect = () => {
    if (skip || !shouldReconnectRef.current) {
      return;
    }

    socketRef.current = new WebSocket(url);

    socketRef.current.onopen = () => {
      setIsConnected(true);
      setIncomingMessage(undefined);
      reconnectAttemptsRef.current = 0; // Reset on successful connection
    };

    socketRef.current.onmessage = (event) => {
      setIncomingMessage(event.data);
    };

    socketRef.current.onclose = (e) => {
      setIsConnected(false);
      setIncomingMessage(undefined);

      // Only auto-reconnect if it wasn't a clean close and we haven't exceeded max attempts
      if (
        e.code !== 1000 &&
        reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS &&
        shouldReconnectRef.current
      ) {
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current),
          MAX_RECONNECT_DELAY,
        );
        reconnectAttemptsRef.current += 1;

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    socketRef.current.onerror = () => {
      // Error will trigger onclose, which handles reconnection
    };
  };

  useEffect(() => {
    shouldReconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      closeConnection();
    };
    // connect is a stable function and doesn't need to be in the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, skip]);

  const sendMessage = (message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    }
    // Message will be queued for reconnection in the future
  };

  const closeConnection = (code: number = 1000) => {
    shouldReconnectRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    socketRef.current?.close(code);
  };

  const reconnect = () => {
    shouldReconnectRef.current = true;
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    closeConnection(1000);
    connect();
  };

  return {
    incomingMessage,
    isConnected,
    sendMessage,
    closeConnection,
    reconnect,
  };
};

export default useWebSocket;
