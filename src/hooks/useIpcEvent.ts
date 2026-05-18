import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

export function useIpcEvent<T>(
  event: string,
  handler: (payload: T) => void
): void {
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<T>(event, (e) => handler(e.payload)).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [event, handler]);
}
