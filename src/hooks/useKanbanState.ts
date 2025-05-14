
"use client";
import { useState, useEffect, useCallback, type DragEvent } from 'react';
import type { KanbanState, ColumnId, Note, ColumnData } from '@/types/kanban';
import { loadStateFromLocalStorage, saveStateToLocalStorage, getInitialKanbanData } from '@/lib/kanban-utils';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';

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

export function useKanbanState() {
  const { currentUser } = useAuth();
  const [kanbanState, setKanbanState] = useState<KanbanState | null>(null);
  const [isLoaded, setIsLoaded] = useState(false); // Tracks if initial data (local or remote) is loaded
  const trashColumnId = 'lixeira';

  const getFirestoreDocRef = useCallback((userId: string) => {
    return doc(db, 'users', userId, 'kanban', 'userState');
  }, []);

  // Debounced save to Firestore
  const debouncedSaveToFirestore = useCallback(debounce(async (userId: string, state: KanbanState) => {
    if (!userId || !state) return;
    try {
      // Deep clone and remove undefined properties for Firestore compatibility
      // JSON.stringify will omit keys with undefined values.
      const stateForFirestore = JSON.parse(JSON.stringify(state));
      await setDoc(getFirestoreDocRef(userId), stateForFirestore);
      // console.log('Kanban state saved to Firestore for user:', userId);
    } catch (error) {
      console.error("Error saving state to Firestore:", error);
      // Log the state that caused the error for easier debugging
      if (error instanceof Error && error.message.includes("Unsupported field value: undefined")) {
        console.error("State snapshot that caused Firestore error (original, before stringify):", state);
        // Log what was actually attempted to be sent (after stringify/parse which removes undefined)
        console.error("State snapshot that caused Firestore error (processed for Firestore):", JSON.parse(JSON.stringify(state)));
      }
    }
  }, 1000), [getFirestoreDocRef]);


  // Effect for initial data loading and Firestore real-time updates
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    if (currentUser && db) { // Ensure db is initialized
      setIsLoaded(false); // Reset loaded state when user changes
      const docRef = getFirestoreDocRef(currentUser.uid);
      
      unsubscribe = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          const firestoreState = docSnap.data() as KanbanState;
          // Basic validation, can be more thorough
          if (firestoreState && firestoreState.columns && firestoreState.columnOrder) {
             setKanbanState(firestoreState);
          } else {
            // Data in Firestore is malformed, initialize with default and save
            const defaultState = getInitialKanbanData();
            setKanbanState(defaultState);
            await setDoc(docRef, JSON.parse(JSON.stringify(defaultState))); // Save initial state to Firestore, sanitized
          }
        } else {
          // No data in Firestore for this user, load local or default, then save to Firestore
          const localState = loadStateFromLocalStorage(); // This now just returns state or default
          setKanbanState(localState);
          await setDoc(docRef, JSON.parse(JSON.stringify(localState))); // Save initial state to Firestore, sanitized
        }
        setIsLoaded(true);
      }, (error) => {
        console.error("Error listening to Firestore:", error);
        // Fallback to local if Firestore listener fails
        setKanbanState(loadStateFromLocalStorage());
        setIsLoaded(true);
      });

    } else if (!currentUser) { // No user, load from local storage
      setKanbanState(loadStateFromLocalStorage());
      setIsLoaded(true);
    } else if (!db && currentUser) { // User exists but db not ready (should not happen if firebase init is correct)
        console.error("Firestore db object is not available. Kanban data will rely on local storage.");
        setKanbanState(loadStateFromLocalStorage());
        setIsLoaded(true);
    }


    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, getFirestoreDocRef]);


  // Effect for saving state
  useEffect(() => {
    if (!isLoaded || !kanbanState) {
      return;
    }

    if (currentUser && db) { // Ensure db is initialized before trying to save
      debouncedSaveToFirestore(currentUser.uid, kanbanState);
    } else if (!currentUser) { // No user, save to local storage
      saveStateToLocalStorage(kanbanState);
    }
    // If currentUser exists but db is not ready, changes are not saved to Firestore
    // This case is handled by the initial loading effect falling back or local storage.
  }, [kanbanState, currentUser, isLoaded, debouncedSaveToFirestore]);


  const updateState = useCallback((updater: (prevState: KanbanState) => KanbanState) => {
    setKanbanState(prevState => {
      if (!prevState) {
        // If prevState is null, it might be during initial load before Firestore/local data is set.
        // Or if there was an error initializing state.
        // We could initialize with default here, but it might conflict with async loading.
        // For now, let's log and prevent update if state is truly not there.
        // console.warn("Attempted to update null kanbanState. Updater was:", updater.toString());
        const initialState = getInitialKanbanData(); // Get a fresh default
        return updater(initialState); // Try updating from a default if null
      }
      return updater(prevState);
    });
  }, []);

  const addNoteToColumn = useCallback((columnId: ColumnId, content: string) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      // previousColumnId and attachment will be undefined by default
    };
    updateState(prevState => {
      const column = prevState.columns[columnId];
      if (!column) return prevState; // Should not happen if columnId is valid
      // Ensure notes array exists and is an array
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

      // Add previousColumnId before moving to trash
      const noteWithPrevColInfo = { ...noteToMove, previousColumnId: sourceColumnId };
      
      const newSourceNotes = sourceCol.notes.filter(note => note.id !== noteId);
      
      const currentTrashNotes = Array.isArray(trashCol.notes) ? trashCol.notes : [];
      // Remove if already in trash (e.g., rapid clicks) to avoid duplicates, then add updated
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

      // Determine the target column
      let targetColumnId = noteToRestore.previousColumnId;

      // If previousColumnId is undefined, or if the column doesn't exist anymore, restore to the first available non-trash column
      if (!targetColumnId || !prevState.columns[targetColumnId] || targetColumnId === trashColumnId) {
        targetColumnId = prevState.columnOrder.find(id => id !== trashColumnId && prevState.columns[id]);
        // If still no valid target (e.g., all columns deleted except trash), restore to first default column
        if (!targetColumnId) {
          targetColumnId = getInitialKanbanData().columnOrder[0];
           // If this default column doesn't exist in current state, it implies a very broken state.
           // For robustness, we could recreate it, but that might be too much.
           // For now, if it's this broken, it might be better to let it be.
           // However, loadStateFromLocalStorage tries to ensure default columns exist.
           if (!prevState.columns[targetColumnId]) {
             console.warn(`Attempting to restore to default column '${targetColumnId}' which does not exist in current state. This might indicate a problem.`);
             // Fallback to literally the first column in current order that isn't trash
             const fallbackTarget = Object.keys(prevState.columns).find(id => id !== trashColumnId);
             if (fallbackTarget) targetColumnId = fallbackTarget;
             else { // Absolute last resort, shouldn't happen.
                console.error("No valid column to restore note to."); return prevState;
             }
           }
        }
      }
      
      let targetCol = prevState.columns[targetColumnId];
      if (!targetCol) { // Should be caught by above, but as a safeguard
        console.error(`Target column ${targetColumnId} for restoration does not exist.`);
        return prevState; // Or restore to a default 'importante'
      }

      // Remove previousColumnId from the note as it's being restored
      const { previousColumnId, ...restoredNoteData } = noteToRestore;
      
      const newTrashNotes = trashCol.notes.filter(note => note.id !== noteId);
      
      const currentTargetNotes = Array.isArray(targetCol.notes) ? targetCol.notes : [];
      // Remove if already in target (e.g., rapid clicks) to avoid duplicates, then add
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
    if (targetColumnId === trashColumnId) return; // Notes are moved to trash via deleteNote, not drag/drop

    try {
      const transferData = e.dataTransfer.getData('application/json');
      if (!transferData) return;
      const { noteId, sourceColumnId } = JSON.parse(transferData) as { noteId: string; sourceColumnId: ColumnId };

      // Prevent dropping into same column or from trash column by drag
      if (sourceColumnId === targetColumnId || sourceColumnId === trashColumnId) return;

      updateState(prevState => {
        const sourceCol = prevState.columns[sourceColumnId];
        const targetCol = prevState.columns[targetColumnId];
        if (!sourceCol || !targetCol) return prevState;

        const noteToMove = sourceCol.notes.find(note => note.id === noteId);
        if (!noteToMove) return prevState;

        // Note does not change, just its location
        const newSourceNotes = sourceCol.notes.filter(note => note.id !== noteId);
        
        const currentTargetNotes = Array.isArray(targetCol.notes) ? targetCol.notes : [];
        const filteredTargetNotes = currentTargetNotes.filter(n => n.id !== noteToMove.id); // Avoid duplicates on rapid interactions
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
  }, [updateState, trashColumnId]);

  const createColumn = useCallback((title: string, color: string) => {
    updateState(currentState => {
      const newColumnId: ColumnId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newColumn: ColumnData = { id: newColumnId, title, notes: [], color, isCustom: true };
      
      // Insert new column before the Lixeira column if Lixeira exists and is in columnOrder
      let newColumnOrder = [...currentState.columnOrder];
      const lixeiraIndex = newColumnOrder.indexOf(trashColumnId);
      
      if (lixeiraIndex !== -1) {
        newColumnOrder.splice(lixeiraIndex, 0, newColumnId);
      } else {
        newColumnOrder.push(newColumnId); // Add to end if Lixeira not found or not in order
      }
      
      return { ...currentState, columns: { ...currentState.columns, [newColumnId]: newColumn }, columnOrder: newColumnOrder };
    });
  }, [updateState, trashColumnId]);

  const reorderColumns = useCallback((newColumnOrderFromDialog: ColumnId[]) => {
    updateState(currentState => {
      // Filter out trashColumnId and any IDs not actually in current columns from the new order
      const validOrderedIds = newColumnOrderFromDialog.filter(id => currentState.columns[id] && id !== trashColumnId);
      
      // Ensure all existing non-trash columns are present, add missing ones to the end
      const currentNonTrashIds = currentState.columnOrder.filter(id => id !== trashColumnId);
      const orderedSet = new Set(validOrderedIds);
      currentNonTrashIds.forEach(id => {
        if (!orderedSet.has(id)) {
          validOrderedIds.push(id);
        }
      });
      
      // Add back the Lixeira column at the end if it exists
      // const finalOrder = currentState.columns[trashColumnId] ? [...validOrderedIds, trashColumnId] : validOrderedIds;
      // Lixeira is handled visually at the end, so columnOrder should not include it for reordering UI
      
      return { ...currentState, columnOrder: validOrderedIds };
    });
  }, [updateState, trashColumnId]);

  const updateColumn = useCallback((columnId: ColumnId, title: string, color: string) => {
    updateState(prevState => {
      const columnToUpdate = prevState.columns[columnId];
      if (!columnToUpdate || columnId === trashColumnId) return prevState; // Cannot edit trash column details
      
      const defaultInitialData = getInitialKanbanData(); // To check against default non-customizable properties
      // isCustom flag on default columns determines if title can be changed.
      // User-created custom columns always allow title change.
      const coreColumnIsCustomFlag = defaultInitialData.columns[columnId]?.isCustom;
      const canEditTitle = columnToUpdate.isCustom || coreColumnIsCustomFlag === true;

      const newTitle = canEditTitle && title.trim() !== "" ? title.trim() : columnToUpdate.title;
      
      return { ...prevState, columns: { ...prevState.columns, [columnId]: { ...columnToUpdate, title: newTitle, color } } };
    });
  }, [updateState, trashColumnId]);

  const deleteColumn = useCallback((columnId: ColumnId) => {
    updateState(currentState => {
      const columnToDelete = currentState.columns[columnId];
      // Prevent deletion of trash column or non-existent columns
      if (!columnToDelete || columnId === trashColumnId) return currentState;

      const newColumnOrder = currentState.columnOrder.filter(id => id !== columnId);
      const { [columnId]: _deletedColumn, ...remainingColumns } = currentState.columns;
      let updatedColumnsObject = remainingColumns;

      // Move notes from deleted column to Lixeira
      if (columnToDelete.notes.length > 0 && updatedColumnsObject[trashColumnId]) {
        const trashColData = updatedColumnsObject[trashColumnId];
        // Mark notes with their original column ID before moving
        const notesToMoveToTrash = columnToDelete.notes.map(note => ({ ...note, previousColumnId: columnId }));
        
        const currentTrashNotes = Array.isArray(trashColData.notes) ? trashColData.notes : [];
        // Avoid duplicates if notes somehow already exist by ID
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
    isLoaded, // This now means data is ready (from Firebase or local)
    setKanbanState, // Exposing setKanbanState for direct manipulation if needed (e.g. after dialogs)
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

