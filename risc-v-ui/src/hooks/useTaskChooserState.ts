import { useEffect, useMemo, useState } from "react";
import type { AppView } from "../types/app";
import type { SimulatorConfig } from "../types/simulator";
import { validateSimulatorConfig } from "../utils";
import type { createSimulatorApi } from "../services/api";

interface UseTaskChooserStateParams {
  api: ReturnType<typeof createSimulatorApi>;
  selectedConfigId: string;
  setSelectedConfigId: (id: string) => void;
  setAppView: (view: AppView) => void;
  showError: (message: string) => void;
}

interface TaskChooserState {
  builtInConfigs: SimulatorConfig[];
  customConfigs: SimulatorConfig[];
  availableConfigs: SimulatorConfig[];
  isConfigLoading: boolean;
  activeConfig: SimulatorConfig | undefined;
  uploadConfigFile: (file: File) => Promise<void>;
  createConfig: (config: unknown) => Promise<void>;
  deleteCustomConfig: (id: string) => Promise<void>;
}

const sortConfigs = (configs: SimulatorConfig[]): SimulatorConfig[] =>
  [...configs].sort((a, b) => String(a.id).localeCompare(String(b.id)));

export const useTaskChooserState = ({
  api,
  selectedConfigId,
  setSelectedConfigId,
  setAppView,
  showError,
}: UseTaskChooserStateParams): TaskChooserState => {
  const [builtInConfigs, setBuiltInConfigs] = useState<SimulatorConfig[]>([]);
  const [customConfigs, setCustomConfigs] = useState<SimulatorConfig[]>([]);
  const [isConfigLoading, setIsConfigLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadConfigs = async (): Promise<void> => {
      setIsConfigLoading(true);
      try {
        const [fetchedBuiltIn, fetchedCustom] = await Promise.all([
          api.fetchAvailableConfigs(),
          api.fetchAvailableCustomConfigs(),
        ]);
        setBuiltInConfigs(sortConfigs(fetchedBuiltIn));
        setCustomConfigs(sortConfigs(fetchedCustom));
        setSelectedConfigId("");
        setAppView("setup");
      } catch {
        setBuiltInConfigs([]);
        setCustomConfigs([]);
        setSelectedConfigId("");
        setAppView("setup");
      } finally {
        setIsConfigLoading(false);
      }
    };

    void loadConfigs();
  }, [api, setAppView, setSelectedConfigId]);

  const availableConfigs = useMemo(
    () => sortConfigs([...builtInConfigs, ...customConfigs]),
    [builtInConfigs, customConfigs]
  );

  const activeConfig = useMemo(
    () => availableConfigs.find((config) => String(config.id) === String(selectedConfigId)),
    [availableConfigs, selectedConfigId]
  );

  const refreshCustomConfigs = async (): Promise<SimulatorConfig[]> => {
    const fetchedCustom = await api.fetchAvailableCustomConfigs();
    const sortedCustom = sortConfigs(fetchedCustom);
    setCustomConfigs(sortedCustom);
    return sortedCustom;
  };

  const postAndSelectCustomConfig = async (value: unknown): Promise<void> => {
    const parsed = validateSimulatorConfig(value);
    await api.postCustomConfig(parsed);
    await refreshCustomConfigs();
    setSelectedConfigId(parsed.id);
  };

  const uploadConfigFile = async (file: File): Promise<void> => {
    const text = await file.text();
    try {
      await postAndSelectCustomConfig(JSON.parse(text));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Invalid task file");
    }
  };

  const createConfig = async (config: unknown): Promise<void> => {
    await postAndSelectCustomConfig(config);
  };

  const deleteCustomConfig = async (id: string): Promise<void> => {
    await api.deleteCustomConfig(id);
    await refreshCustomConfigs();
    if (String(selectedConfigId) === String(id)) {
      setSelectedConfigId("");
    }
  };

  return {
    builtInConfigs,
    customConfigs,
    availableConfigs,
    isConfigLoading,
    activeConfig,
    uploadConfigFile,
    createConfig,
    deleteCustomConfig,
  };
};
