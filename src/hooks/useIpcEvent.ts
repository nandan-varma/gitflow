import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

export function useIpcEvent<T>(
  event: string,
  handler: (payload: T) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    listen<T>(event, (e) => handlerRef.current(e.payload)).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlisten = fn;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [event]);
}
