import { useEffect, useRef, useState } from "react";

const useWebSocket = (url: string, skip: boolean) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [incomingMessage, setIncomingMessage] = useState<string>();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (skip) {
      console.log("Skipping WebSocket connection");
      return;
    }

    socketRef.current = new WebSocket(url);

    socketRef.current.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };

    socketRef.current.onmessage = (event) => {
      setIncomingMessage(event.data);
    };

    socketRef.current.onclose = (e) => {
      setIsConnected(false);
      console.log("WebSocket disconnected", e);
    };

    return () => {
      closeConnection();
    };
  }, [url]);

  const sendMessage = (message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    }
  };

  const closeConnection = (code: number = 1000) => {
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
