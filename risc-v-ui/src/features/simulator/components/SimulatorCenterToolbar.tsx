import { useEffect, useState, type ReactElement } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateLeft, faPlay, faForward } from "@fortawesome/free-solid-svg-icons";
import type { SimulationControls } from "../../../types/simulator";

interface SimulatorCenterToolbarProps {
  cycles: number;
  delay: number;
  suspended: boolean;
  setCycles: (cycles: number) => void;
  setDelay: (delay: number) => void;
  controls: SimulationControls;
}

export const SimulatorCenterToolbar = ({
  cycles,
  delay,
  setCycles,
  setDelay,
  suspended,
  controls,
}: SimulatorCenterToolbarProps): ReactElement => {
  const [runCyclesInput, setRunCyclesInput] = useState<string>(String(cycles));
  const [runDelayInput, setRunDelayInput] = useState<string>(String(delay));

  useEffect(() => {
    setRunCyclesInput(String(cycles));
  }, [cycles]);

  useEffect(() => {
    setRunDelayInput(String(delay));
  }, [delay]);

  const parseCycles = (value: string): number => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(1, parsed) : 1;
  };

  const parseDelay = (value: string): number => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  };

  const syncRunInputsToUI = (): { cycles: number; delay: number } => {
    const nextCycles = parseCycles(runCyclesInput);
    const nextDelay = parseDelay(runDelayInput);

    setCycles(nextCycles);
    setDelay(nextDelay);
    setRunCyclesInput(String(nextCycles));
    setRunDelayInput(String(nextDelay));

    return {
      cycles: nextCycles,
      delay: nextDelay,
    };
  };

  return (
    <div className="toolbar-group run-controls">
      <button type="button" onClick={controls.restart}>
        <FontAwesomeIcon icon={faRotateLeft} /> Restart
      </button>
      {suspended ? (
         <button type="button" onClick={controls.resume}>
          <FontAwesomeIcon icon={faPlay} /> Resume
        </button>
      ) : (
        <>
          <button type="button" onClick={() => void controls.step()}>
            <FontAwesomeIcon icon={faPlay} /> Step
          </button>
          <button
            type="button"
            className="run-sentence-button"
            onClick={() => {
              const params = syncRunInputsToUI();
              void controls.run(params);
            }}
          >
            <span><FontAwesomeIcon icon={faForward} /> Run for</span>
            <input
              id="cycle-input"
              type="text"
              inputMode="numeric"
              value={runCyclesInput}
              onChange={(event) => setRunCyclesInput(event.target.value)}
              onBlur={syncRunInputsToUI}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const params = syncRunInputsToUI();
                  void controls.run(params);
                }
              }}
              onClick={(event) => event.stopPropagation()}
            />
            <span>cycles (</span>
            <input
              id="delay-input"
              type="text"
              inputMode="numeric"
              value={runDelayInput}
              onChange={(event) => setRunDelayInput(event.target.value)}
              onBlur={syncRunInputsToUI}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const params = syncRunInputsToUI();
                  void controls.run(params);
                }
              }}
              onClick={(event) => event.stopPropagation()}
            />
            <span>ms delay)</span>
          </button>
        </>
      )}
    </div>
  );
};
