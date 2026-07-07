import { useCallback, useEffect, useRef, useState } from "react";
import type { TimedMessageState } from "../types/simulator";

export const useTimedMessage = (timeoutMs: number = 10000): TimedMessageState => {
  const [message, setMessage] = useState<string>("");
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const onCancelRef = useRef<(() => void) | null>(null);

  const runCancelCallback = useCallback((): void => {
    const callback = onCancelRef.current;
    onCancelRef.current = null;
    callback?.();
  }, []);

  const clear = useCallback((): void => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setMessage("");
    runCancelCallback();
  }, [runCancelCallback]);

  const show = useCallback((nextMessage: string, onCancel?: () => void): void => {
    clear();
    onCancelRef.current = onCancel ?? null;
    setMessage(nextMessage);
    if (timeoutMs >= 0) {
      timeoutRef.current = window.setTimeout(() => {
        setMessage("");
        timeoutRef.current = null;
        runCancelCallback();
      }, timeoutMs);
    }
  }, [clear, runCancelCallback, timeoutMs]);

  useEffect(() => {
    return () => clear();
  }, [clear]);

  return {
    message,
    show,
    clear,
  };
};
