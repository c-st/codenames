import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import useWebSocket from "./useWebsocket";
import { readProfile, roomReconnectToken } from "./playerProfile";

const useGameSession = (websocketEndpointUrl: string, skip: boolean) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionName = searchParams?.get("session") || undefined;
  const [sessionError, setSessionError] = useState<string>();
  const [attempt, setAttempt] = useState(0);

  // Allocate identity before connecting. Receiving state must never change this URL.
  const wsUrl = useMemo(() => {
    if (!sessionName || skip) return "";
    const url = new URL(
      `${websocketEndpointUrl}/${encodeURIComponent(sessionName)}`,
    );
    url.searchParams.set("token", roomReconnectToken(sessionName));
    return url.toString();
  }, [sessionName, websocketEndpointUrl, skip]);

  const resolveUrl = useCallback(() => {
    const url = new URL(wsUrl);
    // Without a saved profile the server picks a random animal and a matching name.
    const profile = readProfile();
    if (profile?.name) url.searchParams.set("name", profile.name);
    if (profile) url.searchParams.set("animal", profile.animal);
    return url.toString();
  }, [wsUrl]);
  const connection = useWebSocket(wsUrl, skip || !sessionName, resolveUrl);

  useEffect(() => {
    if (skip || sessionName) return;
    const controller = new AbortController();
    setSessionError(undefined);
    (async () => {
      try {
        const endpoint = new URL(websocketEndpointUrl);
        endpoint.protocol = endpoint.protocol === "wss:" ? "https:" : "http:";
        const response = await fetch(endpoint, {
          redirect: "follow",
          signal: controller.signal,
        });
        const room = new URL(response.url).pathname.split("/").pop();
        if (!room) throw new Error("No room returned");
        if (!controller.signal.aborted)
          router.replace(`${pathname}?session=${encodeURIComponent(room)}`);
      } catch {
        if (!controller.signal.aborted)
          setSessionError(
            "Could not create a room. Check your connection and try again.",
          );
      }
    })();
    return () => controller.abort();
  }, [sessionName, pathname, router, websocketEndpointUrl, skip, attempt]);

  return {
    sessionName,
    ...connection,
    sessionError,
    retrySession: () => setAttempt((a) => a + 1),
  };
};

export default useGameSession;
