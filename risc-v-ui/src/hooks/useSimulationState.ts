import { useEffect, useMemo, useRef, useState } from "react";
import {
  ALLOWED_KEYS,
  MEMORY_BASE_PRESETS,
  MEMORY_STEP,
  SIMULATOR_BACKEND_URL,
} from "../constants/simulator";
import type { createSimulatorApi } from "../services/api";
import { openSimulatorSocket } from "../services/socket";
import {
  buildCodePrograms,
  buildComputedState,
  clampMemoryBase,
  cloneInitialState,
  cloneStateModel,
  cloneUpdate,
  inferActiveProgramName,
} from "../state/simulatorModel";
import type { AppView } from "../types/app";
import type {
  CodeProgram,
  ComputedState,
  MemoryPreset,
  SimulationControls,
  StateModel,
} from "../types/simulator";
import { parseAddressInput } from "../utils";

interface UseSimulationStateParams {
  api: ReturnType<typeof createSimulatorApi>;
  appView: AppView;
  showError: (message: string) => void;
  clearError: () => void;
}

interface SimulationUiState {
  sidebarTab: "registers" | "csrs";
  outputTab: "terminal" | "display";
  sourceProgramTab: string;
  delay: number;
  cycles: number;
  keyboardEnabled: boolean;
  terminalInput: string;
  memoryBaseAddress: number;
  customBaseInput: string;
}

interface SimulationDataState {
  hasState: boolean;
  stateCounter: string;
  currentStateNumber: number;
  totalStateCount: number;
  computedState: ComputedState | null;
  codePrograms: CodeProgram[];
  activeProgramName: string;
  memoryBasePresets: MemoryPreset[];
}

interface SimulationSetters {
  setSidebarTab: (tab: "registers" | "csrs") => void;
  setOutputTab: (tab: "terminal" | "display") => void;
  setSourceProgramTab: (tab: string) => void;
  setDelay: (delay: number) => void;
  setCycles: (cycles: number) => void;
  setKeyboardEnabled: (enabled: boolean) => void;
  setTerminalInput: (input: string) => void;
  setCustomBaseInput: (input: string) => void;
}

interface SimulationState {
  ui: SimulationUiState;
  data: SimulationDataState;
  setUI: SimulationSetters;
  controls: SimulationControls;
}

