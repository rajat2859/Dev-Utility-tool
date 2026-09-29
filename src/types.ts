export type ToolCategory = 'development' | 'encoding' | 'generators' | 'converters' | 'design';

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  iconName: string;
  isFavorite?: boolean;
  timesUsed?: number;
}

export interface ToolUsage {
  toolId: string;
  timestamp: number;
  action: string;
}

export interface AppSettings {
  favorites: string[];
  recentTools: string[];
}

export type DesktopUpdateStatus = 'idle' | 'checking' | 'downloading' | 'up-to-date' | 'ready-to-install' | 'error';

export interface DesktopUpdateState {
  isSupported: boolean;
  currentVersion: string;
  status: DesktopUpdateStatus;
  latestVersion: string | null;
  downloadPercent: number;
  lastCheckedAt: string | null;
  errorMessage: string | null;
}

declare global {
  interface Window {
    desktopUpdater?: {
      getState: () => Promise<DesktopUpdateState>;
      checkForUpdates: () => Promise<DesktopUpdateState>;
      installUpdate: () => Promise<void>;
      onStateChange: (listener: (state: DesktopUpdateState) => void) => () => void;
    };
  }
}
