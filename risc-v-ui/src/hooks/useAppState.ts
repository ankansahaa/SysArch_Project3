import { useMemo } from "react";
import { SIMULATOR_BACKEND_URL } from "../constants/simulator";
import { createSimulatorApi } from "../services/api";
import type { AppControls, AppStateHookReturn } from "../types/app";
import { useTimedMessage } from "./useTimedMessage";
import { useAppGlobalState } from "./useAppGlobalState";
import { useTaskChooserState } from "./useTaskChooserState";
import { useEditorState } from "./useEditorState";
import { useSimulationState } from "./useSimulationState";

export const useAppState = (): AppStateHookReturn => {
  const api = useMemo(() => createSimulatorApi(SIMULATOR_BACKEND_URL), []);
  const { message: transientErrorMessage, show: showError, clear: clearError } = useTimedMessage(10000);

  const globalState = useAppGlobalState();
  const taskChooser = useTaskChooserState({
    api,
    selectedConfigId: globalState.selectedConfigId,
    setSelectedConfigId: globalState.setSelectedConfigId,
    setAppView: globalState.setAppView,
    showError,
  });

  const editor = useEditorState({
    api,
    appView: globalState.appView,
    selectedConfigId: globalState.selectedConfigId,
    activeConfig: taskChooser.activeConfig,
    showError,
  });

  const simulation = useSimulationState({
    api,
    appView: globalState.appView,
    showError,
    clearError,
  });

  const visibleErrorMessage = editor.unsupportedDirectiveWarning || transientErrorMessage;

  const controls: AppControls = {
    ...simulation.controls,

    returnToEditor() {
      globalState.setAppView("editor");
    },

    async loadSelectedConfig() {
      if (taskChooser.activeConfig) {
        await api.setConfig(taskChooser.activeConfig);
      }
    },

    async uploadConfigFile(file: File) {
      await taskChooser.uploadConfigFile(file);
    },

    async createConfig(config: unknown) {
      await taskChooser.createConfig(config);
    },

    async deleteCustomConfig(id: string) {
      await taskChooser.deleteCustomConfig(id);
    },

    async saveCurrentSourceFile() {
      await editor.saveCurrentSourceFile();
    },

    async saveAllSourceFiles() {
      await editor.saveDirtyFiles();
    },

    async fetchContributions() {
      return api.fetchContributions();
    },

    async saveContributions(content: string) {
      await api.saveContributions(content);
    },

    async downloadSubmission() {
      const { blob, fileName } = await api.fetchSubmission();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    },

    discardAllSourceChanges() {
      editor.discardAllSourceChanges();
    },

    confirmConfigSelection() {
      if (!taskChooser.activeConfig) {
        showError("Select a task before continuing.");
        return;
      }

      globalState.setAppView("editor");
    },

    returnToConfigSelection() {
      globalState.setAppView("setup");
    },

    async startSimulation() {
      if (!taskChooser.activeConfig) {
        showError("Select a task before starting simulation.");
        return;
      }

      await editor.saveDirtyFiles();
      await api.setConfig(taskChooser.activeConfig);
      globalState.setAppView("simulator");
    },

    revertCurrentSourceFile() {
      editor.revertCurrentSourceFile();
    },
  };

  return {
    ui: {
      appView: globalState.appView,
      selectedConfigId: globalState.selectedConfigId,
      sidebarTab: simulation.ui.sidebarTab,
      outputTab: simulation.ui.outputTab,
      sourceProgramTab: simulation.ui.sourceProgramTab,
      delay: simulation.ui.delay,
      cycles: simulation.ui.cycles,
      keyboardEnabled: simulation.ui.keyboardEnabled,
      terminalInput: simulation.ui.terminalInput,
      memoryBaseAddress: simulation.ui.memoryBaseAddress,
      customBaseInput: simulation.ui.customBaseInput,
      errorMessage: visibleErrorMessage,
    },
    data: {
      hasState: simulation.data.hasState,
      stateCounter: simulation.data.stateCounter,
      currentStateNumber: simulation.data.currentStateNumber,
      totalStateCount: simulation.data.totalStateCount,
      computedState: simulation.data.computedState,
      codePrograms: simulation.data.codePrograms,
      activeProgramName: simulation.data.activeProgramName,
      builtInConfigs: taskChooser.builtInConfigs,
      customConfigs: taskChooser.customConfigs,
      availableConfigs: taskChooser.availableConfigs,
      isConfigLoading: taskChooser.isConfigLoading,
      sourceFiles: editor.sourceFiles,
      selectedSourceFileId: editor.selectedSourceFileId,
      selectedSourceContent: editor.selectedSourceContent,
      isEditorLoading: editor.isEditorLoading,
      hasUnsavedSourceChanges: editor.hasUnsavedSourceChanges,
      dirtyFileIds: editor.dirtyFileIds,
      hasAnyUnsavedSourceChanges: editor.hasAnyUnsavedSourceChanges,
      memoryBasePresets: simulation.data.memoryBasePresets,
    },
    setUI: {
      setSidebarTab: simulation.setUI.setSidebarTab,
      setOutputTab: simulation.setUI.setOutputTab,
      setSourceProgramTab: simulation.setUI.setSourceProgramTab,
      setSelectedConfigId: globalState.setSelectedConfigId,
      setDelay: simulation.setUI.setDelay,
      setCycles: simulation.setUI.setCycles,
      setKeyboardEnabled: simulation.setUI.setKeyboardEnabled,
      setTerminalInput: simulation.setUI.setTerminalInput,
      setCustomBaseInput: simulation.setUI.setCustomBaseInput,
      setSelectedSourceFileId: editor.setSelectedSourceFileId,
      setSelectedSourceContent: editor.setSelectedSourceContent,
    },
    controls,
  };
};
