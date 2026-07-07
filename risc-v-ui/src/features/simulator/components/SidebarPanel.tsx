import type { ReactElement } from "react";
import { csrAddressToName, decToHex, decToHexLength, registerNameFromNumber } from "../../../utils";

interface SidebarPanelProps {
  tab: "registers" | "csrs";
  setTab: (tab: "registers" | "csrs") => void;
  registers: Record<number, bigint>;
  csrs: Record<number, bigint>;
}

export const SidebarPanel = ({
  tab,
  setTab,
  registers,
  csrs,
}: SidebarPanelProps): ReactElement => {
  return (
    <aside className="sidebar-panel">
      <div className="sidebar-tabs">
        <button
          type="button"
          className={tab === "registers" ? "active" : ""}
          onClick={() => setTab("registers")}
        >
          Registers
        </button>
        <button type="button" className={tab === "csrs" ? "active" : ""} onClick={() => setTab("csrs")}>
          CSR
        </button>
      </div>

      {tab === "registers" && (
        <div className="sidebar-table-wrap">
          <table className="value-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Number</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(registers).map(([number, value]) => (
                <tr key={String(number)}>
                  <td>{registerNameFromNumber(Number(number))}</td>
                  <td>x{number}</td>
                  <td>{decToHex(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "csrs" && (
        <div className="sidebar-table-wrap">
          <table className="value-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(csrs)
                .filter(([address, _]) => csrAddressToName(Number(address)))
                .map(([address, value]) => (
                  <tr key={address}>
                    <td>{csrAddressToName(Number(address))}</td>
                    <td>{decToHexLength(BigInt(address), 3)}</td>
                    <td>{decToHex(value)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </aside>
  );
};
