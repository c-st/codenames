import { useEffect, useRef, useState } from "react";

const useWebSocket = (url: string, skip: boolean) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [incomingMessage, setIncomingMessage] = useState<string>();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (skip) {
      return;
    }

    socketRef.current = new WebSocket(url);

    socketRef.current.onopen = () => {
      setIsConnected(true);
      setIncomingMessage(undefined);
      console.log("WebSocket connected", url);
    };

    socketRef.current.onmessage = (event) => {
      setIncomingMessage(event.data);
    };

    socketRef.current.onclose = (e) => {
      setIsConnected(false);
      setIncomingMessage(undefined);
      console.info("WebSocket disconnected", e);
    };

    return () => {
      closeConnection();
    };
  }, [url, skip]);

  const sendMessage = (message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    } else {
      console.warn("WebSocket not connected, message not sent", message);
    }
  };

  const closeConnection = (code: number = 1000) => {
    socketRef.current?.close(code);
  };

  const reconnect = () => {
    closeConnection();
    socketRef.current = new WebSocket(url);
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
