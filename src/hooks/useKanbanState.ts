"use client";
import { useState, useEffect, useCallback, type DragEvent } from 'react';
import type { KanbanState, ColumnId, Note, ColumnData } from '@/types/kanban';
import { loadStateFromLocalStorage, saveStateToLocalStorage, initialCoreColumnsData, initialColumnOrder } from '@/lib/kanban-utils';

export function useKanbanState() {
  const [kanbanState, setKanbanState] = useState<KanbanState>(() => {
    const loadedState = typeof window !== 'undefined' ? loadStateFromLocalStorage() : undefined;
    return loadedState || {
      columns: JSON.parse(JSON.stringify(initialCoreColumnsData)),
      columnOrder: [...initialColumnOrder],
    };
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!isLoaded) { 
        const loadedState = loadStateFromLocalStorage();
        if (loadedState) {
          setKanbanState(loadedState);
        }
        setIsLoaded(true);
      }
    }
  }, [isLoaded]); 

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined' && kanbanState) {
      saveStateToLocalStorage(kanbanState);
    }
  }, [kanbanState, isLoaded]);

  const addNoteToColumn = useCallback((columnId: ColumnId, content: string) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      previousColumnId: undefined,
      // attachment will be undefined by default
    };

    setKanbanState(prevState => {
      const column = prevState.columns[columnId];
      if (!column) {
        console.error(`Target column ${String(columnId)} not found.`);
        return prevState;
      }
      const updatedNotes = [...(column.notes || []), newNote];
      const updatedColumn = { ...column, notes: updatedNotes };
      const newColumns = { ...prevState.columns, [columnId]: updatedColumn };
      return { ...prevState, columns: newColumns };
    });
  }, []);

  const deleteNote = useCallback((noteId: string, sourceColumnId: ColumnId) => {
    setKanbanState(prevState => {
      const sourceCol = prevState.columns[sourceColumnId];
      const trashCol = prevState.columns.lixeira;

      if (!sourceCol || !trashCol) {
        console.error("Source or Trash column not found during delete");
        return prevState;
      }

      const noteToMove = sourceCol.notes.find(note => note.id === noteId);
      if (!noteToMove) return prevState;

      const noteWithPrevCol = { ...noteToMove, previousColumnId: sourceColumnId };
      const newSourceNotes = sourceCol.notes.filter(note => note.id !== noteId);

      const currentTrashNotes = Array.isArray(trashCol.notes) ? trashCol.notes : [];
      const filteredTrashNotes = currentTrashNotes.filter(n => n.id !== noteWithPrevCol.id);
      const newTrashNotes = [...filteredTrashNotes, noteWithPrevCol];

      return {
        ...prevState,
        columns: {
          ...prevState.columns,
          [sourceColumnId]: { ...sourceCol, notes: newSourceNotes },
          lixeira: { ...trashCol, notes: newTrashNotes },
        }
      };
    });
  }, []);

  const restoreNote = useCallback((noteId: string) => {
    setKanbanState(prevState => {
      const trashCol = prevState.columns.lixeira;
      if (!trashCol || !Array.isArray(trashCol.notes)) {
        return prevState;
      }

      const noteToRestore = trashCol.notes.find(note => note.id === noteId);
      if (!noteToRestore) return prevState;

      let targetColumnId = noteToRestore.previousColumnId && prevState.columns[noteToRestore.previousColumnId]
        ? noteToRestore.previousColumnId
        : prevState.columnOrder.find(id => id !== 'lixeira' && prevState.columns[id]) || initialColumnOrder[0];

      let targetCol = prevState.columns[targetColumnId];
      const { previousColumnId, ...restoredNoteData } = noteToRestore;

      if (!targetCol || !Array.isArray(targetCol.notes)) {
        const firstAvailableNonTrashColumnId = prevState.columnOrder.find(id => id !== 'lixeira' && prevState.columns[id]);
        if (firstAvailableNonTrashColumnId && prevState.columns[firstAvailableNonTrashColumnId]) {
          targetColumnId = firstAvailableNonTrashColumnId;
          targetCol = prevState.columns[targetColumnId];
        } else {
          console.error("No valid target column found for restoring note.");
          return prevState;
        }
      }

      const newTrashNotes = trashCol.notes.filter(note => note.id !== noteId);
      const currentTargetNotes = Array.isArray(targetCol.notes) ? targetCol.notes : [];
      const filteredTargetNotes = currentTargetNotes.filter(n => n.id !== restoredNoteData.id);
      const newTargetNotes = [...filteredTargetNotes, restoredNoteData];

      return {
        ...prevState,
        columns: {
          ...prevState.columns,
          lixeira: { ...trashCol, notes: newTrashNotes },
          [targetColumnId]: { ...targetCol, notes: newTargetNotes },
        }
      };
    });
  }, []);


  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, noteId: string, sourceColumnId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ noteId, sourceColumnId }));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetColumnId: ColumnId) => {
    e.preventDefault();
    if (targetColumnId === 'lixeira') {
      return;
    }

    try {
      const transferData = e.dataTransfer.getData('application/json');
      if (!transferData) return;

      const { noteId, sourceColumnId } = JSON.parse(transferData) as { noteId: string; sourceColumnId: ColumnId };

      if (sourceColumnId === 'lixeira') {
        return;
      }

      if (sourceColumnId === targetColumnId) return;

      setKanbanState(prevState => {
        const sourceCol = prevState.columns[sourceColumnId];
        const targetCol = prevState.columns[targetColumnId];

        if (!sourceCol || !targetCol) {
          console.error(`Source (${String(sourceColumnId)}) or Target (${String(targetColumnId)}) column not found during drop`);
          return prevState;
        }

        const noteToMove = sourceCol.notes.find(note => note.id === noteId);
        if (!noteToMove) return prevState;

        const newSourceNotes = sourceCol.notes.filter(note => note.id !== noteId);

        const currentTargetNotes = Array.isArray(targetCol.notes) ? targetCol.notes : [];
        const filteredTargetNotes = currentTargetNotes.filter(n => n.id !== noteToMove.id);
        const newTargetNotes = [...filteredTargetNotes, noteToMove];

        return {
          ...prevState,
          columns: {
            ...prevState.columns,
            [sourceColumnId]: { ...sourceCol, notes: newSourceNotes },
            [targetColumnId]: { ...targetCol, notes: newTargetNotes },
          }
        };
      });

    } catch (error) {
      console.error("Error processing drop event:", error);
    }
  }, []);

  const createColumn = useCallback((title: string, color: string) => {
    setKanbanState(currentState => {
      const newColumnId: ColumnId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newColumn: ColumnData = {
        id: newColumnId,
        title,
        notes: [],
        color,
        isCustom: true,
      };
      const newColumns = { ...currentState.columns, [newColumnId]: newColumn };
      
      const lixeiraIndex = currentState.columnOrder.indexOf('lixeira');
      let newColumnOrder;
      if (lixeiraIndex >= 0 && currentState.columnOrder.includes('lixeira')) { // Also check if lixeira is in columnOrder
        // Insert before lixeira
        newColumnOrder = [
          ...currentState.columnOrder.slice(0, lixeiraIndex),
          newColumnId,
          ...currentState.columnOrder.slice(lixeiraIndex)
        ];
      } else {
        // Append if lixeira is not in order (or not found)
        newColumnOrder = [...currentState.columnOrder, newColumnId];
      }
      
      return { ...currentState, columns: newColumns, columnOrder: newColumnOrder };
    });
  }, []);

  const reorderColumns = useCallback((newColumnOrderFromDialog: ColumnId[]) => {
    setKanbanState(currentState => {
      const validOrderedIds = newColumnOrderFromDialog.filter(id => currentState.columns[id] && id !== 'lixeira');
      
      // Lixeira is not part of the reorderable list in the dialog, it's handled separately.
      // The main columnOrder in state will exclude 'lixeira' and KanbanBoard will render it last.
      return { ...currentState, columnOrder: validOrderedIds };
    });
  }, []);

  const updateColumn = useCallback((columnId: ColumnId, title: string, color: string) => {
    setKanbanState(prevState => {
      const columnToUpdate = prevState.columns[columnId];
      if (!columnToUpdate) {
        return prevState;
      }

      const newTitle = (columnToUpdate.isCustom || initialCoreColumnsData[columnId]?.isCustom === true) ? title.trim() : columnToUpdate.title;
      const updatedColumn = { ...columnToUpdate, title: newTitle, color };
      const newColumns = { ...prevState.columns, [columnId]: updatedColumn };

      return { ...prevState, columns: newColumns };
    });
  }, []);

 const deleteColumn = useCallback((columnId: ColumnId) => {
    setKanbanState(currentState => {
        const columnToDelete = currentState.columns[columnId];

        if (!columnToDelete) {
            console.warn(`Attempted to delete non-existent column: ${String(columnId)}`);
            return currentState;
        }
        if (columnId === 'lixeira') {
            console.warn("Attempted to delete the 'lixeira' column, which is not allowed.");
            return currentState;
        }

        const newColumnOrder = currentState.columnOrder.filter(id => id !== columnId);
        const { [columnId]: _deletedColumn, ...remainingColumns } = currentState.columns;
        let updatedColumnsObject = remainingColumns;

        if (columnToDelete.notes.length > 0 && updatedColumnsObject.lixeira) {
            const trashColData = updatedColumnsObject.lixeira;
            const notesToMoveToTrash = columnToDelete.notes.map(note => ({
                ...note,
                previousColumnId: columnId 
            }));

            const currentTrashNotes = Array.isArray(trashColData.notes) ? trashColData.notes : [];
            const uniqueNotesToMove = notesToMoveToTrash.filter(moveToTrashNote =>
                !currentTrashNotes.some(trashNote => trashNote.id === moveToTrashNote.id)
            );
            const updatedTrashNotes = [...currentTrashNotes, ...uniqueNotesToMove];

            updatedColumnsObject = {
                ...updatedColumnsObject,
                lixeira: { 
                    ...trashColData, 
                    notes: updatedTrashNotes 
                }
            };
        }

        return {
            columns: updatedColumnsObject, 
            columnOrder: newColumnOrder    
        };
    });
}, []);


  const clearTrash = useCallback(() => {
    setKanbanState(prevState => {
      const trashCol = prevState.columns.lixeira;
      if (!trashCol || !Array.isArray(trashCol.notes) || trashCol.notes.length === 0) {
        return prevState;
      }
      const updatedTrashCol = { ...trashCol, notes: [] };
      const newColumns = { ...prevState.columns, lixeira: updatedTrashCol };
      return { ...prevState, columns: newColumns };
    });
  }, []);

  const addOrUpdateNoteAttachment = useCallback((noteId: string, columnId: ColumnId, attachmentContent: string) => {
    setKanbanState(prevState => {
      const column = prevState.columns[columnId];
      if (!column) return prevState;

      const noteIndex = column.notes.findIndex(n => n.id === noteId);
      if (noteIndex === -1) return prevState;

      // Create a new note object with the updated attachment
      const updatedNote = { 
        ...column.notes[noteIndex], 
        attachment: attachmentContent.trim() === "" ? undefined : attachmentContent.trim() 
      };
      
      // Create a new notes array for the column
      const newNotes = [...column.notes];
      newNotes[noteIndex] = updatedNote;

      // Create a new column object
      const updatedColumn = { ...column, notes: newNotes };
      
      // Create a new state object
      return {
        ...prevState,
        columns: {
          ...prevState.columns,
          [columnId]: updatedColumn,
        },
      };
    });
  }, []);

  const trashColumnId = 'lixeira';

  return {
    kanbanState,
    setKanbanState, // Exposing setKanbanState for direct manipulation if needed
    isLoaded,
    addNoteToColumn,
    deleteNote,
    restoreNote,
    clearTrash,
    handleDragStart,
    handleDrop,
    createColumn,
    reorderColumns,
    updateColumn,
    deleteColumn,
    addOrUpdateNoteAttachment,
    trashColumnId,
  };
}
