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
