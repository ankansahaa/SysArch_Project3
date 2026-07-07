import { useMemo, useState, type ReactElement } from "react";

interface IoPanelProps {
  keyboardEnabled: boolean;
  setKeyboardEnabled: (enabled: boolean) => void;
  terminalInput: string;
  outputTab: "terminal" | "display";
  setOutputTab: (tab: "terminal" | "display") => void;
  terminalOutput: string;
  displayPixels: string[];
}

export const IoPanel = ({
  keyboardEnabled,
  setKeyboardEnabled,
  terminalInput,
  outputTab,
  setOutputTab,
  terminalOutput,
  displayPixels,
}: IoPanelProps): ReactElement => {
  const [ioTab, setIoTab] = useState<"input" | "output">("output");

  const lastKeyLabel = useMemo(() => {
    if (!terminalInput.length) {
      return "None";
    }

    const lastKey = terminalInput[terminalInput.length - 1];
    return lastKey === " " ? "Space" : lastKey;
  }, [terminalInput]);

  return (
    <article className="io-panel">
      <div className="io-tabs">
        <button
          type="button"
          className={ioTab === "input" ? "active" : ""}
          onClick={() => setIoTab("input")}
        >
          Input
        </button>
        <button
          type="button"
          className={ioTab === "output" ? "active" : ""}
          onClick={() => setIoTab("output")}
        >
          Output
        </button>
      </div>

      {ioTab === "input" && (
        <div className="io-tab-content">
          <button type="button" onClick={() => setKeyboardEnabled(!keyboardEnabled)}>
            {keyboardEnabled ? "Disable Keyboard" : "Enable Keyboard"}
          </button>

          {keyboardEnabled && <p className="keyboard-capture-note">Keystrokes are now captured.</p>}

          <div className="keycap-row">
            <span>Last key:</span>
            <span className="keycap" aria-live="polite">
              {lastKeyLabel}
            </span>
          </div>

          <div>
            <h4>History</h4>
            <pre className="input-history-block">{terminalInput || "No input yet."}</pre>
          </div>
        </div>
      )}

      {ioTab === "output" && (
        <div className="io-tab-content">
          <div className="output-tabs">
            <button
              type="button"
              className={outputTab === "terminal" ? "active" : ""}
              onClick={() => setOutputTab("terminal")}
            >
              Terminal
            </button>
            <button
              type="button"
              className={outputTab === "display" ? "active" : ""}
              onClick={() => setOutputTab("display")}
            >
              Display
            </button>
          </div>

          {outputTab === "terminal" && (
            <div>
              <h4>Terminal Output</h4>
              <pre className="terminal-block terminal-output-block">{terminalOutput}</pre>
            </div>
          )}

          {outputTab === "display" && (
            <div className="display-grid">
              {displayPixels.map((color, index) => (
                <div key={index} className="pixel" style={{ backgroundColor: color }} />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};
