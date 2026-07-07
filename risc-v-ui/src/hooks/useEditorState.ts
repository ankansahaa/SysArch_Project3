import { useEffect, useMemo, useState } from "react";
import { SourceFileFetchError, type createSimulatorApi } from "../services/api";
import type { AppView } from "../types/app";
import type { SimulatorConfig, SourceFileEntry } from "../types/simulator";
import { extractSourceFiles, findUnsupportedDirectives } from "../utils";

const UNSUPPORTED_DIRECTIVES_WARNING =
  "Directives other than .text are not supported. Initial memory contents can only be provided in the task configuration.";

interface UseEditorStateParams {
  api: ReturnType<typeof createSimulatorApi>;
  appView: AppView;
  selectedConfigId: string;
  activeConfig: SimulatorConfig | undefined;
  showError: (message: string) => void;
}

interface EditorState {
  sourceFiles: SourceFileEntry[];
  selectedSourceFileId: string;
  selectedSourceContent: string;
  isEditorLoading: boolean;
  hasUnsavedSourceChanges: boolean;
  dirtyFileIds: string[];
  hasAnyUnsavedSourceChanges: boolean;
  unsupportedDirectiveWarning: string;
  setSelectedSourceFileId: (id: string) => void;
  setSelectedSourceContent: (content: string) => void;
  saveCurrentSourceFile: () => Promise<void>;
  saveDirtyFiles: () => Promise<void>;
  discardAllSourceChanges: () => void;
  revertCurrentSourceFile: () => void;
}

const isMissingSourceFileError = (error: unknown): boolean => {
  if (!(error instanceof SourceFileFetchError)) {
    return false;
  }

  if (error.status === 404) {
    return true;
  }

  return /not found|no such file|does not exist|cannot find/i.test(error.details);
};

