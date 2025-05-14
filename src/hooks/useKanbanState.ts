
"use client";
import { useState, useEffect, useCallback, type DragEvent } from 'react';
import type { KanbanState, ColumnId, Note, ColumnData } from '@/types/kanban';
import { loadStateFromLocalStorage, saveStateToLocalStorage, getInitialKanbanData } from '@/lib/kanban-utils';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';

const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise(resolve => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => resolve(func(...args)), waitFor);
    });
};

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export function useKanbanState() {
  const { currentUser } = useAuth();
  const [kanbanState, setKanbanState] = useState<KanbanState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const trashColumnId = 'lixeira';

  const getFirestoreDocRef = useCallback((userId: string) => {
    return doc(db, 'users', userId, 'kanban', 'userState');
  }, []);

  const performSaveToFirestore = async (userId: string, state: KanbanState) => {
    if (!userId || !state || !db) return;
    setSyncStatus('syncing');
    try {
      // Sanitize state for Firestore: remove undefined values
      const stateForFirestore = JSON.parse(JSON.stringify(state));
      await setDoc(getFirestoreDocRef(userId), stateForFirestore);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 3000); 
    } catch (error) {
      console.error("Error saving state to Firestore:", error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
      if (error instanceof Error && error.message.includes("Unsupported field value: undefined")) {
        console.error("State snapshot that caused Firestore error (original):", state);
        console.error("State snapshot that caused Firestore error (processed for Firestore):", JSON.parse(JSON.stringify(state)));
      }
    }
  };

  const debouncedSaveToFirestore = useCallback(debounce(performSaveToFirestore, 2000), [getFirestoreDocRef, db]);

  const forceSync = useCallback(async () => {
    if (currentUser && kanbanState && db) {
      await performSaveToFirestore(currentUser.uid, kanbanState);
    } else if (!currentUser) {
      console.warn("Cannot force sync: no user logged in.");
    } else if (!kanbanState) {
      console.warn("Cannot force sync: kanban state is not available.");
    } else if (!db) {
      console.warn("Cannot force sync: Firestore db is not available.");
    }
  }, [currentUser, kanbanState, performSaveToFirestore, db]);


  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    if (currentUser && db) {
      setIsLoaded(false);
      const docRef = getFirestoreDocRef(currentUser.uid);
      
      unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          const firestoreState = docSnap.data() as KanbanState;
          if (firestoreState && firestoreState.columns && firestoreState.columnOrder) {
             setKanbanState(firestoreState);
          } else {
            const defaultState = getInitialKanbanData();
            setKanbanState(defaultState);
            await performSaveToFirestore(currentUser.uid, JSON.parse(JSON.stringify(defaultState)));
          }
        } else {
          const localState = loadStateFromLocalStorage();
          setKanbanState(localState);
          await performSaveToFirestore(currentUser.uid, JSON.parse(JSON.stringify(localState)));
        }
        setIsLoaded(true);
        if (syncStatus !== 'syncing') { 
           setSyncStatus('idle'); 
        }
      }, (error) => {
        console.error("Error listening to Firestore:", error);
        setKanbanState(loadStateFromLocalStorage());
        setIsLoaded(true);
        setSyncStatus('error');
      });

    } else if (!currentUser) {
      setKanbanState(loadStateFromLocalStorage());
      setIsLoaded(true);
      setSyncStatus('idle'); 
    } else if (!db && currentUser) {
        console.error("Firestore db object is not available. Kanban data will rely on local storage.");
        setKanbanState(loadStateFromLocalStorage());
        setIsLoaded(true);
        setSyncStatus('idle');
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, getFirestoreDocRef, db]);


  useEffect(() => {
    if (!isLoaded || !kanbanState) {
      return;
    }

    if (currentUser && db) {
      debouncedSaveToFirestore(currentUser.uid, kanbanState);
    } else if (!currentUser) {
      saveStateToLocalStorage(kanbanState);
    }
  }, [kanbanState, currentUser, isLoaded, debouncedSaveToFirestore, db]);


  const updateState = useCallback((updater: (prevState: KanbanState) => KanbanState) => {
    setKanbanState(prevState => {
      if (!prevState) {
        const initialState = getInitialKanbanData();
        return updater(initialState);
      }
      return updater(prevState);
    });
  }, []);

  const addNoteToColumn = useCallback((columnId: ColumnId, content: string) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
    };
    updateState(prevState => {
      const column = prevState.columns[columnId];
      if (!column) return prevState;
      const currentNotes = Array.isArray(column.notes) ? column.notes : [];
      const updatedNotes = [...currentNotes, newNote];
      return { ...prevState, columns: { ...prevState.columns, [columnId]: { ...column, notes: updatedNotes } } };
    });
  }, [updateState]);

  const deleteNote = useCallback((noteId: string, sourceColumnId: ColumnId) => {
    updateState(prevState => {
      const sourceCol = prevState.columns[sourceColumnId];
      const trashCol = prevState.columns[trashColumnId];
      if (!sourceCol || !trashCol) return prevState;

      const noteToMove = sourceCol.notes.find(note => note.id === noteId);
      if (!noteToMove) return prevState;

      const noteWithPrevColInfo = { ...noteToMove, previousColumnId: sourceColumnId };
      
      const newSourceNotes = sourceCol.notes.filter(note => note.id !== noteId);
      
      const currentTrashNotes = Array.isArray(trashCol.notes) ? trashCol.notes : [];
      const filteredTrashNotes = currentTrashNotes.filter(n => n.id !== noteWithPrevColInfo.id);
      const newTrashNotes = [...filteredTrashNotes, noteWithPrevColInfo];

      return {
        ...prevState,
        columns: {
          ...prevState.columns,
          [sourceColumnId]: { ...sourceCol, notes: newSourceNotes },
          [trashColumnId]: { ...trashCol, notes: newTrashNotes },
        }
      };
    });
  }, [updateState, trashColumnId]);

  const restoreNote = useCallback((noteId: string) => {
    updateState(prevState => {
      const trashCol = prevState.columns[trashColumnId];
      if (!trashCol || !Array.isArray(trashCol.notes)) return prevState;

      const noteToRestore = trashCol.notes.find(note => note.id === noteId);
      if (!noteToRestore) return prevState;

      let targetColumnId = noteToRestore.previousColumnId;

      if (!targetColumnId || !prevState.columns[targetColumnId] || targetColumnId === trashColumnId) {
        targetColumnId = prevState.columnOrder.find(id => id !== trashColumnId && prevState.columns[id]);
        if (!targetColumnId) {
          targetColumnId = getInitialKanbanData().columnOrder[0];
           if (!prevState.columns[targetColumnId]) {
             const fallbackTarget = Object.keys(prevState.columns).find(id => id !== trashColumnId);
             if (fallbackTarget) targetColumnId = fallbackTarget;
             else { console.error("No valid column to restore note to."); return prevState; }
           }
        }
      }
      
      let targetCol = prevState.columns[targetColumnId];
      if (!targetCol) {
        console.error(`Target column ${targetColumnId} for restoration does not exist.`);
        return prevState;
      }

      const { previousColumnId, ...restoredNoteData } = noteToRestore;
      
      const newTrashNotes = trashCol.notes.filter(note => note.id !== noteId);
      
      const currentTargetNotes = Array.isArray(targetCol.notes) ? targetCol.notes : [];
      const filteredTargetNotes = currentTargetNotes.filter(n => n.id !== restoredNoteData.id);
      const newTargetNotes = [...filteredTargetNotes, restoredNoteData];

      return {
        ...prevState,
        columns: {
          ...prevState.columns,
          [trashColumnId]: { ...trashCol, notes: newTrashNotes },
          [targetColumnId]: { ...targetCol, notes: newTargetNotes },
        }
      };
    });
  }, [updateState, trashColumnId]);

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, noteId: string, sourceColumnId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ noteId, sourceColumnId }));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, targetColumnId: ColumnId) => {
    e.preventDefault();
    const transferData = e.dataTransfer.getData('application/json');
    if (!transferData) return;
  
    const { noteId: draggedNoteId, sourceColumnId } = JSON.parse(transferData) as { noteId: string; sourceColumnId: ColumnId };
  
    if (sourceColumnId === trashColumnId) return; // Cannot drag from trash this way
  
    const targetElement = e.target as HTMLElement;
    const droppedOnNoteElement = targetElement.closest('[data-note-id]');
    const droppedOnNoteId = droppedOnNoteElement?.getAttribute('data-note-id') || null;
  
    updateState(prevState => {
      const sourceCol = prevState.columns[sourceColumnId];
      const targetCol = prevState.columns[targetColumnId];
      if (!sourceCol || !targetCol) return prevState;
  
      const noteToMove = sourceCol.notes.find(note => note.id === draggedNoteId);
      if (!noteToMove) return prevState;
  
      // Moving to a different column
      if (sourceColumnId !== targetColumnId) {
        if (targetColumnId === trashColumnId) return prevState; // Use deleteNote for trash
  
        const newSourceNotes = sourceCol.notes.filter(note => note.id !== draggedNoteId);
        let newTargetNotes = [...(Array.isArray(targetCol.notes) ? targetCol.notes : [])];
  
        // If dropped on a specific note in the target column, insert before it
        if (droppedOnNoteId && targetCol.id === targetColumnId && targetCol.notes.find(n => n.id === droppedOnNoteId)) {
          const targetIndex = newTargetNotes.findIndex(note => note.id === droppedOnNoteId);
          if (targetIndex !== -1) {
            newTargetNotes.splice(targetIndex, 0, noteToMove);
          } else {
            newTargetNotes.push(noteToMove); // Fallback if target note not found in current list
          }
        } else {
          newTargetNotes.push(noteToMove); // Append to end if dropped on column bg or empty space
        }
        
        // Ensure uniqueness in target column (defensive)
        newTargetNotes = newTargetNotes.filter((note, index, self) => index === self.findIndex((t) => t.id === note.id));
  
        return {
          ...prevState,
          columns: {
            ...prevState.columns,
            [sourceColumnId]: { ...sourceCol, notes: newSourceNotes },
            [targetColumnId]: { ...targetCol, notes: newTargetNotes },
          }
        };
      }
      // Reordering within the same column
      else if (sourceColumnId === targetColumnId) {
        if (draggedNoteId === droppedOnNoteId) return prevState; // Dropped on itself
  
        let currentNotes = [...sourceCol.notes];
        const draggedItemIndex = currentNotes.findIndex(note => note.id === draggedNoteId);
  
        if (draggedItemIndex === -1) return prevState; // Should not happen
  
        const [draggedItem] = currentNotes.splice(draggedItemIndex, 1); // Remove item
  
        if (droppedOnNoteId) {
          const targetItemIndex = currentNotes.findIndex(note => note.id === droppedOnNoteId);
          if (targetItemIndex !== -1) {
            currentNotes.splice(targetItemIndex, 0, draggedItem); // Insert before the target note
          } else {
            // If targetNoteId is not found (e.g. element removed, or drop was on column bg after all)
            currentNotes.push(draggedItem); // Append to the end
          }
        } else {
          // Dropped on the column background (not a specific note) within the same column. Append to the end.
          currentNotes.push(draggedItem);
        }
        
        // Ensure uniqueness (defensive)
        currentNotes = currentNotes.filter((note, index, self) => index === self.findIndex((t) => t.id === note.id));
  
        return {
          ...prevState,
          columns: {
            ...prevState.columns,
            [sourceColumnId]: { ...sourceCol, notes: currentNotes }
          }
        };
      }
      return prevState;
    });
  }, [updateState, trashColumnId]);

  const createColumn = useCallback((title: string, color: string) => {
    updateState(currentState => {
      const newColumnId: ColumnId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newColumn: ColumnData = { id: newColumnId, title, notes: [], color, isCustom: true };
      
      let newColumnOrder = [...currentState.columnOrder];
      const lixeiraIndex = newColumnOrder.indexOf(trashColumnId);
      
      if (lixeiraIndex !== -1) {
        newColumnOrder.splice(lixeiraIndex, 0, newColumnId);
      } else {
        newColumnOrder.push(newColumnId);
      }
      
      return { ...currentState, columns: { ...currentState.columns, [newColumnId]: newColumn }, columnOrder: newColumnOrder };
    });
  }, [updateState, trashColumnId]);

  const reorderColumns = useCallback((newColumnOrderFromDialog: ColumnId[]) => {
    updateState(currentState => {
      // Filter out trashColumnId and ensure all IDs are valid columns that exist
      const validOrderedIds = newColumnOrderFromDialog.filter(id => currentState.columns[id] && id !== trashColumnId);
      
      // Ensure all existing non-trash columns are present in the new order.
      // If some were not in newColumnOrderFromDialog (e.g. due to a bug in dialog), append them.
      const currentNonTrashIds = currentState.columnOrder.filter(id => id !== trashColumnId && currentState.columns[id]);
      const orderedSet = new Set(validOrderedIds);
      currentNonTrashIds.forEach(id => {
        if (!orderedSet.has(id)) {
          validOrderedIds.push(id); // Append missing valid columns
        }
      });
      
      // Ensure columnOrder always contains the trashColumnId if it exists in columns, but it's not part of draggable reorder
      // The KanbanBoard component handles rendering trashColumnId separately if needed.
      // The main columnOrder should only contain displayable/reorderable columns.
      return { ...currentState, columnOrder: validOrderedIds };
    });
  }, [updateState, trashColumnId]);

  const updateColumn = useCallback((columnId: ColumnId, title: string, color: string) => {
    updateState(prevState => {
      const columnToUpdate = prevState.columns[columnId];
      if (!columnToUpdate || columnId === trashColumnId) return prevState;
      
      // Determine if the title can be edited based on whether it's a custom column
      // or if its initial state was marked as editable (though defaults are not).
      const defaultInitialData = getInitialKanbanData();
      // A column is truly "core" if it exists in default data AND isCustom is false there.
      const isCoreNonEditableTitle = defaultInitialData.columns[columnId] && defaultInitialData.columns[columnId].isCustom === false;

      // Allow title change if it's a custom column OR it's a core column that somehow got 'isCustom:true' (legacy)
      // OR if it's a core column but we decide to allow its title to be changed (current default core columns are not editable by title)
      const canEditTitle = columnToUpdate.isCustom === true || !isCoreNonEditableTitle;


      const newTitle = canEditTitle && title.trim() !== "" ? title.trim() : columnToUpdate.title;
      
      return { ...prevState, columns: { ...prevState.columns, [columnId]: { ...columnToUpdate, title: newTitle, color } } };
    });
  }, [updateState, trashColumnId]);

  const deleteColumn = useCallback((columnId: ColumnId) => {
    updateState(currentState => {
      const columnToDelete = currentState.columns[columnId];
      // Prevent deleting the trash column or non-existent columns
      if (!columnToDelete || columnId === trashColumnId) return currentState;

      // Filter out the column to be deleted from the order
      const newColumnOrder = currentState.columnOrder.filter(id => id !== columnId);
      
      // Remove the column from the columns object
      const { [columnId]: _deletedColumn, ...remainingColumns } = currentState.columns;
      let updatedColumnsObject = remainingColumns;

      // If the column to delete has notes and the trash column exists, move notes to trash
      if (columnToDelete.notes.length > 0 && updatedColumnsObject[trashColumnId]) {
        const trashColData = updatedColumnsObject[trashColumnId];
        // Mark notes with their previous column for potential restoration context
        const notesToMoveToTrash = columnToDelete.notes.map(note => ({ ...note, previousColumnId: columnId }));
        
        const currentTrashNotes = Array.isArray(trashColData.notes) ? trashColData.notes : [];
        // Avoid duplicates in trash if somehow a note with same ID is already there
        const uniqueNotesToMove = notesToMoveToTrash.filter(moveToTrashNote =>
            !currentTrashNotes.some(trashNote => trashNote.id === moveToTrashNote.id)
        );
        updatedColumnsObject = {
          ...updatedColumnsObject,
          [trashColumnId]: { ...trashColData, notes: [...currentTrashNotes, ...uniqueNotesToMove] }
        };
      }
      return { columns: updatedColumnsObject, columnOrder: newColumnOrder };
    });
  }, [updateState, trashColumnId]);

  const clearTrash = useCallback(() => {
    updateState(prevState => {
      const trashCol = prevState.columns[trashColumnId];
      if (!trashCol || !Array.isArray(trashCol.notes) || trashCol.notes.length === 0) return prevState;
      return { ...prevState, columns: { ...prevState.columns, [trashColumnId]: { ...trashCol, notes: [] } } };
    });
  }, [updateState, trashColumnId]);

  const addOrUpdateNoteAttachment = useCallback((noteId: string, columnId: ColumnId, attachmentContent: string) => {
    updateState(prevState => {
      const column = prevState.columns[columnId];
      if (!column || !Array.isArray(column.notes)) return prevState;

      const noteIndex = column.notes.findIndex(n => n.id === noteId);
      if (noteIndex === -1) return prevState;

      const updatedNote = { 
        ...column.notes[noteIndex], 
        attachment: attachmentContent.trim() === "" ? undefined : attachmentContent.trim() 
      };
      const newNotes = [...column.notes];
      newNotes[noteIndex] = updatedNote;
      return { ...prevState, columns: { ...prevState.columns, [columnId]: { ...column, notes: newNotes } } };
    });
  }, [updateState]);

  return {
    kanbanState,
    isLoaded,
    syncStatus,
    forceSync,
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

