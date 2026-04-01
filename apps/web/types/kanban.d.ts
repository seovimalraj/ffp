export interface KanbanItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: "low" | "medium" | "high";
  assignee?: {
    name: string;
    avatar?: string;
    initials?: string;
  };
  dueDate?: string;
  tags?: Array<{
    label: string;
    color: string;
    textColor?: string;
  }>;
  comments?: number;
  attachments?: number;
  metadata?: Record<string, any>;
}

export interface KanbanColumn {
  id: string;
  title: string;
  items: KanbanItem[];
  color?: string;
  limit?: number;
}

export interface KanbanBoard {
  id: string;
  title: string;
  columns: KanbanColumn[];
}

export interface KanbanMoveEvent {
  itemId: string;
  fromColumnId: string;
  toColumnId: string;
  fromIndex: number;
  toIndex: number;
  item: KanbanItem;
}

export interface StatusChangeConfig {
  [key: string]: {
    onEnter?: (item: KanbanItem) => KanbanItem | Promise<KanbanItem>;
    onExit?: (item: KanbanItem) => KanbanItem | Promise<KanbanItem>;
    allowedTransitions?: string[];
    autoAssign?: string;
    notifications?: {
      onEnter?: string;
      onExit?: string;
    };
  };
}

export interface KanbanConfig {
  statusChangeConfig?: StatusChangeConfig;
  allowAddTask?: boolean;
  columnColors?: Record<string, string>;
  cardStyle?: "default" | "compact" | "detailed";
  showColumnLimits?: boolean;
  enableNotifications?: boolean;
  readOnly?: boolean;
  canMoveItem?: (
    item: KanbanItem,
    fromColumnId: string,
    toColumnId: string,
  ) => boolean | Promise<boolean>;
}
