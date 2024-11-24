import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import useWebSocket from "./useWebsocket";

const getSessionNameFromUrl = (url: string) =>
  new URL(url).pathname.split("/").pop();

const retrieveRedirectLocation = async (url: string): Promise<string> =>
  fetch(url, { method: "GET", redirect: "follow" }).then(
    (response) => response.url
  );

const useCodenamesSession = (websocketEndpointUrl: string) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sessionSearchParam = searchParams.get("session") ?? undefined;
  const [sessionName, setSessionName] = useState<string>();
  const { isConnected, incomingMessage, sendMessage, closeConnection } =
    useWebSocket(
      `${websocketEndpointUrl}/${sessionName}`,
      sessionName === undefined
    );

  useEffect(() => {
    const setRandomSessionNameFromRedirectLocation = async () => {
      // make http request and get session name from redirect location
      if (!sessionSearchParam) {
        const redirectUrl = await retrieveRedirectLocation(
          new URL(websocketEndpointUrl.replace("ws", "http")).toString()
        );
        const sessionName = getSessionNameFromUrl(redirectUrl);
        if (sessionName) {
          router.replace(`${pathname}?session=${sessionName}`);
        }
      }
    };

    setRandomSessionNameFromRedirectLocation();

    if (sessionSearchParam) {
      setSessionName(sessionSearchParam);
    }
  }, [sessionSearchParam]);

  return {
    sessionName,
    isConnected,
    incomingMessage,
    sendMessage,
    closeConnection,
  };
};

export default useCodenamesSession;
