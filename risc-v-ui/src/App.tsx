import { useEffect, useState, type ReactElement } from "react";
import { LeaveEditorChangesModal } from "./features/editor/components/LeaveEditorChangesModal";
import { StepNavigation } from "./components/StepNavigation";
import { EditorCenterToolbar } from "./features/editor/components/EditorCenterToolbar";
import { EditorRightToolbar } from "./features/editor/components/EditorRightToolbar";
import { SourceEditorPanel } from "./features/editor/components/SourceEditorPanel";
import { SubmissionModal } from "./features/submission/components/SubmissionModal";
import { ConfigSetupPanel } from "./features/setup/components/ConfigSetupPanel";
import { IoPanel } from "./features/simulator/components/IoPanel";
import { MemoryPanel } from "./features/simulator/components/MemoryPanel";
import { SidebarPanel } from "./features/simulator/components/SidebarPanel";
import { SourcePanel } from "./features/simulator/components/SourcePanel";
import { SimulatorCenterToolbar } from "./features/simulator/components/SimulatorCenterToolbar";
import { SimulatorRightToolbar } from "./features/simulator/components/SimulatorRightToolbar";
import { useAppState } from "./hooks/useAppState";
import { decToHex } from "./utils";

function App(): ReactElement {
  const { ui, data, setUI, controls } = useAppState();
  const [showLeaveEditorModal, setShowLeaveEditorModal] = useState<boolean>(false);
  const [showSubmissionModal, setShowSubmissionModal] = useState<boolean>(false);
  const [isLeavingEditor, setIsLeavingEditor] = useState<boolean>(false);

  useEffect(() => {
    if (!data.hasState || !data.computedState) {
      return;
    }

    if (ui.sourceProgramTab !== data.activeProgramName) {
      return;
    }

    const addressId = decToHex(data.computedState.pc);
    requestAnimationFrame(() => {
      const row = document.getElementById(`${addressId}-address`);
      if (row) {
        row.scrollIntoView({ behavior: "auto", block: "nearest" });
      }
    });
  }, [data.hasState, data.computedState?.pc, data.activeProgramName, ui.sourceProgramTab]);

  useEffect(() => {
    if (ui.appView !== "editor" && showLeaveEditorModal) {
      setShowLeaveEditorModal(false);
      setIsLeavingEditor(false);
    }
  }, [showLeaveEditorModal, ui.appView]);

  const navigateToConfigSelection = (): void => {
    if (ui.appView === "editor" && data.hasAnyUnsavedSourceChanges) {
      setShowLeaveEditorModal(true);
      return;
    }

    controls.returnToConfigSelection();
  };

  const handleSaveAndLeaveEditor = async (): Promise<void> => {
    setIsLeavingEditor(true);
    try {
      await controls.saveAllSourceFiles();
      setShowLeaveEditorModal(false);
      controls.returnToConfigSelection();
    } finally {
      setIsLeavingEditor(false);
    }
  };

  const handleDiscardAndLeaveEditor = (): void => {
    controls.discardAllSourceChanges();
    setShowLeaveEditorModal(false);
    controls.returnToConfigSelection();
  };

  return (
    <div className="app-shell">
      <div className="app-nav-row">
        <StepNavigation
          appView={ui.appView}
          canGoEditor={Boolean(ui.selectedConfigId)}
          canGoSimulation={
            (ui.appView === "setup" && Boolean(ui.selectedConfigId)) ||
            (ui.appView === "editor" && !data.hasAnyUnsavedSourceChanges)
          }
          onGoConfig={navigateToConfigSelection}
          onGoEditor={controls.returnToEditor}
          onGoSimulation={() => {
            void controls.startSimulation();
          }}
          onOpenSubmission={() => {
            setShowSubmissionModal(true);
          }}
        />

        <div className="app-nav-center">
          {ui.appView === "editor" && (
            <EditorCenterToolbar
              hasAnyUnsavedChanges={data.hasAnyUnsavedSourceChanges}
              isLoading={data.isEditorLoading}
              onStartSimulation={controls.startSimulation}
            />
          )}

          {ui.appView === "simulator" && (
            <SimulatorCenterToolbar
              cycles={ui.cycles}
              delay={ui.delay}
              suspended={data.computedState?.suspended ?? false}
              setCycles={setUI.setCycles}
              setDelay={setUI.setDelay}
              controls={controls}
            />
          )}
        </div>

        <div className="app-nav-right">
          {ui.appView === "editor" && (
            <EditorRightToolbar
              hasUnsavedChanges={data.hasUnsavedSourceChanges}
              isLoading={data.isEditorLoading}
              onSave={controls.saveCurrentSourceFile}
              onRevert={controls.revertCurrentSourceFile}
            />
          )}

          {ui.appView === "simulator" && (
            <SimulatorRightToolbar
              currentStateNumber={data.currentStateNumber}
              totalStateCount={data.totalStateCount}
              controls={controls}
              suspended={data.computedState?.suspended ?? false}
            />
          )}
        </div>
      </div>

      {ui.errorMessage && <div className="error-message">{ui.errorMessage}</div>}

      <LeaveEditorChangesModal
        isOpen={showLeaveEditorModal}
        isSaving={isLeavingEditor}
        onCancel={() => {
          setShowLeaveEditorModal(false);
        }}
        onDiscard={handleDiscardAndLeaveEditor}
        onSave={() => {
          void handleSaveAndLeaveEditor();
        }}
      />

      <SubmissionModal
        isOpen={showSubmissionModal}
        onClose={() => {
          setShowSubmissionModal(false);
        }}
        onFetchContributions={controls.fetchContributions}
        onSaveContributions={controls.saveContributions}
        onDownloadSubmission={controls.downloadSubmission}
      />

      {ui.appView === "setup" && (
        <ConfigSetupPanel
          builtInConfigs={data.builtInConfigs}
          customConfigs={data.customConfigs}
          isLoading={data.isConfigLoading}
          selectedConfigId={ui.selectedConfigId}
          onSelectConfig={setUI.setSelectedConfigId}
          onUploadConfig={controls.uploadConfigFile}
          onCreateConfig={controls.createConfig}
          onDeleteCustomConfig={controls.deleteCustomConfig}
          onConfirm={controls.confirmConfigSelection}
        />
      )}

      {ui.appView === "simulator" && (!data.hasState || !data.computedState) && (
        <main className="uninitialized-message">Simulation is starting. Wait for backend state updates.</main>
      )}

      {ui.appView === "simulator" && data.hasState && data.computedState && data.computedState.suspended && (
        <main className="uninitialized-message">Simulation is suspended. Resume to continue.</main>
      )}

      {ui.appView === "simulator" && data.hasState && data.computedState && !data.computedState.suspended && (
        <main className="content-grid">
          <SourcePanel
            codePrograms={data.codePrograms}
            activeProgramName={data.activeProgramName}
            visibleProgramName={ui.sourceProgramTab}
            setVisibleProgramName={setUI.setSourceProgramTab}
            currentPc={data.computedState?.pc ?? 0}
          />

          <SidebarPanel
            tab={ui.sidebarTab}
            setTab={setUI.setSidebarTab}
            registers={data.computedState.registers}
            csrs={data.computedState.csrs}
          />

          <section className="bottom-panel">
            <MemoryPanel
              memory={data.computedState.memory}
              memoryBaseAddress={ui.memoryBaseAddress}
              memoryBasePresets={data.memoryBasePresets}
              customBaseInput={ui.customBaseInput}
              setCustomBaseInput={setUI.setCustomBaseInput}
              controls={controls}
            />

            <IoPanel
              keyboardEnabled={ui.keyboardEnabled}
              setKeyboardEnabled={setUI.setKeyboardEnabled}
              terminalInput={ui.terminalInput}
              outputTab={ui.outputTab}
              setOutputTab={setUI.setOutputTab}
              terminalOutput={data.computedState.terminal_output ?? ""}
              displayPixels={data.computedState.display ?? []}
            />
          </section>
        </main>
      )}

      {ui.appView === "editor" && (
        <SourceEditorPanel
          files={data.sourceFiles}
          selectedFileId={data.selectedSourceFileId}
          selectedContent={data.selectedSourceContent}
          isLoading={data.isEditorLoading}
          dirtyFileIds={data.dirtyFileIds}
          onSelectFile={setUI.setSelectedSourceFileId}
          onChangeContent={setUI.setSelectedSourceContent}
        />
      )}
    </div>
  );
}

export default App;