export const useSimulationState = ({ api, appView, showError, clearError }: UseSimulationStateParams): SimulationState => {
  const [stateModel, setStateModel] = useState<StateModel | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [keyboardEnabled, setKeyboardEnabled] = useState<boolean>(false);
  const [terminalInput, setTerminalInput] = useState<string>("");
  const [delay, setDelay] = useState<number>(0);
  const [cycles, setCycles] = useState<number>(100);
  const [memoryBaseAddress, setMemoryBaseAddress] = useState<number>(0x00000000);
  const [customBaseInput, setCustomBaseInput] = useState<string>("");
  const [sidebarTab, setSidebarTab] = useState<"registers" | "csrs">("registers");
  const [outputTab, setOutputTab] = useState<"terminal" | "display">("terminal");
  const [sourceProgramTab, setSourceProgramTab] = useState<string>("machine");

  const isLiveRef = useRef<boolean>(true);

  const computedState = useMemo((): ComputedState | null => {
    if (!stateModel) {
      return null;
    }
    return buildComputedState(stateModel, currentIndex);
  }, [currentIndex, stateModel]);

  const activeProgramName = useMemo((): string => {
    if (!stateModel || !computedState) {
      return "machine";
    }
    return inferActiveProgramName(stateModel, computedState);
  }, [computedState, stateModel]);

  const codePrograms = useMemo((): CodeProgram[] => {
    if (!stateModel) {
      return [];
    }

    return buildCodePrograms(stateModel);
  }, [stateModel]);

  const hasState = Boolean(stateModel && computedState);

  useEffect(() => {
    if (!codePrograms.length) {
      return;
    }

    setSourceProgramTab(activeProgramName);
  }, [activeProgramName, codePrograms]);

  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      try {
        const current = await api.fetchCurrentState();
        const model = cloneStateModel(current);
        setStateModel(model);
        setCurrentIndex((model.updates ?? []).length);
      } catch {
        setStateModel(null);
        setCurrentIndex(0);
      }
    };

    void bootstrap();

    const socket = openSimulatorSocket({
      backendUrl: SIMULATOR_BACKEND_URL,
      onMessage: (payload) => {
        if (payload.type === "INITIAL-STATE") {
          setStateModel({ initial_state: cloneInitialState(payload.state), updates: [] });
          setCurrentIndex(0);
          setIsLive(true);
          setKeyboardEnabled(false);
          setTerminalInput("");
          clearError();
          return;
        }

        if (payload.type === "CURRENT-STATE") {
          setStateModel((prev : StateModel | null) => {
            if (prev) {
              return prev;
            }

            const model = cloneStateModel(payload.state);
            setCurrentIndex((model.updates ?? []).length);
            setIsLive(true);
            return model;
          });
          return;
        }

        if (payload.type === "STATE-UPDATE") {
          setStateModel((prev : StateModel | null) => {
            if (!prev) {
              return prev;
            }

            const nextUpdates = [...(prev.updates ?? []), cloneUpdate(payload.update)];
            if (isLiveRef.current) {
              setCurrentIndex(nextUpdates.length);
            }

            return {
              ...prev,
              updates: nextUpdates,
            };
          });
          return;
        }

        if (payload.type === "ERROR-MESSAGE") {
          showError(payload.message);
          setStateModel(null);
          setCurrentIndex(0);
          setIsLive(true);
        }

        if (payload.type === "SUSPENDED-UPDATE") {
          setStateModel((prev : StateModel | null) => {
            if (!prev) {
              return prev;
            }

            return {
              ...prev,
              suspended: payload.suspended,
            };
          });
          
        }
      },
    });

    return () => {
      socket.close();
      clearError();
    };
  }, [api, clearError, showError]);

  useEffect(() => {
    // Ensure keyboard input capture is only active within simulation.
    if (appView !== "simulator" && keyboardEnabled) {
      setKeyboardEnabled(false);
    }
  }, [appView, keyboardEnabled]);

  useEffect(() => {
    const onGlobalKeyDown = async (event: KeyboardEvent): Promise<void> => {
      if (appView !== "simulator" || !keyboardEnabled || !ALLOWED_KEYS.has(event.key)) {
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const disallowed =
        active &&
        (active.id === "cycle-input" ||
          active.id === "delay-input" ||
          active.id === "jump-state-input" ||
          active.id === "custom-base-input");
      if (disallowed) {
        return;
      }

      event.preventDefault();
      setTerminalInput((prev: string) => prev + event.key);
      await api.postKey(event.key);
    };

    window.addEventListener("keydown", onGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown);
    };
  }, [api, appView, keyboardEnabled]);

  const controls: SimulationControls = {
    async restart() {
      await api.postAction("RESTART");
    },

    async resume() {
      await api.postAction("RESUME");
    },

    async step() {
      await api.postAction("STEP");
    },

    async run(params) {
      const nextCycles = params?.cycles ?? cycles;
      const nextDelay = params?.delay ?? delay;
      await api.postAction("RUN", nextDelay, nextCycles);
    },

    stepToStart() {
      setCurrentIndex(0);
      setIsLive(false);
    },

    stepBack() {
      setCurrentIndex((prev: number) => {
        if (prev <= 0) {
          return 0;
        }

        setIsLive(false);
        return prev - 1;
      });
    },

    async stepForward() {
      if (!stateModel) {
        return;
      }

      if (currentIndex >= stateModel.updates.length) {
        setIsLive(true);
        await api.postAction("STEP");
        return;
      }

      setCurrentIndex((prev: number) => {
        const nextIndex = Math.min(prev + 1, stateModel.updates.length);
        setIsLive(nextIndex === stateModel.updates.length);
        return nextIndex;
      });
    },

    async stepToEnd() {
      if (!stateModel) {
        return;
      }

      if (currentIndex >= stateModel.updates.length) {
        setIsLive(true);
        await api.postAction("STEP");
        return;
      }

      setCurrentIndex(stateModel.updates.length);
      setIsLive(true);
    },

    jumpToState(stateNumber: number) {
      if (!stateModel) {
        return;
      }

      const parsed = Number.isFinite(stateNumber) ? Math.trunc(stateNumber) : 1;
      const totalStates = stateModel.updates.length + 1;
      const clampedState = Math.max(1, Math.min(parsed, totalStates));
      const nextIndex = clampedState - 1;

      setCurrentIndex(nextIndex);
      setIsLive(nextIndex === stateModel.updates.length);
    },

    stepMemBack() {
      setMemoryBaseAddress((prev: number) => clampMemoryBase(prev - MEMORY_STEP));
    },

    stepMemForward() {
      setMemoryBaseAddress((prev: number) => clampMemoryBase(prev + MEMORY_STEP));
    },

    storeBase(base: number) {
      setMemoryBaseAddress(clampMemoryBase(base));
    },

    storeCustomBase() {
      setMemoryBaseAddress((prev: number) => {
        if (!customBaseInput) {
          return prev;
        }

        return clampMemoryBase(parseAddressInput(customBaseInput));
      });
    },
  };

  return {
    ui: {
      sidebarTab,
      outputTab,
      sourceProgramTab,
      delay,
      cycles,
      keyboardEnabled,
      terminalInput,
      memoryBaseAddress,
      customBaseInput,
    },
    data: {
      hasState,
      stateCounter: hasState ? `${currentIndex + 1}/${(stateModel?.updates.length ?? 0) + 1}` : "0/0",
      currentStateNumber: hasState ? currentIndex + 1 : 0,
      totalStateCount: hasState ? (stateModel?.updates.length ?? 0) + 1 : 0,
      computedState,
      codePrograms,
      activeProgramName,
      memoryBasePresets: MEMORY_BASE_PRESETS,
    },
    setUI: {
      setSidebarTab,
      setOutputTab,
      setSourceProgramTab,
      setDelay,
      setCycles,
      setKeyboardEnabled,
      setTerminalInput,
      setCustomBaseInput,
    },
    controls,
  };
};
