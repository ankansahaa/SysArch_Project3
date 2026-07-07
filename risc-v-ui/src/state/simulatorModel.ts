import {
  ComputedState,
  CodeProgram,
  InitialState,
  StateModel,
  StateUpdate,
  ValueUpdate,
  Program,
} from "../types/simulator";
import { MEMORY_MAX, MEMORY_MIN } from "../constants/simulator";

type PairEntries<K extends string | number, V> = Array<[K, V]>;

const warnInvalidMapPayload = (fieldName: string, details: string, payload: unknown): void => {
  console.warn(`[simulator-model] Invalid map payload for ${fieldName}: ${details}`, payload);
};

const isPairEntries = <K extends string | number, V>(value: unknown): value is PairEntries<K, V> =>
  Array.isArray(value) &&
  value.every(
    (entry) => Array.isArray(entry) && entry.length === 2 && (typeof entry[0] === "string" || typeof entry[0] === "number")
  );

const normalizeRecord = <K extends string | number, V>(
  value: Record<string | number, V> | PairEntries<K, V> | undefined,
  keyTransform: (raw: string | number) => string | number | null,
  fieldName: string
): Record<string | number, V> => {
  if (!value) {
    return {};
  }

  if (Array.isArray(value) && !isPairEntries<K, V>(value)) {
    warnInvalidMapPayload(fieldName, "expected array of [key, value] entries", value);
    return {};
  }

  if (isPairEntries<K, V>(value)) {
    return value.reduce<Record<string | number, V>>((acc, [rawKey, itemValue]) => {
      const transformedKey = keyTransform(rawKey);
      if (transformedKey === null) {
        warnInvalidMapPayload(fieldName, `invalid key: ${String(rawKey)}`, [rawKey, itemValue]);
        return acc;
      }

      acc[transformedKey] = itemValue;
      return acc;
    }, {});
  }

  return Object.entries(value).reduce<Record<string | number, V>>((acc, [rawKey, itemValue]) => {
    const transformedKey = keyTransform(rawKey);
    if (transformedKey === null) {
      warnInvalidMapPayload(fieldName, `invalid key: ${String(rawKey)}`, [rawKey, itemValue]);
      return acc;
    }

    acc[transformedKey] = itemValue;
    return acc;
  }, {});
};

const normalizeNumericMap = <V>(
  value: Record<string | number, V> | PairEntries<string | number, V> | undefined,
  fieldName: string
): Record<number, V> =>
  normalizeRecord(
    value,
    (raw) => {
      const numericKey = Number(raw);
      return Number.isFinite(numericKey) ? numericKey : null;
    },
    fieldName
  ) as Record<number, V>;

const normalizeStringMap = <V>(
  value: Record<string | number, V> | PairEntries<string | number, V> | undefined,
  fieldName: string
): Record<string, V> => normalizeRecord(value, (raw) => String(raw), fieldName) as Record<string, V>;

export const clampMemoryBase = (base: number): number => {
  const normalized = Number(base) >>> 0;
  return Math.max(MEMORY_MIN, Math.min(MEMORY_MAX, normalized));
};

const cloneProgram = (program: Program | undefined): Program | undefined => {
  if (!program) return undefined;
  return {
    ...program,
    instructions: normalizeNumericMap(program.instructions, `program.instructions.${program.name ?? "unknown"}`),
  };
};

export const cloneInitialState = (initialState: InitialState): InitialState => ({
  ...initialState,
  machine_program: cloneProgram(initialState.machine_program) as Program,
  user_programs: (initialState.user_programs ?? []).map(cloneProgram) as Program[],
  registers: normalizeNumericMap(initialState.registers, "initial_state.registers"),
  csrs: normalizeNumericMap(initialState.csrs, "initial_state.csrs"),
  memory: normalizeNumericMap(initialState.memory, "initial_state.memory"),
});

const cloneValueUpdateMap = (
  updates:
    | Record<string | number, ValueUpdate<unknown>>
    | PairEntries<string | number, ValueUpdate<unknown>>
    | undefined,
  keyType: "number" | "string" = "number",
  fieldName: string
): Record<string | number, ValueUpdate<unknown>> =>
  keyType === "number"
    ? normalizeNumericMap(updates, fieldName)
    : normalizeStringMap(updates, fieldName);

