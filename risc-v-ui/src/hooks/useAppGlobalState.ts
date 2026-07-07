import { useState } from "react";
import type { AppView } from "../types/app";

interface AppGlobalState {
  appView: AppView;
  selectedConfigId: string;
  setAppView: (view: AppView) => void;
  setSelectedConfigId: (id: string) => void;
}

export const useAppGlobalState = (): AppGlobalState => {
  const [appView, setAppView] = useState<AppView>("setup");
  const [selectedConfigId, setSelectedConfigId] = useState<string>("");

  return {
    appView,
    selectedConfigId,
    setAppView,
    setSelectedConfigId,
  };
};
