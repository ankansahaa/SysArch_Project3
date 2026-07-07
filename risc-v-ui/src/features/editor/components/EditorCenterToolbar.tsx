import type { ReactElement } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFloppyDisk, faPlay } from "@fortawesome/free-solid-svg-icons";

interface EditorCenterToolbarProps {
  hasAnyUnsavedChanges: boolean;
  isLoading: boolean;
  onStartSimulation: () => Promise<void>;
}

export const EditorCenterToolbar = ({
  hasAnyUnsavedChanges,
  isLoading,
  onStartSimulation,
}: EditorCenterToolbarProps): ReactElement => {
  return (
    <button
      type="button"
      className="start-sim-button"
      onClick={() => void onStartSimulation()}
      disabled={isLoading}
    >
      {hasAnyUnsavedChanges
        ? <><FontAwesomeIcon icon={faFloppyDisk} /> Save all & start simulation</>
        : <><FontAwesomeIcon icon={faPlay} /> Start simulation</>}
    </button>
  );
};
