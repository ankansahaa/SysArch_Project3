import type { SimulatorConfig, SourceFileEntry } from "./types/simulator";

export const decToHexLength = (value: number | bigint, length: number): string => {
  const normalized = Number(value) >>> 0;
  return `0x${normalized.toString(16).padStart(length, "0")}`;
};

export const decToHex = (value: number | bigint): string => decToHexLength(value, 8);

export const registerNameFromNumber = (number: number): string => {
  const names: Record<number, string> = {
    0: "zero",
    1: "ra",
    2: "sp",
    3: "gp",
    4: "tp",
    5: "t0",
    6: "t1",
    7: "t2",
    8: "s0",
    9: "s1",
    10: "a0",
    11: "a1",
    12: "a2",
    13: "a3",
    14: "a4",
    15: "a5",
    16: "a6",
    17: "a7",
    18: "s2",
    19: "s3",
    20: "s4",
    21: "s5",
    22: "s6",
    23: "s7",
    24: "s8",
    25: "s9",
    26: "s10",
    27: "s11",
    28: "t3",
    29: "t4",
    30: "t5",
    31: "t6",
  };

  return names[Number(number)] ?? "unknown";
};

export const csrAddressToName = (address: number): string | null => {
  const names: Record<number, string> = {
    0xf11: "mvendorid",
    0xf12: "marchid",
    0xf13: "mimpid",
    0xf14: "mhartid",
    0xf15: "mconfigptr",
    0x300: "mstatus",
    0x301: "misa",
    0x302: "medeleg",
    0x303: "mideleg",
    0x304: "mie",
    0x305: "mtvec",
    0x306: "mcounteren",
    0x310: "mstatush",
    0x312: "medelegh",
    0x340: "mscratch",
    0x341: "mepc",
    0x342: "mcause",
    0x343: "mtval",
    0x344: "mip",
    0x34a: "mtinst",
    0x34b: "mtval2",
    0xb00: "mcycle",
    0xb02: "minstret",
    0xb80: "mcycleh",
    0xb82: "minstreth",
    0x320: "mcountinhibit",
  };

  return names[address] ?? null;
};

export const parseAddressInput = (value: number | string): number => {
  if (typeof value === "number") {
    return value >>> 0;
  }

  if (!value) {
    return 0;
  }

  const trimmed = String(value).trim().toLowerCase();
  if (trimmed.startsWith("0x")) {
    return parseInt(trimmed, 16) >>> 0;
  }

  return parseInt(trimmed, 10) >>> 0;
};

const normalizeSourcePath = (path: string): string => path.trim();

export const extractSourceFiles = (config: SimulatorConfig | undefined): SourceFileEntry[] => {
  if (!config) {
    return [];
  }

  const entries: SourceFileEntry[] = [
    {
      id: config.os_program_file,
      path: normalizeSourcePath(config.os_program_file),
      configProgramName: "os",
      configProgramAddress: config.initial_pc,
    },
    ...config.user_programs.map((program) => ({
      id: program.file,
      path: normalizeSourcePath(program.file),
      configProgramName: program.name,
      configProgramAddress: program.address,
    })),
  ];

  const byPath = new Map<string, SourceFileEntry>();
  entries.forEach((entry) => {
    const normalizedPath = normalizeSourcePath(entry.path);
    if (!normalizedPath) {
      return;
    }

    byPath.set(normalizedPath, {
      id: normalizedPath,
      path: normalizedPath,
      configProgramName: entry.configProgramName,
      configProgramAddress: entry.configProgramAddress,
    });
  });

  return Array.from(byPath.values()).sort((a, b) => a.path.localeCompare(b.path));
};

const isHexString = (v: unknown): v is string =>
  typeof v === "string" && /^0x[0-9a-fA-F]+$/.test(v);

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const isDecimalString = (v: unknown): v is string =>
  typeof v === "string" && /^\d+$/.test(v);

export const validateSimulatorConfig = (value: unknown): SimulatorConfig => {
  if (typeof value !== "object" || value === null) {
    throw new Error("Task must be a JSON object");
  }

  const obj = value as Record<string, unknown>;

  if (!isNonEmptyString(obj.name)) throw new Error("Missing or empty 'name'");
  if (!isNonEmptyString(obj.id)) throw new Error("Missing or empty 'id'");
  if (!isHexString(obj.initial_pc)) throw new Error(`'initial_pc' must be a hex string (e.g. '0x80000000'), got: ${obj.initial_pc}`);
  if (!isNonEmptyString(obj.os_program_file)) throw new Error("Missing or empty 'os_program_file'");
  if (!isDecimalString(obj.terminal_delay)) throw new Error(`'terminal_delay' must be a decimal integer string, got: ${obj.terminal_delay}`);

  if (typeof obj.memory_mapped_registers !== "object" || obj.memory_mapped_registers === null) {
    throw new Error("Missing 'memory_mapped_registers' object");
  }
  const mmr = obj.memory_mapped_registers as Record<string, unknown>;
  const mmrFields = [
    "mtime", "mtimeh", "mtimecmp", "mtimecmph",
    "keyboard_ready", "keyboard_data",
    "terminal_ready", "terminal_data", "display",
  ] as const;
  for (const field of mmrFields) {
    if (!isHexString(mmr[field])) {
      throw new Error(`'memory_mapped_registers.${field}' must be a hex string, got: ${mmr[field]}`);
    }
  }

  if (!Array.isArray(obj.user_programs)) {
    throw new Error("'user_programs' must be an array");
  }
  for (let i = 0; i < (obj.user_programs as unknown[]).length; i++) {
    const prog = (obj.user_programs as unknown[])[i];
    if (typeof prog !== "object" || prog === null) {
      throw new Error(`'user_programs[${i}]' must be an object`);
    }
    const p = prog as Record<string, unknown>;
    if (!isHexString(p.address)) throw new Error(`'user_programs[${i}].address' must be a hex string`);
    if (!isNonEmptyString(p.name)) throw new Error(`'user_programs[${i}].name' must be a non-empty string`);
    if (!isNonEmptyString(p.file)) throw new Error(`'user_programs[${i}].file' must be a non-empty string`);
  }

  if (
    typeof obj.initial_memory !== "object" ||
    obj.initial_memory === null ||
    Array.isArray(obj.initial_memory)
  ) {
    throw new Error("'initial_memory' must be a JSON object");
  }
  for (const [k, v] of Object.entries(obj.initial_memory as Record<string, unknown>)) {
    if (!isHexString(k) || !isHexString(v)) {
      throw new Error(`'initial_memory' keys and values must be hex strings, got: "${k}": "${v}"`);
    }
  }

  return value as SimulatorConfig;
};

const DIRECTIVE_PATTERN = /(^|\s)\.([A-Za-z_][A-Za-z0-9_]*)\b/gm;

export const findUnsupportedDirectives = (source: string): string[] => {
  const unsupported = new Set<string>();
  const lines = source.split(/\r?\n/);

  lines.forEach((line) => {
    const commentStart = line.indexOf("#");
    const withoutComment = commentStart >= 0 ? line.slice(0, commentStart) : line;

    DIRECTIVE_PATTERN.lastIndex = 0;
    let match = DIRECTIVE_PATTERN.exec(withoutComment);
    while (match) {
      const directive = `.${match[2].toLowerCase()}`;
      if (directive !== ".text") {
        unsupported.add(directive);
      }
      match = DIRECTIVE_PATTERN.exec(withoutComment);
    }
  });

  return Array.from(unsupported).sort((a, b) => a.localeCompare(b));
};
