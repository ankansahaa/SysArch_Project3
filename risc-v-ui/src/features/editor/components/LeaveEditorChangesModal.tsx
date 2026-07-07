import type { ReactElement } from "react";
import { DialogModal } from "../../../components/DialogModal";

interface LeaveEditorChangesModalProps {
  isOpen: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

export const LeaveEditorChangesModal = ({
  isOpen,
  isSaving,
  onCancel,
  onDiscard,
  onSave,
}: LeaveEditorChangesModalProps): ReactElement | null => {
  return (
    <DialogModal
      isOpen={isOpen}
      title="Leave Editor With Unsaved Changes?"
      description={
        "You have unsaved source changes. Save before returning to config selection, or continue and lose those edits."
      }
      actions={
        <>
          <button type="button" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className="modal-discard-button" onClick={onDiscard} disabled={isSaving}>
            Discard Changes
          </button>
          <button type="button" className="modal-save-button" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save and Leave"}
          </button>
        </>
      }
    />
  );
};
