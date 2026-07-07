import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";
import type { SimulatorConfig, SimulatorMemoryMappedRegisters, SimulatorUserProgram } from "../../../types/simulator";

interface TaskEditorModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  defaultName: string;
  defaultId: string;
  initialConfig: SimulatorConfig | null;
  initialNameOverride?: string;
  initialIdOverride?: string;
  isEditMode?: boolean;
  onCancel: () => void;
  onSubmit: (config: SimulatorConfig) => Promise<void>;
}

interface InitialMemoryEntry {
  id: string;
  address: string;
  value: string;
}

interface MmrPreset {
  id: string;
  label: string;
  values: SimulatorMemoryMappedRegisters;
}

const CUSTOM_MMR_PRESET_ID = "custom";

const MMR_PRESETS: MmrPreset[] = [
  {
    id: "default-mmio",
    label: "Default MMIO Layout",
    values: {
      mtime: "0xffff0018",
      mtimeh: "0xffff001c",
      mtimecmp: "0xffff0020",
      mtimecmph: "0xffff0024",
      keyboard_ready: "0xffff0000",
      keyboard_data: "0xffff0004",
      terminal_ready: "0xffff0008",
      terminal_data: "0xffff000c",
      display: "0xffff1000",
    },
  },
  {
    id: CUSTOM_MMR_PRESET_ID,
    label: "Custom",
    values: {
      mtime: "0xffff0018",
      mtimeh: "0xffff001c",
      mtimecmp: "0xffff0020",
      mtimecmph: "0xffff0024",
      keyboard_ready: "0xffff0000",
      keyboard_data: "0xffff0004",
      terminal_ready: "0xffff0008",
      terminal_data: "0xffff000c",
      display: "0xffff1000",
    },
  },
];

const createUserProgram = (): SimulatorUserProgram => ({
  address: "0x00002000",
  name: "user",
  file: "program.s",
});

const createMemoryEntry = (): InitialMemoryEntry => ({
  id: crypto.randomUUID(),
  address: "0x00000000",
  value: "0x00000000",
});

const mapInitialMemoryEntries = (memory: Record<string, string>): InitialMemoryEntry[] =>
  Object.entries(memory)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([address, value]) => ({
      id: crypto.randomUUID(),
      address,
      value,
    }));

const isSameMmrLayout = (
  left: SimulatorMemoryMappedRegisters,
  right: SimulatorMemoryMappedRegisters
): boolean =>
  left.mtime === right.mtime &&
  left.mtimeh === right.mtimeh &&
  left.mtimecmp === right.mtimecmp &&
  left.mtimecmph === right.mtimecmph &&
  left.keyboard_ready === right.keyboard_ready &&
  left.keyboard_data === right.keyboard_data &&
  left.terminal_ready === right.terminal_ready &&
  left.terminal_data === right.terminal_data &&
  left.display === right.display;

