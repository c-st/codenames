import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useWebSocket from "./useWebsocket";

const getSessionNameFromUrl = (url: string) =>
  new URL(url).pathname.split("/").pop();

const retrieveRedirectLocation = async (
  url: string,
  signal?: AbortSignal
): Promise<string> =>
  fetch(url, { method: "GET", redirect: "follow", signal }).then(
    (response) => response.url
  );

const getStoredPlayerId = (sessionName: string): string | null => {
  try {
    return sessionStorage.getItem(`codenames:playerId:${sessionName}`);
  } catch {
    return null;
  }
};

const storePlayerId = (sessionName: string, playerId: string) => {
  try {
    sessionStorage.setItem(`codenames:playerId:${sessionName}`, playerId);
  } catch {
    // sessionStorage unavailable
  }
};

const useGameSession = (websocketEndpointUrl: string) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionSearchParam = searchParams?.get("session") ?? undefined;

  const [sessionName, setSessionName] = useState<string>();

  // Build WebSocket URL with playerId for reconnection
  const wsUrl = (() => {
    if (!sessionName) return "";
    const base = `${websocketEndpointUrl}/${sessionName}`;
    const storedPlayerId = getStoredPlayerId(sessionName);
    if (storedPlayerId) {
      return `${base}?playerId=${encodeURIComponent(storedPlayerId)}`;
    }
    return base;
  })();

  const { isConnected, incomingMessage, sendMessage, closeConnection } =
    useWebSocket(wsUrl, sessionName === undefined);

  // Persist playerId when we receive it from the server
  const onPlayerIdReceived = useCallback(
    (playerId: string) => {
      if (sessionName) {
        storePlayerId(sessionName, playerId);
      }
    },
    [sessionName]
  );

  useEffect(() => {
    const abortController = new AbortController();

    const setSessionNameFromRedirectLocation = async () => {
      if (!sessionSearchParam) {
        try {
          const redirectUrl = await retrieveRedirectLocation(
            new URL(websocketEndpointUrl.replace("ws", "http")).toString(),
            abortController.signal
          );
          if (abortController.signal.aborted) return;
          const sessionName = getSessionNameFromUrl(redirectUrl);
          if (sessionName) {
            router.replace(`${pathname}?session=${sessionName}`);
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          console.error("Failed to get session redirect:", e);
        }
      }
    };
    setSessionNameFromRedirectLocation();
    if (sessionSearchParam) {
      setSessionName(sessionSearchParam);
    }

    return () => abortController.abort();
  }, [sessionSearchParam, pathname, router, websocketEndpointUrl]);

  return {
    sessionName,
    isConnected,
    incomingMessage,
    sendMessage,
    closeConnection,
    onPlayerIdReceived,
  };
};

export default useGameSession;
