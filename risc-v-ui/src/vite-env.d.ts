/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SIMULATOR_BACKEND_URL?: string;
  readonly VITE_SIMULATOR_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
