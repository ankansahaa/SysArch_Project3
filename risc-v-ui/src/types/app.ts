import type {
  CodeProgram,
  ComputedState,
  MemoryPreset,
  SimulationControls,
  SimulatorConfig,
  SourceFileEntry,
} from "./simulator";

export type AppView = "setup" | "editor" | "simulator";

/**
 * UI state for the overall application flow.
 */
export interface AppUIState {
  sidebarTab: "registers" | "csrs";
  outputTab: "terminal" | "display";
  sourceProgramTab: string;
  appView: AppView;
  selectedConfigId: string;
  delay: number;
  cycles: number;
  keyboardEnabled: boolean;
  terminalInput: string;
  memoryBaseAddress: number;
  customBaseInput: string;
  errorMessage: string;
}

/**
 * Controls that manage cross-page app workflow and task/editor actions.
 */
export interface AppFlowControls {
  returnToEditor: () => void;
  loadSelectedConfig: () => Promise<void>;
  uploadConfigFile: (file: File) => Promise<void>;
  createConfig: (config: unknown) => Promise<void>;
  deleteCustomConfig: (id: string) => Promise<void>;
  saveCurrentSourceFile: () => Promise<void>;
  saveAllSourceFiles: () => Promise<void>;
  fetchContributions: () => Promise<string>;
  saveContributions: (content: string) => Promise<void>;
  downloadSubmission: () => Promise<void>;
  discardAllSourceChanges: () => void;
  confirmConfigSelection: () => void;
  returnToConfigSelection: () => void;
  startSimulation: () => Promise<void>;
  revertCurrentSourceFile: () => void;
}

/**
 * Full controls surface returned by the composed app state hook.
 */
export type AppControls = SimulationControls & AppFlowControls;

/**
 * Return type of the composed app state hook.
 */
export interface AppStateHookReturn {
  ui: AppUIState;
  data: {
    hasState: boolean;
    stateCounter: string;
    currentStateNumber: number;
    totalStateCount: number;
    computedState: ComputedState | null;
    codePrograms: CodeProgram[];
    activeProgramName: string;
    builtInConfigs: SimulatorConfig[];
    customConfigs: SimulatorConfig[];
    availableConfigs: SimulatorConfig[];
    isConfigLoading: boolean;
    sourceFiles: SourceFileEntry[];
    selectedSourceFileId: string;
    selectedSourceContent: string;
    isEditorLoading: boolean;
    hasUnsavedSourceChanges: boolean;
    dirtyFileIds: string[];
    hasAnyUnsavedSourceChanges: boolean;
    memoryBasePresets: MemoryPreset[];
  };
  setUI: {
    setSidebarTab: (tab: "registers" | "csrs") => void;
    setOutputTab: (tab: "terminal" | "display") => void;
    setSourceProgramTab: (tab: string) => void;
    setSelectedConfigId: (id: string) => void;
    setDelay: (delay: number) => void;
    setCycles: (cycles: number) => void;
    setKeyboardEnabled: (enabled: boolean) => void;
    setTerminalInput: (input: string) => void;
    setCustomBaseInput: (input: string) => void;
    setSelectedSourceFileId: (id: string) => void;
    setSelectedSourceContent: (content: string) => void;
  };
  controls: AppControls;
}

/**
 * Backward-compatible aliases for legacy naming.
 */
export type UIState = AppUIState;
export type SimulatorControls = AppControls;
export type SimulatorHookReturn = AppStateHookReturn;
