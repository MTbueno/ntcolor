
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
      setIsLoaded(false); // Resetar isLoaded para indicar carregamento do Firestore
      const docRef = getFirestoreDocRef(currentUser.uid);
      
      unsubscribe = onSnapshot(docRef, async (docSnap) => {
        let newState: KanbanState;
        if (docSnap.exists()) {
          const firestoreData = docSnap.data() as KanbanState;
          // Validação mais robusta dos dados do Firestore
          if (firestoreData && 
              typeof firestoreData.columns === 'object' && 
              firestoreData.columns !== null && 
              Array.isArray(firestoreData.columnOrder)) {
            newState = firestoreData;
          } else {
            // Documento existe mas está corrompido/incompleto.
            // Carrega o padrão localmente. O próximo save (se o usuário interagir)
            // persistirá este estado padrão, efetivamente "corrigindo" o doc corrompido.
            console.warn(`Firestore data for user ${currentUser.uid} is malformed. Using default state LOCALLY. This will be saved to Firestore on next user interaction if data remains malformed.`);
            newState = getInitialKanbanData();
            // Opcional: poderia tentar salvar o estado padrão aqui imediatamente para corrigir,
            // mas é mais seguro esperar uma interação do usuário para evitar sobrescritas
            // se for um problema de leitura parcial temporário.
            // Se decidir salvar: await performSaveToFirestore(currentUser.uid, JSON.parse(JSON.stringify(newState)));
          }
        } else {
          // Usuário logado, mas sem dados no Firestore (primeiro login ou dados limpos)
          console.log(`No Firestore data for user ${currentUser.uid}. Initializing with default state and saving to Firestore.`);
          newState = getInitialKanbanData();
          // Salva o estado padrão no Firestore para o novo usuário
          await performSaveToFirestore(currentUser.uid, JSON.parse(JSON.stringify(newState)));
        }
        setKanbanState(newState);
        setIsLoaded(true); // Definir isLoaded APÓS o estado ser definido
      }, (error) => {
        console.error("Error listening to Firestore:", error);
        // Em caso de erro ao ouvir, carregar o estado padrão localmente para o app não quebrar.
        // Não salvar no Firestore aqui, pois pode haver um problema de conexão/permissão.
        setKanbanState(getInitialKanbanData());
        setIsLoaded(true); // Definir isLoaded APÓS o estado ser definido
        setSyncStatus('error');
      });

    } else if (!currentUser) {
      // Usuário não logado, usar localStorage
      setKanbanState(loadStateFromLocalStorage());
      setIsLoaded(true); // Definir isLoaded APÓS o estado ser definido
      setSyncStatus('idle'); 
    } else if (!db && currentUser) {
        // db não está disponível, mas usuário está logado. Cenário de erro.
        console.error("Firestore db object is not available. Kanban data will rely on local storage for logged in user (fallback).");
        setKanbanState(loadStateFromLocalStorage()); // Fallback para localStorage
        setIsLoaded(true); // Definir isLoaded APÓS o estado ser definido
        setSyncStatus('error'); // Indicar que a sincronização com a nuvem não é possível
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, getFirestoreDocRef, db]); // performSaveToFirestore foi removido das dependências para evitar loops potenciais, já que é estável com useCallback


  useEffect(() => {
    // Só salvar se estiver carregado e o estado existir
    if (!isLoaded || !kanbanState) {
      return;
    }

    if (currentUser && db) {
      // kanbanState aqui já deve ser o mais recente, seja do Firestore ou de uma ação do usuário
      debouncedSaveToFirestore(currentUser.uid, kanbanState);
    } else if (!currentUser) {
      saveStateToLocalStorage(kanbanState);
    }
  }, [kanbanState, currentUser, isLoaded, debouncedSaveToFirestore, db]);


  const updateState = useCallback((updater: (prevState: KanbanState) => KanbanState) => {
    setKanbanState(prevState => {
      if (!prevState) {
        // Se o estado anterior for null, inicialize com o padrão antes de aplicar o updater
        // Isso é mais relevante para o primeiro carregamento antes do Firestore/localStorage ser lido
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
      attachment: undefined, // Explicitamente definir campos opcionais
      previousColumnId: undefined,
    };
    updateState(prevState => {
      const column = prevState.columns[columnId];
      if (!column) return prevState; // Coluna não existe
      
      // Garante que notes seja sempre um array
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

      // Adiciona previousColumnId antes de mover para lixeira
      const noteWithPrevColInfo = { ...noteToMove, previousColumnId: sourceColumnId };
      
      const newSourceNotes = sourceCol.notes.filter(note => note.id !== noteId);
      
      // Garante que notes na lixeira seja um array e remove duplicatas por ID antes de adicionar
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

      // Define a coluna de destino para a restauração
      let targetColumnId = noteToRestore.previousColumnId;

      // Fallback se previousColumnId não existir, estiver inválido ou for a própria lixeira
      if (!targetColumnId || !prevState.columns[targetColumnId] || targetColumnId === trashColumnId) {
        // Tenta encontrar a primeira coluna não-lixeira na ordem definida
        targetColumnId = prevState.columnOrder.find(id => id !== trashColumnId && prevState.columns[id]);
        // Se ainda não encontrou (ex: só existe a lixeira), usa a primeira coluna do estado padrão
        if (!targetColumnId) {
          const defaultInitialState = getInitialKanbanData();
          targetColumnId = defaultInitialState.columnOrder[0];
           // Garante que essa coluna padrão exista no estado atual, se não, loga erro.
           if (!prevState.columns[targetColumnId]) {
             // Último recurso: primeira coluna disponível que não seja a lixeira
             const fallbackTarget = Object.keys(prevState.columns).find(id => id !== trashColumnId);
             if (fallbackTarget) targetColumnId = fallbackTarget;
             else { console.error("No valid column to restore note to. Critical state error."); return prevState; }
           }
        }
      }
      
      const targetCol = prevState.columns[targetColumnId!]; // Sabemos que targetColumnId não será null aqui
      // Limpa previousColumnId da nota restaurada
      const { previousColumnId, ...restoredNoteData } = noteToRestore;
      
      const newTrashNotes = trashCol.notes.filter(note => note.id !== noteId);
      
      // Garante que notes na targetCol seja um array e remove duplicatas por ID antes de adicionar
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
  
    // Não permitir arrastar da lixeira (restauração é feita por botão)
    // Ou se não houver ID da nota arrastada ou coluna de origem
    if (sourceColumnId === trashColumnId || !draggedNoteId || !sourceColumnId) return; 
  
    const targetElement = e.target as HTMLElement;
    // Encontra o elemento de nota mais próximo sobre o qual foi solto
    const droppedOnNoteElement = targetElement.closest('[data-note-id]');
    const droppedOnNoteId = droppedOnNoteElement?.getAttribute('data-note-id') || null;
  
    updateState(prevState => {
      const sourceCol = prevState.columns[sourceColumnId];
      const targetCol = prevState.columns[targetColumnId];
  
      // Validar se as colunas de origem e destino existem
      if (!sourceCol || !targetCol) {
        console.error("Source or target column not found during drop.");
        return prevState;
      }
  
      const noteToMove = sourceCol.notes.find(note => note.id === draggedNoteId);
      if (!noteToMove) {
        console.error("Note to move not found in source column.");
        return prevState;
      }
  
      // Não permitir soltar na lixeira via drag-and-drop (deleção é feita por botão)
      if (targetColumnId === trashColumnId) return prevState;
  
      let newSourceNotes = [...sourceCol.notes];
      let newTargetNotes = targetColumnId === sourceColumnId ? newSourceNotes : [...targetCol.notes];
  
      // Remover a nota da sua posição original
      const itemIndex = newSourceNotes.findIndex(note => note.id === draggedNoteId);
      if (itemIndex > -1) {
        newSourceNotes.splice(itemIndex, 1);
        if (targetColumnId === sourceColumnId) { // Se for a mesma coluna, newTargetNotes também é afetado
          newTargetNotes = [...newSourceNotes];
        }
      } else {
        // Se a nota não estava na coluna de origem, algo está errado.
        console.error("Dragged note not found in source column's array after find.");
        return prevState;
      }
  
      // Inserir na nova posição
      if (droppedOnNoteId && draggedNoteId !== droppedOnNoteId) {
        const targetItemIndex = newTargetNotes.findIndex(note => note.id === droppedOnNoteId);
        if (targetItemIndex > -1) {
          newTargetNotes.splice(targetItemIndex, 0, noteToMove);
        } else {
          newTargetNotes.push(noteToMove); // Se a nota alvo não for encontrada, adiciona ao final
        }
      } else if (!droppedOnNoteId) { // Solto no fundo da coluna
        newTargetNotes.push(noteToMove);
      }
      // Se droppedOnNoteId === draggedNoteId, não faz nada (soltou em si mesmo)
      
      // Garantir unicidade final, embora a lógica acima deva prevenir duplicatas se bem implementada.
      const finalTargetNotes = newTargetNotes.filter((note, index, self) => index === self.findIndex((t) => t.id === note.id));

      if (sourceColumnId !== targetColumnId) {
        return {
          ...prevState,
          columns: {
            ...prevState.columns,
            [sourceColumnId]: { ...sourceCol, notes: newSourceNotes },
            [targetColumnId]: { ...targetCol, notes: finalTargetNotes },
          }
        };
      } else { // Reordenando na mesma coluna
        return {
          ...prevState,
          columns: {
            ...prevState.columns,
            [sourceColumnId]: { ...sourceCol, notes: finalTargetNotes }
          }
        };
      }
    });
  }, [updateState, trashColumnId]);

  const createColumn = useCallback((title: string, color: string) => {
    updateState(currentState => {
      const newColumnId: ColumnId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const newColumn: ColumnData = { id: newColumnId, title, notes: [], color, isCustom: true };
      
      // Adiciona a nova coluna antes da lixeira na ordem
      let newColumnOrder = [...currentState.columnOrder];
      const lixeiraIndex = newColumnOrder.indexOf(trashColumnId); // Lixeira não está na columnOrder principal
      
      // Adiciona a nova coluna ao final da lista de colunas visíveis
      newColumnOrder.push(newColumnId);
      
      return { ...currentState, columns: { ...currentState.columns, [newColumnId]: newColumn }, columnOrder: newColumnOrder };
    });
  }, [updateState]);

  const reorderColumns = useCallback((newColumnOrderFromDialog: ColumnId[]) => {
    updateState(currentState => {
      // Filtra apenas IDs válidos que existem nas colunas e não são a lixeira
      const validOrderedIds = newColumnOrderFromDialog.filter(id => currentState.columns[id] && id !== trashColumnId);
      
      // Garante que todas as colunas customizadas e principais (não-lixeira) existentes
      // estejam presentes na nova ordem, mesmo que não tenham vindo do diálogo.
      const currentNonTrashColumnIds = currentState.columnOrder.filter(id => id !== trashColumnId);
      const finalOrderedIds = [...validOrderedIds]; // Começa com a ordem do diálogo

      currentNonTrashColumnIds.forEach(id => {
        if (!finalOrderedIds.includes(id)) {
          finalOrderedIds.push(id); // Adiciona colunas faltantes ao final
        }
      });
      
      return { ...currentState, columnOrder: finalOrderedIds };
    });
  }, [updateState, trashColumnId]);

  const updateColumn = useCallback((columnId: ColumnId, title: string, color: string) => {
    updateState(prevState => {
      const columnToUpdate = prevState.columns[columnId];
      if (!columnToUpdate || columnId === trashColumnId) return prevState; // Não atualizar lixeira ou colunas inexistentes
      
      const defaultInitialData = getInitialKanbanData();
      // Uma coluna é "core" (principal não customizável) se existir nos dados iniciais padrão E isCustom for false lá.
      const isCoreNonEditableTitle = defaultInitialData.columns[columnId] && 
                                     defaultInitialData.columns[columnId].isCustom === false;

      // Permite edição do título se:
      // 1. A coluna for customizada (columnToUpdate.isCustom === true)
      // 2. OU se NÃO for uma coluna principal com título não editável.
      const canEditTitle = columnToUpdate.isCustom === true || !isCoreNonEditableTitle;
      const newTitle = canEditTitle && title.trim() !== "" ? title.trim() : columnToUpdate.title;
      
      return { ...prevState, columns: { ...prevState.columns, [columnId]: { ...columnToUpdate, title: newTitle, color } } };
    });
  }, [updateState, trashColumnId]);

  const deleteColumn = useCallback((columnId: ColumnId) => {
    updateState(currentState => {
      const columnToDelete = currentState.columns[columnId];
      if (!columnToDelete || columnId === trashColumnId) return currentState; // Não deletar lixeira ou colunas inexistentes

      const defaultInitialData = getInitialKanbanData();
      if (defaultInitialData.columns[columnId] && defaultInitialData.columns[columnId].isCustom === false) {
          // Se for uma coluna principal não customizável, apenas limpe suas notas e mova para lixeira. Não remova a coluna.
          // Este caso já está coberto pela lógica de não permitir deleção de não-customizáveis no EditColumnsDialog.
          // Aqui, vamos permitir a remoção da coluna da `columnOrder` e do objeto `columns`
          // se ela foi marcada como `isCustom: true` em algum momento (ou se a lógica do diálogo permitir).
      }

      const newColumnOrder = currentState.columnOrder.filter(id => id !== columnId);
      const { [columnId]: _deletedColumn, ...remainingColumns } = currentState.columns;
      let updatedColumnsObject = remainingColumns;

      // Mover notas da coluna deletada para a lixeira, se a lixeira existir
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

