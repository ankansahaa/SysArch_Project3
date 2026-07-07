import { useMemo, useState, type ChangeEvent, type KeyboardEvent, type ReactElement } from "react";
import { faCopy, faDownload, faPenToSquare, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { DialogModal } from "../../../components/DialogModal";
import { TaskEditorModal } from "./TaskEditorModal";
import type { SimulatorConfig } from "../../../types/simulator";

interface ConfigSetupPanelProps {
  builtInConfigs: SimulatorConfig[];
  customConfigs: SimulatorConfig[];
  isLoading: boolean;
  selectedConfigId: string;
  onSelectConfig: (id: string) => void;
  onUploadConfig: (file: File) => Promise<void>;
  onCreateConfig: (config: SimulatorConfig) => Promise<void>;
  onDeleteCustomConfig: (id: string) => Promise<void>;
  onConfirm: () => void;
}

const getFileName = (path: string): string => {
  const segments = path.split("/");
  return segments[segments.length - 1] || path;
};

const getNextCustomTaskNumber = (configs: SimulatorConfig[]): number => {
  const usedNumbers = new Set<number>();

  configs.forEach((config) => {
    const match = /^custom-task-(\d+)$/i.exec(config.id.trim());
    if (!match) {
      return;
    }

    const parsed = Number.parseInt(match[1], 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      usedNumbers.add(parsed);
    }
  });

  let candidate = 1;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  return candidate;
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getNextDerivedCustomNumber = (configs: SimulatorConfig[], baseId: string): number => {
  const usedNumbers = new Set<number>();
  const pattern = new RegExp(`^${escapeRegex(baseId)}-custom-(\\d+)$`, "i");

  configs.forEach((config) => {
    const match = pattern.exec(config.id.trim());
    if (!match) {
      return;
    }

    const parsed = Number.parseInt(match[1], 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      usedNumbers.add(parsed);
    }
  });

  let candidate = 1;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  return candidate;
};

const sanitizeFileName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "task";

const downloadConfigJson = (config: SimulatorConfig): void => {
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileName(config.id)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const ConfigSetupPanel = ({
  builtInConfigs,
  customConfigs,
  isLoading,
  selectedConfigId,
  onSelectConfig,
  onUploadConfig,
  onCreateConfig,
  onDeleteCustomConfig,
  onConfirm,
}: ConfigSetupPanelProps): ReactElement => {
  const [isTaskEditorOpen, setIsTaskEditorOpen] = useState<boolean>(false);
  const [isTaskEditorSubmitting, setIsTaskEditorSubmitting] = useState<boolean>(false);
  const [modalInitialConfig, setModalInitialConfig] = useState<SimulatorConfig | null>(null);
  const [modalInitialNameOverride, setModalInitialNameOverride] = useState<string | undefined>(undefined);
  const [modalInitialIdOverride, setModalInitialIdOverride] = useState<string | undefined>(undefined);
  const [isModalEditMode, setIsModalEditMode] = useState<boolean>(false);
  const [deleteTargetConfig, setDeleteTargetConfig] = useState<SimulatorConfig | null>(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState<boolean>(false);
  const configs = useMemo(() => [...builtInConfigs, ...customConfigs], [builtInConfigs, customConfigs]);
  const nextCustomTaskNumber = useMemo(() => getNextCustomTaskNumber(configs), [configs]);

  const selectedConfig = configs.find((config) => config.id === selectedConfigId) ?? null;

  const onUploadChange = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await onUploadConfig(file);
    event.target.value = "";
  };

  const onCreateFromEditor = async (config: SimulatorConfig): Promise<void> => {
    setIsTaskEditorSubmitting(true);
    try {
      await onCreateConfig(config);
      setModalInitialConfig(null);
      setModalInitialNameOverride(undefined);
      setModalInitialIdOverride(undefined);
      setIsModalEditMode(false);
      setIsTaskEditorOpen(false);
    } finally {
      setIsTaskEditorSubmitting(false);
    }
  };

  const openCreateModal = (): void => {
    setModalInitialConfig(null);
    setModalInitialNameOverride(undefined);
    setModalInitialIdOverride(undefined);
    setIsModalEditMode(false);
    setIsTaskEditorOpen(true);
  };

  const openEditCustomModal = (config: SimulatorConfig): void => {
    setModalInitialConfig(config);
    setModalInitialNameOverride(undefined);
    setModalInitialIdOverride(undefined);
    setIsModalEditMode(true);
    setIsTaskEditorOpen(true);
  };

  const openDuplicateBuiltInModal = (config: SimulatorConfig): void => {
    const nextNumber = getNextDerivedCustomNumber(configs, config.id);
    setModalInitialConfig(config);
    setModalInitialIdOverride(`${config.id}-custom-${nextNumber}`);
    setModalInitialNameOverride(`${config.name} - Custom ${nextNumber}`);
    setIsModalEditMode(false);
    setIsTaskEditorOpen(true);
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>, id: string): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSelectConfig(id);
  };

  const onConfirmDeleteCustomConfig = async (): Promise<void> => {
    if (!deleteTargetConfig) {
      return;
    }

    setIsDeleteSubmitting(true);
    try {
      await onDeleteCustomConfig(deleteTargetConfig.id);
      setDeleteTargetConfig(null);
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  return (
    <main className="setup-shell">
      <section className="setup-card">
        <div className="setup-header">
          <div className="setup-header-content">
            <h2>Choose A Task</h2>
            <p>
              Pick a pre-defined task or upload a custom task description, then
              continue to source editing.
            </p>
          </div>

          <div className="setup-actions">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading || !selectedConfigId}
            >
              Continue To Editor
            </button>
          </div>
        </div>

        <div className="setup-controls">
          {isLoading && (
            <div className="setup-loading-indicator" role="status" aria-live="polite">
              <span className="setup-loading-spinner" aria-hidden="true" />
              <span>Loading available tasks...</span>
            </div>
          )}

          {selectedConfig && (
            <div className="setup-selection-summary">
              <span className="setup-selection-label">Current Selection</span>
              <strong>{selectedConfig.name}</strong>
            </div>
          )}

          <div className="setup-task-groups">
            <section className="setup-task-group">
              <h3>Built-in Tasks</h3>
              <div className="setup-task-grid" role="list" aria-label="Built-in tasks">
                {builtInConfigs.map((config) => {
                  return (
                    <article
                      key={config.id}
                      className={`task-card ${config.id === selectedConfigId ? "selected" : ""}`}
                      onClick={() => onSelectConfig(config.id)}
                      onKeyDown={(event) => onCardKeyDown(event, config.id)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={config.id === selectedConfigId}
                    >
                      <div className="task-card-header">
                        <div className="task-card-head-content">
                          <div className="task-card-title">{config.name}</div>
                          <div className="task-card-id">{config.id}</div>

                          <div className="task-card-action-group" role="group" aria-label="Task actions">
                            <button
                              type="button"
                              className="task-card-download-button task-card-icon-button"
                              aria-label="Download task JSON"
                              title="Download task JSON"
                              onClick={(event) => {
                                event.stopPropagation();
                                downloadConfigJson(config);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <FontAwesomeIcon icon={faDownload} />
                            </button>
                            <button
                              type="button"
                              className="task-card-duplicate-button task-card-icon-button"
                              aria-label="Duplicate built-in task"
                              title="Duplicate built-in task"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDuplicateBuiltInModal(config);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <FontAwesomeIcon icon={faCopy} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="task-chip-group">
                        <span
                          className="task-chip task-chip-os"
                          title={getFileName(config.os_program_file)}
                          aria-label={`OS: ${getFileName(config.os_program_file)}`}
                        >
                          OS
                        </span>
                        {config.user_programs.map((program, index) => (
                          <span
                            key={`${config.id}-${program.file}-${index}`}
                            className="task-chip"
                            title={getFileName(program.file)}
                            aria-label={`${program.name}: ${getFileName(program.file)}`}
                          >
                            {program.name}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="setup-task-group">
              <h3>Custom Tasks</h3>
              <div className="setup-task-grid" role="list" aria-label="Custom tasks">
                {customConfigs.map((config) => {
                  return (
                    <article
                      key={config.id}
                      className={`task-card ${config.id === selectedConfigId ? "selected" : ""}`}
                      onClick={() => onSelectConfig(config.id)}
                      onKeyDown={(event) => onCardKeyDown(event, config.id)}
                      role="button"
                      tabIndex={0}
                      aria-pressed={config.id === selectedConfigId}
                    >
                      <div className="task-card-header">
                        <div className="task-card-head-content">
                          <div className="task-card-title">{config.name}</div>
                          <div className="task-card-id">{config.id}</div>

                          <div className="task-card-action-group" role="group" aria-label="Task actions">
                            <button
                              type="button"
                              className="task-card-download-button task-card-icon-button"
                              aria-label="Download task JSON"
                              title="Download task JSON"
                              onClick={(event) => {
                                event.stopPropagation();
                                downloadConfigJson(config);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <FontAwesomeIcon icon={faDownload} />
                            </button>
                            <button
                              type="button"
                              className="task-card-edit-button task-card-icon-button"
                              aria-label="Edit custom task"
                              title="Edit custom task"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditCustomModal(config);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <FontAwesomeIcon icon={faPenToSquare} />
                            </button>
                            <button
                              type="button"
                              className="task-card-delete-button task-card-icon-button"
                              aria-label="Delete custom task"
                              title="Delete custom task"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteTargetConfig(config);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="task-chip-group">
                        <span
                          className="task-chip task-chip-os"
                          title={getFileName(config.os_program_file)}
                          aria-label={`OS: ${getFileName(config.os_program_file)}`}
                        >
                          OS
                        </span>
                        {config.user_programs.map((program, index) => (
                          <span
                            key={`${config.id}-${program.file}-${index}`}
                            className="task-chip"
                            title={getFileName(program.file)}
                            aria-label={`${program.name}: ${getFileName(program.file)}`}
                          >
                            {program.name}
                          </span>
                        ))}
                      </div>
                    </article>
                  );
                })}

                <button
                  type="button"
                  className="task-editor-card"
                  onClick={openCreateModal}
                >
                  <span className="task-upload-plus">{`{}`}</span>
                  <span className="task-upload-title">Task Editor</span>
                  <span className="task-upload-copy">Create a custom task</span>
                </button>

                <label className="task-upload-card" htmlFor="setup-config-input">
                  <span className="task-upload-plus">+</span>
                  <span className="task-upload-title">Upload Task</span>
                  <span className="task-upload-copy">Upload a JSON task file</span>
                </label>
              </div>
            </section>
          </div>

          {!isLoading && builtInConfigs.length === 0 && customConfigs.length === 0 && (
            <div className="setup-empty-state">No tasks were found. Upload or create a custom JSON task to continue.</div>
          )}

          
          <input id="setup-config-input" type="file" accept=".json" onChange={onUploadChange} />
        </div>

        <TaskEditorModal
          isOpen={isTaskEditorOpen}
          isSubmitting={isTaskEditorSubmitting}
          defaultId={`custom-task-${nextCustomTaskNumber}`}
          defaultName={`Custom Task ${nextCustomTaskNumber}`}
          initialConfig={modalInitialConfig}
          initialIdOverride={modalInitialIdOverride}
          initialNameOverride={modalInitialNameOverride}
          isEditMode={isModalEditMode}
          onCancel={() => {
            setModalInitialConfig(null);
            setModalInitialNameOverride(undefined);
            setModalInitialIdOverride(undefined);
            setIsModalEditMode(false);
            setIsTaskEditorOpen(false);
          }}
          onSubmit={onCreateFromEditor}
        />

        <DialogModal
          isOpen={Boolean(deleteTargetConfig)}
          title="Delete Custom Task?"
          description={
            deleteTargetConfig
              ? `Delete custom task \"${deleteTargetConfig.name}\"? This action cannot be undone.`
              : undefined
          }
          actions={
            <>
              <button
                type="button"
                onClick={() => setDeleteTargetConfig(null)}
                disabled={isDeleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-discard-button"
                onClick={() => {
                  void onConfirmDeleteCustomConfig();
                }}
                disabled={isDeleteSubmitting}
              >
                {isDeleteSubmitting ? "Deleting..." : "Delete Task"}
              </button>
            </>
          }
        />
      </section>
    </main>
  );
};
