import type { ReactElement } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFloppyDisk, faUndo } from "@fortawesome/free-solid-svg-icons";

interface EditorToolbarProps {
  hasUnsavedChanges: boolean;
  isLoading: boolean;
  onSave: () => Promise<void>;
  onRevert: () => void;
}

export const EditorToolbar = ({
  hasUnsavedChanges,
  isLoading,
  onSave,
  onRevert,
}: EditorToolbarProps): ReactElement => {
  return (
    <div className="editor-toolbar">
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={isLoading || !hasUnsavedChanges}
        title="Save current file"
      >
        <FontAwesomeIcon icon={faFloppyDisk} /> Save
      </button>
      <button
        type="button"
        onClick={onRevert}
        disabled={isLoading || !hasUnsavedChanges}
        title="Revert current file to last saved state"
      >
        <FontAwesomeIcon icon={faUndo} /> Revert
      </button>
    </div>
  );
};
