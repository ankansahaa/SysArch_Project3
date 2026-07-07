import { useEffect, useState, type ReactElement } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStepBackward, faBackward, faForward, faStepForward } from "@fortawesome/free-solid-svg-icons";
import type { SimulationControls } from "../../../types/simulator";

interface SimulatorRightToolbarProps {
  currentStateNumber: number;
  totalStateCount: number;
  controls: SimulationControls;
  suspended: boolean;
}

export const SimulatorRightToolbar = ({
  currentStateNumber,
  totalStateCount,
  controls,
  suspended,
}: SimulatorRightToolbarProps): ReactElement => {
  const [jumpStateInput, setJumpStateInput] = useState<string>(
    String(currentStateNumber || 1)
  );
  const hasStates = totalStateCount > 0;
  const isAtStart = !hasStates || currentStateNumber <= 1;
  const isAtEnd = !hasStates || currentStateNumber >= totalStateCount;

  useEffect(() => {
    setJumpStateInput(String(currentStateNumber || 1));
  }, [currentStateNumber]);

  const handleJump = (): void => {
    const requestedState = Number(jumpStateInput);
    if (!Number.isFinite(requestedState)) {
      setJumpStateInput(String(currentStateNumber || 1));
      return;
    }

    controls.jumpToState(requestedState);
  };

  return (
    <div className="toolbar-group playback-controls">
      <button
        type="button"
        onClick={controls.stepToStart}
        title="Go to first state"
        disabled={isAtStart || suspended}
      >
        <FontAwesomeIcon icon={faStepBackward} />
      </button>
      <button
        type="button"
        onClick={controls.stepBack}
        title="Previous state"
        disabled={isAtStart || suspended}
      >
        <FontAwesomeIcon icon={faBackward} />
      </button>

      <label className="counter state-jump-inline">
        <input
          id="jump-state-input"
          type="number"
          min={1}
          max={Math.max(1, totalStateCount)}
          value={jumpStateInput}
          onChange={(event) => setJumpStateInput(event.target.value)}
          onBlur={handleJump}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleJump();
            }
          }}
          disabled={!hasStates || suspended}
        />
        <span>/{Math.max(1, totalStateCount)}</span>
      </label>

      <button
        type="button"
        onClick={controls.stepForward}
        title="Next state"
        disabled={isAtEnd || suspended}
      >
        <FontAwesomeIcon icon={faForward} />
      </button>
      <button
        type="button"
        onClick={controls.stepToEnd}
        title="Go to latest state"
        disabled={isAtEnd || suspended}
      >
        <FontAwesomeIcon icon={faStepForward} />
      </button>
    </div>
  );
};
