import { useEffect, useRef, useState } from "react";

const retrieveRedirectLocation = async (url: string): Promise<string> =>
  fetch(url, { method: "GET", redirect: "follow" }).then(
    (response) => response.url
  );

const useWebSocket = (url: string) => {
  const socketRef = useRef<WebSocket | null>(null);
  const [incomingMessage, setIncomingMessage] = useState<string>();
  const [resolvedUrl, setResolvedUrl] = useState<string>();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const checkHttpStatusAndConnect = async () => {
      // TODO: only attempt if no session name is provided
      const redirectUrl = await retrieveRedirectLocation(
        new URL(url.replace("ws", "http")).toString()
      );
      setResolvedUrl(redirectUrl);

      socketRef.current = new WebSocket(redirectUrl);

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
        console.log("Reconnecting...");
        new Promise((resolve) => setTimeout(resolve, 100)).then(() =>
          checkHttpStatusAndConnect()
        );
      };
    };

    checkHttpStatusAndConnect();

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
    resolvedUrl,
    sendMessage,
    closeConnection,
  };
};

export default useWebSocket;
