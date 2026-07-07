import type { SimulatorConfig, StateModel } from "../types/simulator";
import { logTransportMessage } from "./debug.ts";

const jsonHeaders = {
  "Content-Type": "application/json",
};

interface SimulatorApi {
  postAction(action: string, delay?: number, cycles?: number): Promise<Response>;
  postKey(key: string): Promise<Response>;
  setConfig(config: SimulatorConfig): Promise<Response>;
  fetchSourceFile(path: string): Promise<string>;
  saveSourceFile(path: string, content: string): Promise<Response>;
  fetchContributions(): Promise<string>;
  saveContributions(content: string): Promise<void>;
  fetchSubmission(): Promise<{ blob: Blob; fileName: string }>;
  fetchCurrentState(): Promise<StateModel>;
  fetchAvailableConfigs(): Promise<SimulatorConfig[]>;
  fetchAvailableCustomConfigs(): Promise<SimulatorConfig[]>;
  postCustomConfig(config: SimulatorConfig): Promise<void>;
  deleteCustomConfig(id: string): Promise<void>;
}

export class SourceFileFetchError extends Error {
  readonly path: string;
  readonly status: number;
  readonly details: string;

  constructor(path: string, status: number, details: string) {
    super(`Failed to fetch source file: ${path}`);
    this.name = "SourceFileFetchError";
    this.path = path;
    this.status = status;
    this.details = details;
  }
}

export const createSimulatorApi = (baseUrl: string): SimulatorApi => {
  const fileNameFromDisposition = (disposition: string | null): string | null => {
    if (!disposition) {
      return null;
    }

    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1].replace(/^"|"$/g, ""));
    }

    const asciiMatch = disposition.match(/filename="?([^";]+)"?/i);
    return asciiMatch?.[1] ?? null;
  };

  const postJson = async (path: string, payload: unknown): Promise<Response> => {
    const url = `${baseUrl}${path}`;
    logTransportMessage("http", "outgoing", "HTTP POST", { url, payload });

    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });

    logTransportMessage("http", "incoming", "HTTP response", {
      url,
      status: response.status,
      ok: response.ok,
    });

    return response;
  };

  return {
    async postAction(action: string, delay: number = 0, cycles: number = 1): Promise<Response> {
      return postJson("/new-action", { action, delay, cycles });
    },

    async postKey(key: string): Promise<Response> {
      return postJson("/new-key", { key });
    },

    async setConfig(config: SimulatorConfig): Promise<Response> {
      return postJson("/set-config", { config });
    },

    async fetchSourceFile(path: string): Promise<string> {
      const response = await postJson("/get-source-file", { path });
      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new SourceFileFetchError(path, response.status, details);
      }

      const lines = (await response.json()) as string[];
      return Array.isArray(lines) ? lines.join("\n") : "";
    },

    async saveSourceFile(path: string, content: string): Promise<Response> {
      const contents = content.split(/\r?\n/);
      return postJson("/save-source-file", { path, contents });
    },

    async fetchContributions(): Promise<string> {
      const url = `${baseUrl}/get-contributions`;
      logTransportMessage("http", "outgoing", "HTTP GET", { url });

      const response = await fetch(url);
      logTransportMessage("http", "incoming", "HTTP response", {
        url,
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(details || "Failed to fetch contributions.md");
      }

      const lines = (await response.json()) as string[];
      return Array.isArray(lines) ? lines.join("\n") : "";
    },

    async saveContributions(content: string): Promise<void> {
      const contents = content.split(/\r?\n/);
      const response = await postJson("/set-contributions", { contents });
      if (response.ok) {
        return;
      }

      const details = await response.text().catch(() => "");
      throw new Error(details || "Failed to save contributions.md");
    },

    async fetchSubmission(): Promise<{ blob: Blob; fileName: string }> {
      const url = `${baseUrl}/get-submission`;
      logTransportMessage("http", "outgoing", "HTTP GET", { url });

      const response = await fetch(url);
      logTransportMessage("http", "incoming", "HTTP response", {
        url,
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(details || "Failed to download submission");
      }

      const blob = await response.blob();
      const fileName = fileNameFromDisposition(response.headers.get("Content-Disposition")) ?? "submission.zip";
      return { blob, fileName };
    },

    async fetchCurrentState(): Promise<StateModel> {
      const url = `${baseUrl}/get-current-state`;
      logTransportMessage("http", "outgoing", "HTTP GET", { url });

      const response = await fetch(url);
      logTransportMessage("http", "incoming", "HTTP response", {
        url,
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        throw new Error("No active simulation state available");
      }

      const state = (await response.json()) as StateModel;
      logTransportMessage("http", "incoming", "Current state payload", state);
      return state;
    },

    async fetchAvailableConfigs(): Promise<SimulatorConfig[]> {
      const url = `${baseUrl}/get-available-configs`;
      logTransportMessage("http", "outgoing", "HTTP GET", { url });

      const response = await fetch(url);
      logTransportMessage("http", "incoming", "HTTP response", {
        url,
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch configs");
      }

      const configs = (await response.json()) as SimulatorConfig[];
      logTransportMessage("http", "incoming", "Configs payload", configs);
      return configs;
    },

    async fetchAvailableCustomConfigs(): Promise<SimulatorConfig[]> {
      const url = `${baseUrl}/get-available-custom-configs`;
      logTransportMessage("http", "outgoing", "HTTP GET", { url });

      const response = await fetch(url);
      logTransportMessage("http", "incoming", "HTTP response", {
        url,
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch custom configs");
      }

      const configs = (await response.json()) as SimulatorConfig[];
      logTransportMessage("http", "incoming", "Custom configs payload", configs);
      return configs;
    },

    async postCustomConfig(config: SimulatorConfig): Promise<void> {
      const response = await postJson("/post-custom-config", { config });
      if (response.ok) {
        return;
      }

      const details = await response.text().catch(() => "");
      throw new Error(details || "Failed to save custom config");
    },

    async deleteCustomConfig(id: string): Promise<void> {
      const path = `/delete-custom-config/${encodeURIComponent(id)}`;
      const url = `${baseUrl}${path}`;
      logTransportMessage("http", "outgoing", "HTTP DELETE", { url });

      const response = await fetch(url, { method: "DELETE" });
      logTransportMessage("http", "incoming", "HTTP response", {
        url,
        status: response.status,
        ok: response.ok,
      });

      if (response.ok) {
        return;
      }

      const details = await response.text().catch(() => "");
      throw new Error(details || "Failed to delete custom config");
    },
  };
};
