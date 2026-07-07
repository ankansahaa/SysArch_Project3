import type { MemoryPreset } from "../types/simulator";

export const MEMORY_MIN: number = 0x00000000;
export const MEMORY_MAX: number = 0xffffff00;
export const MEMORY_STEP: number = 0x00000100;

export const SIMULATOR_BACKEND_URL: string =
  import.meta.env.VITE_SIMULATOR_BACKEND_URL ?? "http://localhost:9000";

const parseBooleanFlag = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

export const SIMULATOR_DEBUG_ENABLED: boolean = parseBooleanFlag(import.meta.env.VITE_SIMULATOR_DEBUG);

export const ALLOWED_KEYS: Set<string> = new Set([
  ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !@#$%^&*()-_=+[]{}\\|;:'\",<.>/?`~",
]);

export const MEMORY_BASE_PRESETS: MemoryPreset[] = [
  { label: "0x00000000", value: 0x00000000 },
  { label: "0x00004000", value: 0x00004000 },
  { label: "0x00008000", value: 0x00008000 },
  { label: "0x0000c000", value: 0x0000c000 },
  { label: "MMIO: 0xffff0000", value: 0xffff0000 },
  { label: "Display: 0xffff1000", value: 0xffff1000 },
];
