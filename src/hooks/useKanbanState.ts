
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
      // Deep copy and remove undefined values for Firestore compatibility
      const stateForFirestore = JSON.parse(JSON.stringify(state));
      await setDoc(getFirestoreDocRef(userId), stateForFirestore);
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 2000); 
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

  const debouncedSaveToFirestore = useCallback(debounce(performSaveToFirestore, 1500), [getFirestoreDocRef, db]);

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
        let newState: KanbanState;
        if (docSnap.exists()) {
          const firestoreData = docSnap.data() as KanbanState;
          if (firestoreData && 
              typeof firestoreData.columns === 'object' && 
              firestoreData.columns !== null && 
              Array.isArray(firestoreData.columnOrder)) {
            newState = firestoreData;
          } else {
            console.warn(`Firestore data for user ${currentUser.uid} is malformed. Using default state LOCALLY. This will be saved to Firestore on next user interaction if data remains malformed.`);
            newState = getInitialKanbanData();
          }
        } else {
          console.log(`No Firestore data for user ${currentUser.uid}. Initializing with default state and saving to Firestore.`);
          newState = getInitialKanbanData();
          await performSaveToFirestore(currentUser.uid, JSON.parse(JSON.stringify(newState)));
        }
        setKanbanState(newState);
        setIsLoaded(true); 
        setSyncStatus('synced'); 
        setTimeout(() => setSyncStatus('idle'), 2000);
      }, (error) => {
        console.error("Error listening to Firestore:", error);
        setKanbanState(getInitialKanbanData());
        setIsLoaded(true); 
        setSyncStatus('error');
      });

    } else if (!currentUser) {
      setKanbanState(loadStateFromLocalStorage());
      setIsLoaded(true); 
      setSyncStatus('idle'); 
    } else if (!db && currentUser) {
        console.error("Firestore db object is not available. Kanban data will rely on local storage for logged in user (fallback).");
        setKanbanState(loadStateFromLocalStorage()); 
        setIsLoaded(true); 
        setSyncStatus('error'); 
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
      attachment: undefined, 
      previousColumnId: undefined,
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
          const defaultInitialState = getInitialKanbanData();
          targetColumnId = defaultInitialState.columnOrder[0];
           if (!prevState.columns[targetColumnId]) {
             const fallbackTarget = Object.keys(prevState.columns).find(id => id !== trashColumnId);
             if (fallbackTarget) targetColumnId = fallbackTarget;
             else { console.error("No valid column to restore note to. Critical state error."); return prevState; }
           }
        }
      }
      
      const targetCol = prevState.columns[targetColumnId!]; 
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
          [targetColumnId!]: { ...targetCol, notes: newTargetNotes },
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
  
    if (sourceColumnId === trashColumnId || !draggedNoteId || !sourceColumnId) return; 
  
    const targetElement = e.target as HTMLElement;
    const droppedOnNoteElement = targetElement.closest('[data-note-id]');
    const droppedOnNoteId = droppedOnNoteElement?.getAttribute('data-note-id') || null;
  
    updateState(prevState => {
      const sourceCol = prevState.columns[sourceColumnId];
      const targetCol = prevState.columns[targetColumnId];
  
      if (!sourceCol || !targetCol) {
        console.error("Source or target column not found during drop.");
        return prevState;
      }
  
      const noteToMove = sourceCol.notes.find(note => note.id === draggedNoteId);
      if (!noteToMove) {
        console.error("Note to move not found in source column.");
        return prevState;
      }
  
      if (targetColumnId === trashColumnId) return prevState;
  
      if (sourceColumnId !== targetColumnId) {
        // Moving to a different column
        let newSourceNotes = sourceCol.notes.filter(note => note.id !== draggedNoteId);
        let newTargetNotes = [...targetCol.notes];
  
        const targetItemIndex = droppedOnNoteId ? newTargetNotes.findIndex(note => note.id === droppedOnNoteId) : -1;
  
        if (targetItemIndex > -1) {
          newTargetNotes.splice(targetItemIndex, 0, noteToMove);
        } else {
          newTargetNotes.push(noteToMove);
        }
        
        return {
          ...prevState,
          columns: {
            ...prevState.columns,
            [sourceColumnId]: { ...sourceCol, notes: newSourceNotes },
            [targetColumnId]: { ...targetCol, notes: newTargetNotes },
          }
        };
      } else {
        // Reordering within the same column
        let newNotes = [...sourceCol.notes];
        const draggedNoteActualIndex = newNotes.findIndex(note => note.id === draggedNoteId);

        if (draggedNoteActualIndex === -1) {
            console.error("Dragged note not found in source column during reorder attempt.");
            return prevState; 
        }

        const [itemBeingMoved] = newNotes.splice(draggedNoteActualIndex, 1);

        if (droppedOnNoteId) {
            if (droppedOnNoteId === draggedNoteId) {
                // Dropped ON ITSELF. Re-insert it at its original position.
                newNotes.splice(draggedNoteActualIndex, 0, itemBeingMoved);
            } else {
                // Dropped on a DIFFERENT note. Find that note's current index.
                const targetNoteIndex = newNotes.findIndex(note => note.id === droppedOnNoteId);
                if (targetNoteIndex > -1) {
                    newNotes.splice(targetNoteIndex, 0, itemBeingMoved); // Insert before the target note
                } else {
                    // Target note (droppedOnNoteId) was not found (edge case). Add to the end.
                    newNotes.push(itemBeingMoved);
                }
            }
        } else {
            // Dropped on the column background (not on a specific note), add to the end.
            newNotes.push(itemBeingMoved);
        }
        
        return {
          ...prevState,
          columns: {
            ...prevState.columns,
            [sourceColumnId]: { ...sourceCol, notes: newNotes }
          }
        };
      }
    });
  }, [updateState, trashColumnId]);

  const createColumn = useCallback((title: string, color: string) => {
    updateState(currentState => {
      const newColumnId: ColumnId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newColumn: ColumnData = { id: newColumnId, title, notes: [], color, isCustom: true };
      
      let newColumnOrder = [...currentState.columnOrder];
      newColumnOrder.push(newColumnId);
      
      return { ...currentState, columns: { ...currentState.columns, [newColumnId]: newColumn }, columnOrder: newColumnOrder };
    });
  }, [updateState]);

  const reorderColumns = useCallback((newColumnOrderFromDialog: ColumnId[]) => {
    updateState(currentState => {
      const validOrderedIds = newColumnOrderFromDialog.filter(id => currentState.columns[id] && id !== trashColumnId);
      
      const currentNonTrashColumnIds = currentState.columnOrder.filter(id => id !== trashColumnId);
      const finalOrderedIds = [...validOrderedIds]; 

      currentNonTrashColumnIds.forEach(id => {
        if (!finalOrderedIds.includes(id)) {
          finalOrderedIds.push(id); 
        }
      });
      
      return { ...currentState, columnOrder: finalOrderedIds };
    });
  }, [updateState, trashColumnId]);

  const updateColumn = useCallback((columnId: ColumnId, title: string, color: string) => {
    updateState(prevState => {
      const columnToUpdate = prevState.columns[columnId];
      if (!columnToUpdate || columnId === trashColumnId) return prevState; 
      
      const defaultInitialData = getInitialKanbanData();
      const isCoreNonEditableTitle = defaultInitialData.columns[columnId] && 
                                     defaultInitialData.columns[columnId].isCustom === false;

      const canEditTitle = columnToUpdate.isCustom === true || !isCoreNonEditableTitle;
      const newTitle = canEditTitle && title.trim() !== "" ? title.trim() : columnToUpdate.title;
      
      return { ...prevState, columns: { ...prevState.columns, [columnId]: { ...columnToUpdate, title: newTitle, color } } };
    });
  }, [updateState, trashColumnId]);

  const deleteColumn = useCallback((columnId: ColumnId) => {
    updateState(currentState => {
      const columnToDelete = currentState.columns[columnId];
      if (!columnToDelete || columnId === trashColumnId) return currentState; 

      const newColumnOrder = currentState.columnOrder.filter(id => id !== columnId);
      const { [columnId]: _deletedColumn, ...remainingColumns } = currentState.columns;
      let updatedColumnsObject = remainingColumns;

      if (columnToDelete.notes.length > 0 && updatedColumnsObject[trashColumnId]) {
        const trashColData = updatedColumnsObject[trashColumnId];
        const notesToMoveToTrash = columnToDelete.notes.map(note => ({ ...note, previousColumnId: columnId }));
        
        const currentTrashNotes = Array.isArray(trashColData.notes) ? trashColData.notes : [];
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

