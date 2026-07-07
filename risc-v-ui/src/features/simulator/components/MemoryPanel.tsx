import type { ReactElement } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { decToHex } from "../../../utils";
import type { MemoryPreset, SimulationControls } from "../../../types/simulator";

interface MemoryPanelProps {
  memory: Record<string, bigint>;
  memoryBaseAddress: number;
  memoryBasePresets: MemoryPreset[];
  customBaseInput: string;
  setCustomBaseInput: (input: string) => void;
  controls: SimulationControls;
}

export const MemoryPanel = ({
  memory,
  memoryBaseAddress,
  memoryBasePresets,
  customBaseInput,
  setCustomBaseInput,
  controls,
}: MemoryPanelProps): ReactElement => {
  return (
    <article className="memory-panel">
      <div className="panel-header">
        <h3>Memory</h3>
        <div className="memory-controls">
          <button type="button" onClick={controls.stepMemBack}>
            <FontAwesomeIcon icon={faChevronLeft} />
          </button>
          <span>{decToHex(memoryBaseAddress)}</span>
          <button type="button" onClick={controls.stepMemForward}>
            <FontAwesomeIcon icon={faChevronRight} />
          </button>
        </div>
      </div>

      <div className="memory-presets">
        {memoryBasePresets.map((preset) => (
          <button key={preset.label} type="button" onClick={() => controls.storeBase(preset.value)}>
            {preset.label}
          </button>
        ))}
        <input
          id="custom-base-input"
          type="text"
          placeholder="Enter address"
          value={customBaseInput}
          onChange={(event) => setCustomBaseInput(event.target.value)}
        />
        <button type="button" onClick={controls.storeCustomBase}>
          Go
        </button>
      </div>

      <div className="memory-table-wrap">
        <table className="memory-table">
          <thead>
            <tr>
              <th>Address</th>
              <th>+0x0</th>
              <th>+0x4</th>
              <th>+0x8</th>
              <th>+0xC</th>
              <th>+0x10</th>
              <th>+0x14</th>
              <th>+0x18</th>
              <th>+0x1C</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, rowIndex) => {
              const rowBase = memoryBaseAddress + rowIndex * 32;
              return (
                <tr key={rowBase}>
                  <td>{decToHex(rowBase)}</td>
                  {Array.from({ length: 8 }).map((__, colIndex) => {
                    const address = rowBase + colIndex * 4;
                    const value = memory[String(address)] ?? 0n;
                    return <td key={address}>{decToHex(value)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
};
