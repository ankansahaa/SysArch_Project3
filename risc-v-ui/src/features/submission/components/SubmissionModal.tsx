import { useEffect, useState, type ReactElement } from "react";
import Editor from "@monaco-editor/react";
import { DialogModal } from "../../../components/DialogModal";

interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFetchContributions: () => Promise<string>;
  onSaveContributions: (content: string) => Promise<void>;
  onDownloadSubmission: () => Promise<void>;
}

export const SubmissionModal = ({
  isOpen,
  onClose,
  onFetchContributions,
  onSaveContributions,
  onDownloadSubmission,
}: SubmissionModalProps): ReactElement | null => {
  const [content, setContent] = useState<string>("");
  const [savedContent, setSavedContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCurrent = true;
    setIsLoading(true);
    setErrorMessage("");

    onFetchContributions()
      .then((nextContent) => {
        if (!isCurrent) {
          return;
        }
        setContent(nextContent);
        setSavedContent(nextContent);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load contributions.md");
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, onFetchContributions]);

  if (!isOpen) {
    return null;
  }

  const hasUnsavedChanges = content !== savedContent;

  const save = async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      await onSaveContributions(content);
      setSavedContent(content);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save contributions.md");
    } finally {
      setIsLoading(false);
    }
  };

  const download = async (): Promise<void> => {
    setIsDownloading(true);
    setErrorMessage("");
    try {
      if (hasUnsavedChanges) {
        await onSaveContributions(content);
        setSavedContent(content);
      }
      await onDownloadSubmission();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to download submission");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <DialogModal
      isOpen={isOpen}
      title="Download Submission"
      description="Edit contributions.md before packaging your submission."
      cardClassName="submission-modal"
      actions={
        <>
          <button type="button" onClick={onClose} disabled={isLoading || isDownloading}>
            Close
          </button>
          <button type="button" onClick={() => void save()} disabled={isLoading || isDownloading || !hasUnsavedChanges}>
            {isLoading ? "Saving..." : "Save"}
          </button>
          <button type="button" className="modal-save-button" onClick={() => void download()} disabled={isLoading || isDownloading}>
            {isDownloading ? "Downloading..." : "Download zip"}
          </button>
        </>
      }
    >
      <div className="submission-editor-shell">
        {isLoading && !content ? (
          <div className="empty-state editor-empty">Loading contributions.md...</div>
        ) : (
          <Editor
            height="100%"
            defaultLanguage="markdown"
            language="markdown"
            theme="vs"
            value={content}
            onChange={(value) => setContent(value ?? "")}
            options={{
              minimap: { enabled: false },
              fontFamily: "IBM Plex Mono, Fira Code, JetBrains Mono, monospace",
              fontSize: 13,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
            }}
          />
        )}
      </div>
      {errorMessage && <div className="task-editor-error">{errorMessage}</div>}
    </DialogModal>
  );
};