export const cloneUpdate = (update: StateUpdate): StateUpdate => ({
  ...update,
  register_updates: cloneValueUpdateMap(update.register_updates, "number", "state_update.register_updates") as Record<
    number,
    ValueUpdate<bigint>
  >,
  csr_updates: cloneValueUpdateMap(update.csr_updates, "number", "state_update.csr_updates") as Record<
    number,
    ValueUpdate<bigint>
  >,
  memory_updates: cloneValueUpdateMap(update.memory_updates, "number", "state_update.memory_updates") as Record<
    number,
    ValueUpdate<bigint>
  >,
  display_output: cloneValueUpdateMap(update.display_output, "string", "state_update.display_output") as Record<
    string,
    ValueUpdate<bigint>
  >,
  pc: { ...update.pc },
  terminal_output: { ...update.terminal_output },
});

export const cloneStateModel = (state: StateModel): StateModel => ({
  initial_state: cloneInitialState(state.initial_state),
  updates: (state.updates ?? []).map(cloneUpdate),
  suspended: state.suspended,
});

const createComputedState = (initialState: InitialState): ComputedState => ({
  pc: BigInt(initialState.pc ?? 0),
  registers: { ...(initialState.registers ?? {}) },
  csrs: { ...(initialState.csrs ?? {}) },
  memory: { ...(initialState.memory ?? {}) },
  terminal_output: "",
  display: Array.from({ length: 32 * 32 }, () => "#000000"),
  suspended: false,
});

const setDisplayPixel = (display: string[], xyKey: string, rawValue: bigint): void => {
  const match = String(xyKey).match(/\((\d+),\s*(\d+)\)/);
  if (!match) {
    return;
  }

  const x = Number(match[1]);
  const y = Number(match[2]);
  if (x < 0 || x >= 32 || y < 0 || y >= 32) {
    return;
  }

  const color = Number(rawValue) & 0xffffff;
  display[y * 32 + x] = `#${color.toString(16).padStart(6, "0")}`;
};

const applyUpdateToComputed = (computed: ComputedState, update: StateUpdate): void => {
  computed.pc = BigInt(update.pc?.new_value ?? computed.pc);
  computed.terminal_output = update.terminal_output?.new_value ?? computed.terminal_output;

  Object.entries(update.register_updates ?? {}).forEach(([registerNumber, registerUpdate]) => {
    computed.registers[Number(registerNumber)] = registerUpdate.new_value;
  });

  Object.entries(update.csr_updates ?? {}).forEach(([csrName, csrUpdate]) => {
    computed.csrs[Number(csrName)] = csrUpdate.new_value;
  });

  Object.entries(update.memory_updates ?? {}).forEach(([address, valueUpdate]) => {
    computed.memory[Number(address)] = valueUpdate.new_value;
  });

  Object.entries(update.display_output ?? {}).forEach(([xyAddress, colorUpdate]) => {
    setDisplayPixel(computed.display, xyAddress, colorUpdate.new_value);
  });
};

export const buildComputedState = (stateModel: StateModel, index: number): ComputedState => {
  const computed = createComputedState(stateModel.initial_state);
  const sorted = [...(stateModel.updates ?? [])].sort((a, b) => a.index - b.index);
  sorted.forEach((update) => {
    if (Number(update.index) <= Number(index)) {
      applyUpdateToComputed(computed, update);
    }
  });
  computed.suspended = stateModel.suspended;
  return computed;
};

export const inferActiveProgramName = (stateModel: StateModel, computedState: ComputedState): string => {
  const pc = Number(computedState.pc);
  const machineInstructions = stateModel.initial_state.machine_program.instructions ?? {};
  if (machineInstructions[Number(pc)] !== undefined) {
    return "machine";
  }

  const users = stateModel.initial_state.user_programs ?? [];
  for (let index = users.length - 1; index >= 0; index -= 1) {
    if (users[index]?.instructions?.[Number(pc)] !== undefined) {
      return `user-${index}`;
    }
  }

  return "machine";
};

export const buildCodePrograms = (stateModel: StateModel): CodeProgram[] => [
  {
    key: "machine",
    label: stateModel.initial_state.machine_program.name,
    data: stateModel.initial_state.machine_program,
  },
  ...(stateModel.initial_state.user_programs ?? []).map((program, index) => ({
    key: `user-${index}`,
    label: program.name,
    data: program,
  })),
];
