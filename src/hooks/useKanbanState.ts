
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
      await setDoc(getFirestoreDocRef(userId), state);
      // console.log('Kanban state saved to Firestore for user:', userId);
    } catch (error) {
      console.error("Error saving state to Firestore:", error);
    }
  }, 1000), [getFirestoreDocRef]);


  // Effect for initial data loading and Firestore real-time updates
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    if (currentUser) {
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
            await setDoc(docRef, defaultState); // Save initial state to Firestore
          }
        } else {
          // No data in Firestore for this user, load local or default, then save to Firestore
          const localState = loadStateFromLocalStorage(); // This now just returns state or default
          setKanbanState(localState);
          await setDoc(docRef, localState); // Save initial state to Firestore
        }
        setIsLoaded(true);
      }, (error) => {
        console.error("Error listening to Firestore:", error);
        // Fallback to local if Firestore listener fails
        setKanbanState(loadStateFromLocalStorage());
        setIsLoaded(true);
      });

    } else {
      // No user, load from local storage
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

    if (currentUser) {
      debouncedSaveToFirestore(currentUser.uid, kanbanState);
    } else {
      saveStateToLocalStorage(kanbanState);
    }
  }, [kanbanState, currentUser, isLoaded, debouncedSaveToFirestore]);


  const updateState = useCallback((updater: (prevState: KanbanState) => KanbanState) => {
    setKanbanState(prevState => {
      if (!prevState) return null; // Should not happen if isLoaded is true
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
      const updatedNotes = [...(column.notes || []), newNote];
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

      let targetColumnId = noteToRestore.previousColumnId && prevState.columns[noteToRestore.previousColumnId]
        ? noteToRestore.previousColumnId
        : prevState.columnOrder.find(id => id !== trashColumnId && prevState.columns[id]) || getInitialKanbanData().columnOrder[0];
      
      let targetCol = prevState.columns[targetColumnId];
      if (!targetCol) { // If target column was deleted, restore to first available non-trash
          const firstValidColId = prevState.columnOrder.find(id => id !== trashColumnId && prevState.columns[id]);
          if (firstValidColId) {
              targetColumnId = firstValidColId;
              targetCol = prevState.columns[targetColumnId];
          } else { // No valid column, highly unlikely, but restore to default 'importante'
              targetColumnId = getInitialKanbanData().columnOrder[0];
              if (!prevState.columns[targetColumnId]) { // If 'importante' somehow doesn't exist, create it
                 const defaultInitialData = getInitialKanbanData();
                 prevState.columns[targetColumnId] = defaultInitialData.columns[targetColumnId];
                 if (!prevState.columnOrder.includes(targetColumnId)) {
                     prevState.columnOrder.unshift(targetColumnId);
                 }
              }
              targetCol = prevState.columns[targetColumnId];
          }
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
    if (targetColumnId === trashColumnId) return;

    try {
      const transferData = e.dataTransfer.getData('application/json');
      if (!transferData) return;
      const { noteId, sourceColumnId } = JSON.parse(transferData) as { noteId: string; sourceColumnId: ColumnId };
      if (sourceColumnId === trashColumnId || sourceColumnId === targetColumnId) return;

      updateState(prevState => {
        const sourceCol = prevState.columns[sourceColumnId];
        const targetCol = prevState.columns[targetColumnId];
        if (!sourceCol || !targetCol) return prevState;

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
  }, [updateState, trashColumnId]);

  const createColumn = useCallback((title: string, color: string) => {
    updateState(currentState => {
      const newColumnId: ColumnId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newColumn: ColumnData = { id: newColumnId, title, notes: [], color, isCustom: true };
      
      const lixeiraIndex = currentState.columnOrder.indexOf(trashColumnId);
      const newColumnOrder = lixeiraIndex >= 0 && currentState.columnOrder.includes(trashColumnId)
        ? [...currentState.columnOrder.slice(0, lixeiraIndex), newColumnId, ...currentState.columnOrder.slice(lixeiraIndex)]
        : [...currentState.columnOrder, newColumnId];
      
      return { ...currentState, columns: { ...currentState.columns, [newColumnId]: newColumn }, columnOrder: newColumnOrder };
    });
  }, [updateState, trashColumnId]);

  const reorderColumns = useCallback((newColumnOrderFromDialog: ColumnId[]) => {
    updateState(currentState => {
      const validOrderedIds = newColumnOrderFromDialog.filter(id => currentState.columns[id] && id !== trashColumnId);
      return { ...currentState, columnOrder: validOrderedIds };
    });
  }, [updateState, trashColumnId]);

  const updateColumn = useCallback((columnId: ColumnId, title: string, color: string) => {
    updateState(prevState => {
      const columnToUpdate = prevState.columns[columnId];
      if (!columnToUpdate) return prevState;
      
      const defaultInitialData = getInitialKanbanData();
      const coreColumnCanEditTitle = defaultInitialData.columns[columnId]?.isCustom === true || columnToUpdate.isCustom;
      const newTitle = coreColumnCanEditTitle ? title.trim() : columnToUpdate.title;
      
      return { ...prevState, columns: { ...prevState.columns, [columnId]: { ...columnToUpdate, title: newTitle, color } } };
    });
  }, [updateState]);

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
      if (!column) return prevState;
      const noteIndex = column.notes.findIndex(n => n.id === noteId);
      if (noteIndex === -1) return prevState;

      const updatedNote = { ...column.notes[noteIndex], attachment: attachmentContent.trim() === "" ? undefined : attachmentContent.trim() };
      const newNotes = [...column.notes];
      newNotes[noteIndex] = updatedNote;
      return { ...prevState, columns: { ...prevState.columns, [columnId]: { ...column, notes: newNotes } } };
    });
  }, [updateState]);

  return {
    kanbanState,
    isLoaded, // This now means data is ready (from Firebase or local)
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
