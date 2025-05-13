
"use client";
import type { DragEvent } from 'react';
import KanbanColumn from './KanbanColumn';
import CategorySelectionDialog from './CategorySelectionDialog';
import { Skeleton } from '@/components/ui/skeleton';
import type { ColumnId, KanbanState } from '@/types/kanban';

interface KanbanBoardProps {
  noteToSelectCategoryFor: string | null;
  onDialogClose: () => void;
  kanbanState: KanbanState;
  isLoaded: boolean;
  addNoteToColumn: (columnId: ColumnId, content: string) => void;
  deleteNote: (noteId: string, columnId: ColumnId) => void;
  restoreNote: (noteId: string) => void;
  clearTrash: () => void;
  handleDragStart: (e: DragEvent<HTMLDivElement>, noteId: string, sourceColumnId: string) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>, targetColumnId: ColumnId) => void;
  addOrUpdateNoteAttachment: (noteId: string, columnId: ColumnId, attachmentContent: string) => void;
  trashColumnId: ColumnId;
}

export default function KanbanBoard({ 
  noteToSelectCategoryFor, 
  onDialogClose,
  kanbanState,
  isLoaded,
  addNoteToColumn,
  deleteNote,
  restoreNote,
  clearTrash,
  handleDragStart,
  handleDrop,
  addOrUpdateNoteAttachment,
  trashColumnId,
}: KanbanBoardProps) {

  const handleCategorySelectedForNote = (columnId: ColumnId) => {
    if (noteToSelectCategoryFor) {
      addNoteToColumn(columnId, noteToSelectCategoryFor);
    }
    onDialogClose();
  };

  const trashColumn = isLoaded ? kanbanState.columns[trashColumnId] : null;

  if (!isLoaded) {
    return (
      <div className="flex-grow flex flex-col gap-6 overflow-y-auto pb-4 px-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex flex-col w-full rounded-lg shadow-2xl overflow-hidden mb-4">
            <Skeleton className="h-16 w-full" />
            <div className="p-4 space-y-3 flex-grow">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ))}
         <div className="flex flex-col w-full rounded-lg shadow-sm overflow-hidden mb-4">
             <Skeleton className="h-12 w-full" />
         </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-grow flex flex-col gap-4 md:gap-6 pb-4 px-1 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent">
        {/* Render regular columns based on dynamic order */}
        {kanbanState.columnOrder.map(columnId => {
          const column = kanbanState.columns[columnId];
          if (!column || column.id === trashColumnId) return null; 
          return (
            <KanbanColumn
              key={column.id}
              column={column}
              handleDragStart={handleDragStart}
              handleDrop={handleDrop}
              onDeleteNote={deleteNote}
              onRestoreNote={restoreNote}
              onClearTrash={clearTrash} 
              onAddOrUpdateAttachment={addOrUpdateNoteAttachment}
            />
          );
        })}

         {trashColumn && (
            <KanbanColumn
                key={trashColumn.id}
                column={trashColumn}
                handleDragStart={handleDragStart}
                handleDrop={handleDrop}
                onDeleteNote={deleteNote}
                onRestoreNote={restoreNote}
                onClearTrash={clearTrash} 
                onAddOrUpdateAttachment={addOrUpdateNoteAttachment}
            />
         )}
      </div>
      {noteToSelectCategoryFor && isLoaded && (
        <CategorySelectionDialog
          isOpen={!!noteToSelectCategoryFor}
          onClose={onDialogClose}
          columns={Object.values(kanbanState.columns)
            .filter(col => col && col.id !== trashColumnId)}
          onSelectCategory={handleCategorySelectedForNote}
        />
      )}
    </>
  );
}
