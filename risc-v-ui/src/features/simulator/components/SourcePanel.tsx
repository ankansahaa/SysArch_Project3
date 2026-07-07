import { useEffect, useRef, type ReactElement } from "react";
import { decToHex } from "../../../utils";
import type { CodeProgram } from "../../../types/simulator";

interface SourcePanelProps {
  codePrograms: CodeProgram[];
  activeProgramName: string;
  visibleProgramName: string;
  setVisibleProgramName: (programName: string) => void;
  currentPc: bigint;
}

export const SourcePanel = ({
  codePrograms,
  activeProgramName,
  visibleProgramName,
  setVisibleProgramName,
  currentPc,
}: SourcePanelProps): ReactElement => {
  const tableWrapRef = useRef<HTMLDivElement | null>(null);

  const displayedProgramName =
    codePrograms.find((program) => program.key === visibleProgramName)?.key ?? activeProgramName;

  useEffect(() => {
    if (displayedProgramName === activeProgramName) {
      return;
    }

    if (tableWrapRef.current) {
      tableWrapRef.current.scrollTop = 0;
    }
  }, [activeProgramName, displayedProgramName]);

  return (
    <section className="source-panel">
      <div className="source-tabs">
        {codePrograms.map((program) => (
          <button
            key={program.key}
            type="button"
            className={program.key === displayedProgramName ? "active" : ""}
            onClick={() => setVisibleProgramName(program.key)}
          >
            {program.key === activeProgramName ? "[run] " : ""}
            {program.label}
          </button>
        ))}
      </div>

      <div ref={tableWrapRef} className="source-table-wrap">
        <table className="source-table">
          <thead>
            <tr>
              <th>Address</th>
              <th>Label</th>
              <th>Instruction</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(codePrograms.find((p) => p.key === displayedProgramName)?.data?.instructions ?? {}).map(([address, [instruction, assembly, labels]]) => {
              const uiAddress = decToHex(BigInt(address));
              const isCurrent = currentPc === BigInt(address);
              return (
                <tr key={address} className={isCurrent ? "current-line" : ""}>
                  <td id={`${uiAddress}-address`} className="code-cell">
                    {uiAddress}
                  </td>
                  <td id={`${uiAddress}-label`} className="code-cell">
                    {labels.join(", ")}
                  </td>
                  <td id={`${uiAddress}-instruction`} className="code-cell">
                    {decToHex(instruction)}
                    {` ${assembly}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