export const TaskEditorModal = ({
  isOpen,
  isSubmitting,
  defaultName,
  defaultId,
  initialConfig,
  initialNameOverride,
  initialIdOverride,
  isEditMode = false,
  onCancel,
  onSubmit,
}: TaskEditorModalProps): ReactElement | null => {
  const [name, setName] = useState<string>(defaultName);
  const [id, setId] = useState<string>(defaultId);
  const [initialPc, setInitialPc] = useState<string>("0x80000000");
  const [osProgramFile, setOsProgramFile] = useState<string>("os.s");
  const [terminalDelay, setTerminalDelay] = useState<string>("0");
  const [mmrPresetId, setMmrPresetId] = useState<string>(MMR_PRESETS[0].id);
  const [memoryMappedRegisters, setMemoryMappedRegisters] =
    useState<SimulatorMemoryMappedRegisters>(MMR_PRESETS[0].values);
  const [userPrograms, setUserPrograms] = useState<SimulatorUserProgram[]>([]);
  const [initialMemoryEntries, setInitialMemoryEntries] = useState<InitialMemoryEntry[]>([]);
  const [submitError, setSubmitError] = useState<string>("");

  const mmrFields = useMemo(
    () =>
      [
        "mtime",
        "mtimeh",
        "mtimecmp",
        "mtimecmph",
        "keyboard_ready",
        "keyboard_data",
        "terminal_ready",
        "terminal_data",
        "display",
      ] as const,
    []
  );

  const duplicateProgramAddresses = useMemo((): Set<string> => {
    const counts = new Map<string, number>();
    userPrograms.forEach((program) => {
      const normalized = program.address.trim().toLowerCase();
      if (!normalized) {
        return;
      }

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });

    const duplicates = new Set<string>();
    counts.forEach((count, key) => {
      if (count > 1) {
        duplicates.add(key);
      }
    });

    return duplicates;
  }, [userPrograms]);

  const duplicateProgramNames = useMemo((): Set<string> => {
    const counts = new Map<string, number>();
    userPrograms.forEach((program) => {
      const normalized = program.name.trim().toLowerCase();
      if (!normalized) {
        return;
      }

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });

    const duplicates = new Set<string>();
    counts.forEach((count, key) => {
      if (count > 1) {
        duplicates.add(key);
      }
    });

    return duplicates;
  }, [userPrograms]);

  const duplicateMemoryAddresses = useMemo((): Set<string> => {
    const counts = new Map<string, number>();
    initialMemoryEntries.forEach((entry) => {
      const normalized = entry.address.trim().toLowerCase();
      if (!normalized) {
        return;
      }

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });

    const duplicates = new Set<string>();
    counts.forEach((count, key) => {
      if (count > 1) {
        duplicates.add(key);
      }
    });

    return duplicates;
  }, [initialMemoryEntries]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialConfig) {
      const defaultPreset = MMR_PRESETS.find((preset) => preset.id === "default-mmio");
      const useDefaultPreset =
        defaultPreset && isSameMmrLayout(initialConfig.memory_mapped_registers, defaultPreset.values);

      setName(initialNameOverride ?? initialConfig.name);
      setId(initialIdOverride ?? initialConfig.id);
      setInitialPc(initialConfig.initial_pc);
      setOsProgramFile(initialConfig.os_program_file);
      setTerminalDelay(initialConfig.terminal_delay);
      setMmrPresetId(useDefaultPreset ? "default-mmio" : CUSTOM_MMR_PRESET_ID);
      setMemoryMappedRegisters(initialConfig.memory_mapped_registers);
      setUserPrograms(initialConfig.user_programs);
      setInitialMemoryEntries(mapInitialMemoryEntries(initialConfig.initial_memory));
      setSubmitError("");
      return;
    }

    setName(defaultName);
    setId(defaultId);
    setInitialPc("0x80000000");
    setOsProgramFile("os.s");
    setTerminalDelay("0");
    setMmrPresetId(MMR_PRESETS[0].id);
    setMemoryMappedRegisters(MMR_PRESETS[0].values);
    setUserPrograms([]);
    setInitialMemoryEntries([]);
    setSubmitError("");
  }, [defaultId, defaultName, initialConfig, initialIdOverride, initialNameOverride, isOpen]);

  if (!isOpen) {
    return null;
  }

  const setMmrValue = (key: keyof SimulatorMemoryMappedRegisters, value: string): void => {
    setMemoryMappedRegisters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const onPresetChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const selected = event.target.value;
    setMmrPresetId(selected);

    if (selected === CUSTOM_MMR_PRESET_ID) {
      return;
    }

    const preset = MMR_PRESETS.find((item) => item.id === selected);
    if (!preset) {
      return;
    }

    setMemoryMappedRegisters(preset.values);
  };

  const setProgramValue = (index: number, key: keyof SimulatorUserProgram, value: string): void => {
    setUserPrograms((prev) =>
      prev.map((program, currentIndex) => {
        if (index !== currentIndex) {
          return program;
        }

        return {
          ...program,
          [key]: value,
        };
      })
    );
  };

  const addProgram = (): void => {
    setUserPrograms((prev) => [...prev, createUserProgram()]);
  };

  const removeProgram = (index: number): void => {
    setUserPrograms((prev) => prev.filter((_, currentIndex) => index !== currentIndex));
  };

  const setInitialMemoryValue = (entryId: string, key: "address" | "value", value: string): void => {
    setInitialMemoryEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) {
          return entry;
        }

        return {
          ...entry,
          [key]: value,
        };
      })
    );
  };

  const addInitialMemoryEntry = (): void => {
    setInitialMemoryEntries((prev) => [...prev, createMemoryEntry()]);
  };

  const removeInitialMemoryEntry = (entryId: string): void => {
    setInitialMemoryEntries((prev) => prev.filter((entry) => entry.id !== entryId));
  };

  const handleSubmit = async (): Promise<void> => {
    setSubmitError("");

    const hasDuplicateProgramAddress = duplicateProgramAddresses.size > 0;
    if (hasDuplicateProgramAddress) {
      setSubmitError("User program addresses must be unique.");
      return;
    }

    const hasDuplicateProgramName = duplicateProgramNames.size > 0;
    if (hasDuplicateProgramName) {
      setSubmitError("User program names must be unique.");
      return;
    }

    const hasDuplicateMemoryAddress = duplicateMemoryAddresses.size > 0;
    if (hasDuplicateMemoryAddress) {
      setSubmitError("Initial memory addresses must be unique.");
      return;
    }

    const initialMemory = initialMemoryEntries.reduce<Record<string, string>>((acc, entry) => {
      if (!entry.address.trim() || !entry.value.trim()) {
        return acc;
      }

      acc[entry.address.trim()] = entry.value.trim();
      return acc;
    }, {});

    const config: SimulatorConfig = {
      name: name.trim(),
      id: id.trim(),
      initial_pc: initialPc.trim(),
      os_program_file: osProgramFile.trim(),
      terminal_delay: terminalDelay.trim(),
      memory_mapped_registers: {
        mtime: memoryMappedRegisters.mtime.trim(),
        mtimeh: memoryMappedRegisters.mtimeh.trim(),
        mtimecmp: memoryMappedRegisters.mtimecmp.trim(),
        mtimecmph: memoryMappedRegisters.mtimecmph.trim(),
        keyboard_ready: memoryMappedRegisters.keyboard_ready.trim(),
        keyboard_data: memoryMappedRegisters.keyboard_data.trim(),
        terminal_ready: memoryMappedRegisters.terminal_ready.trim(),
        terminal_data: memoryMappedRegisters.terminal_data.trim(),
        display: memoryMappedRegisters.display.trim(),
      },
      user_programs: userPrograms.map((program) => ({
        address: program.address.trim(),
        name: program.name.trim(),
        file: program.file.trim(),
      })),
      initial_memory: initialMemory,
    };

    try {
      await onSubmit(config);
      setSubmitError("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create task");
    }
  };

  return (
    <div className="modal-overlay" role="presentation">
      <div className="modal-card task-editor-modal" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <h2 id="task-editor-title">Task Editor</h2>
        <p>Build a task configuration and add it to the task list.</p>

        <div className="task-editor-form">
          <label>
            Name
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Example Task" />
          </label>

          <label>
            Id
            <input type="text" value={id} onChange={(event) => setId(event.target.value)} placeholder="example-task" />
          </label>

          <label>
            Initial PC
            <input
              type="text"
              value={initialPc}
              onChange={(event) => setInitialPc(event.target.value)}
              placeholder="0x80000000"
            />
          </label>

          <label>
            OS Program File
            <input
              type="text"
              value={osProgramFile}
              onChange={(event) => setOsProgramFile(event.target.value)}
              placeholder="os.s"
            />
          </label>

          <label>
            Terminal Delay
            <input
              type="text"
              value={terminalDelay}
              onChange={(event) => setTerminalDelay(event.target.value)}
              placeholder="0"
            />
          </label>

          <fieldset className="task-editor-section">
            <legend>Memory Mapped Registers</legend>
            <label>
              Preset
              <select value={mmrPresetId} onChange={onPresetChange}>
                {MMR_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            {mmrPresetId === CUSTOM_MMR_PRESET_ID && (
              <div className="task-editor-mmr-list">
                {mmrFields.map((field) => (
                  <label key={field} className="task-editor-mmr-row">
                    <span>{field}</span>
                    <input
                      type="text"
                      value={memoryMappedRegisters[field]}
                      onChange={(event) => {
                        setMmrValue(field, event.target.value);
                      }}
                      placeholder="0x00000000"
                    />
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="task-editor-section">
            <legend>User Programs</legend>
            <div className="task-editor-table-wrap">
              <table className="task-editor-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Name</th>
                    <th>File</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {userPrograms.map((program, index) => {
                    const normalizedAddress = program.address.trim().toLowerCase();
                    const normalizedName = program.name.trim().toLowerCase();
                    const isDuplicateAddress = normalizedAddress.length > 0 && duplicateProgramAddresses.has(normalizedAddress);
                    const isDuplicateName = normalizedName.length > 0 && duplicateProgramNames.has(normalizedName);

                    return (
                      <tr key={`program-${index}`}>
                        <td>
                          <input
                            type="text"
                            value={program.address}
                            className={isDuplicateAddress ? "task-editor-input-duplicate" : undefined}
                            aria-invalid={isDuplicateAddress}
                            onChange={(event) => {
                              setProgramValue(index, "address", event.target.value);
                            }}
                            placeholder="address"
                            title={isDuplicateAddress ? "Address must be unique" : undefined}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={program.name}
                            className={isDuplicateName ? "task-editor-input-duplicate" : undefined}
                            aria-invalid={isDuplicateName}
                            onChange={(event) => {
                              setProgramValue(index, "name", event.target.value);
                            }}
                            placeholder="name"
                            title={isDuplicateName ? "Name must be unique" : undefined}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={program.file}
                            onChange={(event) => {
                              setProgramValue(index, "file", event.target.value);
                            }}
                            placeholder="file"
                          />
                        </td>
                        <td>
                          <button type="button" onClick={() => removeProgram(index)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addProgram}>
              Add User Program
            </button>
          </fieldset>

          <fieldset className="task-editor-section">
            <legend>Initial Memory</legend>
            <div className="task-editor-table-wrap">
              <table className="task-editor-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Value</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {initialMemoryEntries.map((entry) => {
                    const normalizedAddress = entry.address.trim().toLowerCase();
                    const isDuplicateAddress = normalizedAddress.length > 0 && duplicateMemoryAddresses.has(normalizedAddress);

                    return (
                      <tr key={entry.id}>
                        <td>
                          <input
                            type="text"
                            value={entry.address}
                            className={isDuplicateAddress ? "task-editor-input-duplicate" : undefined}
                            aria-invalid={isDuplicateAddress}
                            onChange={(event) => {
                              setInitialMemoryValue(entry.id, "address", event.target.value);
                            }}
                            placeholder="address"
                            title={isDuplicateAddress ? "Address must be unique" : undefined}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={entry.value}
                            onChange={(event) => {
                              setInitialMemoryValue(entry.id, "value", event.target.value);
                            }}
                            placeholder="value"
                          />
                        </td>
                        <td>
                          <button type="button" onClick={() => removeInitialMemoryEntry(entry.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addInitialMemoryEntry}>
              Add Memory Cell
            </button>
          </fieldset>
        </div>

        {submitError && <div className="task-editor-error">{submitError}</div>}

        <div className="modal-actions">
          <button type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="button" className="modal-save-button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : isEditMode ? "Save Task" : "Create Task"}
          </button>
        </div>
      </div>
    </div>
  );
};