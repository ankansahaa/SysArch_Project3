/**
 * TypeScript type definitions for the simulator model
 * Based on Scala models from the legacy Play implementation
 */

/**
 * Represents a single value change from old to new
 */
export interface ValueUpdate<T> {
  old_value: T;
  new_value: T;
}

/**
 * Represents a program (machine or user)
 */
export interface Program {
  name: string;
  base_address: bigint;
  instructions: Record<number, [bigint, string, string[]]>;
}

/**
 * Represents the initial state of the simulation
 */
export interface InitialState {
  machine_program: Program;
  user_programs: Program[];
  registers: Record<number, bigint>;
  csrs: Record<number, bigint>;
  memory: Record<number, bigint>;
  pc: bigint;
}

/**
 * Represents a single state update (one step)
 */
export interface StateUpdate {
  index: number;
  pc: ValueUpdate<bigint>;
  register_updates: Record<number, ValueUpdate<bigint>>;
  csr_updates: Record<number, ValueUpdate<bigint>>;
  memory_updates: Record<number, ValueUpdate<bigint>>;
  terminal_output: ValueUpdate<string>;
  display_output: Record<string, ValueUpdate<bigint>>;
}

/**
 * Represents the complete state model with initial state and updates
 */
export interface StateModel {
  initial_state: InitialState;
  updates: StateUpdate[];
  suspended: boolean;
}

/**
 * Computed state - derived view of the state at a specific point
 */
export interface ComputedState {
  pc: bigint;
  registers: Record<number, bigint>;
  csrs: Record<number, bigint>;
  memory: Record<number, bigint>;
  terminal_output: string;
  display: string[]; // Array of color hex strings
  suspended: boolean;
}

/**
 * Code program - derived from StateModel.initial_state programs
 */
export interface CodeProgram {
  key: string;
  label: string;
  data: Program;
}

/**
 * Configuration for a simulation run
 */
export interface SimulatorMemoryMappedRegisters {
  mtime: string;
  mtimeh: string;
  mtimecmp: string;
  mtimecmph: string;
  keyboard_ready: string;
  keyboard_data: string;
  terminal_ready: string;
  terminal_data: string;
  display: string;
}

export interface SimulatorUserProgram {
  address: string;
  name: string;
  file: string;
}

export interface SimulatorConfig {
  name: string;
  id: string;
  memory_mapped_registers: SimulatorMemoryMappedRegisters;
  initial_pc: string;
  os_program_file: string;
  user_programs: SimulatorUserProgram[];
  initial_memory: Record<string, string>;
  terminal_delay: string;
}

export interface SourceFileEntry {
  id: string;
  path: string;
  configProgramName: string;
  configProgramAddress: string;
}

/**
 * UI Action sent to the simulator
 */
export interface UIAction {
  action: string;
  delay?: number;
  cycles?: number;
}

/**
 * WebSocket message payloads from the simulator
 */
export type SimulatorMessage =
  | {
      type: "INITIAL-STATE";
      state: InitialState;
    }
  | {
      type: "CURRENT-STATE";
      state: StateModel;
    }
  | {
      type: "STATE-UPDATE";
      update: StateUpdate;
    }
  | {
      type: "ERROR-MESSAGE";
      message: string;
    }
  | {
      type: "SUSPENDED-UPDATE";
      suspended: boolean;
    };

/**
 * Memory preset for navigation
 */
export interface MemoryPreset {
  label: string;
  value: number;
}

/**
 * Timed message state for displaying temporary messages
 */
export interface TimedMessageState {
  message: string;
  show: (message: string, onCancel?: () => void) => void;
  clear: () => void;
}

/**
 * Controls that act directly on simulation execution or simulation UI.
 */
export interface SimulationControls {
  restart: () => Promise<void>;
  resume: () => Promise<void>;
  step: () => Promise<void>;
  run: (params?: { cycles: number; delay: number }) => Promise<void>;
  stepToStart: () => void;
  stepBack: () => void;
  stepForward: () => Promise<void>;
  stepToEnd: () => Promise<void>;
  jumpToState: (stateNumber: number) => void;
  stepMemBack: () => void;
  stepMemForward: () => void;
  storeBase: (base: number) => void;
  storeCustomBase: () => void;
}

