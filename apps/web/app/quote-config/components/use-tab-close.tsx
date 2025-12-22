import { useEffect, useRef } from "react";

type CloseHandler = () => void;

export function useTabClose(handler: CloseHandler) {
  const hasRunRef = useRef(false);
  const handlerRef = useRef(handler);

  // Keep latest handler
  handlerRef.current = handler;

  useEffect(() => {
    const runOnce = () => {
      if (hasRunRef.current) return;
      hasRunRef.current = true;
      handlerRef.current();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        runOnce();
      }
    };

    const onPageHide = () => {
      runOnce();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
}
