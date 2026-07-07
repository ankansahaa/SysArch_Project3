import { SIMULATOR_DEBUG_ENABLED } from "../constants/simulator";

type DebugDirection = "incoming" | "outgoing";

export const logTransportMessage = (
  channel: "http" | "websocket",
  direction: DebugDirection,
  label: string,
  payload?: unknown
): void => {
  if (!SIMULATOR_DEBUG_ENABLED) {
    return;
  }

  const prefix = `[simulator-debug][${channel}][${direction}] ${label}`;
  if (payload === undefined) {
    console.debug(prefix);
    return;
  }

  console.debug(prefix, payload);
};
