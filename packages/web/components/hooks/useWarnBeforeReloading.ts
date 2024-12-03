import { useEffect } from "react";

export const useWarnBeforeReloading = (isConnected: boolean) =>
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isConnected) {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      } else {
        event.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isConnected]);