export const useEditorState = ({
  api,
  appView,
  selectedConfigId,
  activeConfig,
  showError,
}: UseEditorStateParams): EditorState => {
  const [selectedSourceFileId, setSelectedSourceFileId] = useState<string>("");
  const [sourceFileContents, setSourceFileContents] = useState<Record<string, string>>({});
  const [savedSourceFileContents, setSavedSourceFileContents] = useState<Record<string, string>>({});
  const [isEditorLoading, setIsEditorLoading] = useState<boolean>(false);

  const sourceFiles = useMemo(
    (): SourceFileEntry[] => extractSourceFiles(activeConfig),
    [activeConfig]
  );

  const selectedSourceFile = useMemo(
    () => sourceFiles.find((file) => file.id === selectedSourceFileId) ?? null,
    [sourceFiles, selectedSourceFileId]
  );

  const selectedSourceContent = useMemo(() => {
    if (!selectedSourceFile) {
      return "";
    }

    return sourceFileContents[selectedSourceFile.id] ?? "";
  }, [sourceFileContents, selectedSourceFile]);

  const hasUnsavedSourceChanges = useMemo(() => {
    if (!selectedSourceFile) {
      return false;
    }

    const current = sourceFileContents[selectedSourceFile.id] ?? "";
    const saved = savedSourceFileContents[selectedSourceFile.id] ?? "";
    return current !== saved;
  }, [sourceFileContents, savedSourceFileContents, selectedSourceFile]);

  const dirtyFileIds = useMemo(
    () =>
      sourceFiles
        .filter((file) => (sourceFileContents[file.id] ?? "") !== (savedSourceFileContents[file.id] ?? ""))
        .map((file) => file.id),
    [sourceFiles, sourceFileContents, savedSourceFileContents]
  );

  const unsupportedDirectiveWarning = useMemo(() => {
    for (const file of sourceFiles) {
      if (!/\.(s|asm)$/i.test(file.path)) {
        continue;
      }

      const content = sourceFileContents[file.id] ?? "";
      if (findUnsupportedDirectives(content).length > 0) {
        return UNSUPPORTED_DIRECTIVES_WARNING;
      }
    }

    return "";
  }, [sourceFileContents, sourceFiles]);

  useEffect(() => {
    if (!sourceFiles.length) {
      if (selectedSourceFileId) {
        setSelectedSourceFileId("");
      }
      return;
    }

    const exists = sourceFiles.some((file) => file.id === selectedSourceFileId);
    if (!exists) {
      setSelectedSourceFileId(sourceFiles[0].id);
    }
  }, [selectedSourceFileId, sourceFiles]);

  useEffect(() => {
    setSourceFileContents({});
    setSavedSourceFileContents({});
  }, [selectedConfigId]);

  useEffect(() => {
    const loadSourceFiles = async (): Promise<void> => {
      if (appView !== "editor" || !activeConfig || !sourceFiles.length) {
        return;
      }

      setIsEditorLoading(true);
      try {
        const loadedEntries = await Promise.all(
          sourceFiles.map(async (file) => {
            try {
              const content = await api.fetchSourceFile(file.path);
              return [file.id, content] as const;
            } catch (error) {
              if (isMissingSourceFileError(error)) {
                return [file.id, ""] as const;
              }

              throw error;
            }
          })
        );

        const loaded = loadedEntries.reduce<Record<string, string>>((acc, [id, content]) => {
          acc[id] = content;
          return acc;
        }, {});

        setSourceFileContents(loaded);
        setSavedSourceFileContents(loaded);
      } catch {
        showError("Failed to fetch one or more source files.");
      } finally {
        setIsEditorLoading(false);
      }
    };

    void loadSourceFiles();
  }, [activeConfig, api, appView, showError, sourceFiles]);

  const setSelectedSourceContent = (content: string): void => {
    if (!selectedSourceFile) {
      return;
    }

    setSourceFileContents((prev) => ({
      ...prev,
      [selectedSourceFile.id]: content,
    }));
  };

  const saveCurrentSourceFile = async (): Promise<void> => {
    if (!selectedSourceFile) {
      return;
    }

    const fileId = selectedSourceFile.id;
    const current = sourceFileContents[fileId] ?? "";
    const saved = savedSourceFileContents[fileId] ?? "";
    if (current === saved) {
      return;
    }

    await api.saveSourceFile(selectedSourceFile.path, current);
    setSavedSourceFileContents((prev) => ({
      ...prev,
      [fileId]: current,
    }));
  };

  const saveDirtyFiles = async (): Promise<void> => {
    if (dirtyFileIds.length === 0) {
      return;
    }

    await Promise.all(
      dirtyFileIds.map((fileId) => {
        const file = sourceFiles.find((entry) => entry.id === fileId);
        if (!file) {
          return Promise.resolve();
        }

        return api.saveSourceFile(file.path, sourceFileContents[fileId] ?? "");
      })
    );

    setSavedSourceFileContents((prev) => {
      const next = { ...prev };
      dirtyFileIds.forEach((fileId) => {
        next[fileId] = sourceFileContents[fileId] ?? "";
      });
      return next;
    });
  };

  const revertCurrentSourceFile = (): void => {
    if (!selectedSourceFile) {
      return;
    }

    setSourceFileContents((prev) => ({
      ...prev,
      [selectedSourceFile.id]: savedSourceFileContents[selectedSourceFile.id] ?? "",
    }));
  };

  const discardAllSourceChanges = (): void => {
    if (dirtyFileIds.length === 0) {
      return;
    }

    setSourceFileContents((prev) => {
      const next = { ...prev };
      dirtyFileIds.forEach((fileId) => {
        next[fileId] = savedSourceFileContents[fileId] ?? "";
      });
      return next;
    });
  };

  return {
    sourceFiles,
    selectedSourceFileId,
    selectedSourceContent,
    isEditorLoading,
    hasUnsavedSourceChanges,
    dirtyFileIds,
    hasAnyUnsavedSourceChanges: dirtyFileIds.length > 0,
    unsupportedDirectiveWarning,
    setSelectedSourceFileId,
    setSelectedSourceContent,
    saveCurrentSourceFile,
    saveDirtyFiles,
    discardAllSourceChanges,
    revertCurrentSourceFile,
  };
};
