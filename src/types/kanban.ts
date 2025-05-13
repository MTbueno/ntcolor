export interface Note {
  id: string;
  content: string;
  previousColumnId?: string; 
  attachment?: string; // Stores attached notes or links
}

export type ColumnId = string; 

export interface ColumnData {
  id: ColumnId;
  title: string;
  notes: Note[];
  color?: string; 
  isCustom?: boolean; 
}

export interface KanbanState {
  columns: Record<ColumnId, ColumnData>;
  columnOrder: ColumnId[]; 
}
