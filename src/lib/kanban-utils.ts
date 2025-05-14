
import type { KanbanState, ColumnId, ColumnData, Note } from '@/types/kanban';

export const KANBAN_DATA_KEY = 'kanbanflow-data';

const createInitialNote = (id: string, content: string, attachment?: string): Note => ({
  id,
  content,
  previousColumnId: undefined,
  attachment,
});

// Defines the absolute default structure and notes for the app.
// This is used for:
// 1. New anonymous users (if localStorage is empty).
// 2. New authenticated users (if their Firestore document is empty).
export const getInitialKanbanData = (): KanbanState => ({
  columns: {
    'importante': {
      id: 'importante',
      title: 'Importante',
      notes: [
        createInitialNote(
          'note-default-tattoo',
          'Fazer uma tattoo com @murillotattoo',
          '- Borboleta na coxa, para espantar os redill\n- Abstrato com elementos em vermelho'
        ),
      ],
      isCustom: false,
      color: '#A93226',
    },
    'em-processo': {
      id: 'em-processo',
      title: 'Em processo',
      notes: [
        createInitialNote(
          'note-default-portfolio',
          'Criar um portfólio para apps que estou criando',
          'Fiz uma calculadora de primeiro projeto, já que infelizmente o iPad não tem uma nativa.\nhttps://orange-lac.vercel.app/'
        ),
        createInitialNote(
          'note-default-pintura',
          'Aprender sobre pintura acrílica',
          'Comprar materiais'
        ),
      ],
      isCustom: false,
      color: '#9A7D0A',
    },
    'feito': {
      id: 'feito',
      title: 'Feito',
      notes: [
         createInitialNote(
          'note-default-appnotas',
          'Criar app de notas',
          'Olá, esse app eu criei para anotações rápidas semanais, numa interface simples e organizada. \nMuito obrigado por utilizar.\n\n- Murillo Bueno - murillo.toledo@live.com'
        ),
      ],
      isCustom: false,
      color: '#1E8449',
    },
    'lixeira': {
      id: 'lixeira',
      title: 'Lixeira',
      notes: [],
      isCustom: false,
      color: undefined, 
    },
  },
  columnOrder: ['importante', 'em-processo', 'feito'], // Lixeira is handled separately in UI
});

export const initialCoreColumnsData: Record<ColumnId, ColumnData> = getInitialKanbanData().columns;

export const pastelColors: string[] = [
  '#A93226', '#AF601A', '#9A7D0A', '#1E8449', '#17A589',
  '#2471A3', '#6C3483', '#B977A4', '#795548', '#455A64',
];

// This function now primarily loads from local storage or returns a fresh default state.
// It's used for anonymous users or as a fallback if Firestore loading fails.
export const loadStateFromLocalStorage = (): KanbanState => {
  if (typeof window === 'undefined') return getInitialKanbanData();

  try {
    const serializedState = localStorage.getItem(KANBAN_DATA_KEY);
    if (serializedState === null) {
      const defaultState = getInitialKanbanData();
      // Don't save to localStorage here immediately, let useKanbanState handle it
      return defaultState;
    }

    const storedState: Partial<KanbanState> = JSON.parse(serializedState);
    const loadedColumns: Record<ColumnId, ColumnData> = {};
    let loadedColumnOrder: ColumnId[] = [];
    const defaultInitialData = getInitialKanbanData(); // For reference

    if (storedState.columns) {
      for (const colId in storedState.columns) {
        const storedCol = storedState.columns[colId];
        if (storedCol && typeof storedCol.id === 'string' && typeof storedCol.title === 'string') {
          loadedColumns[colId] = {
            id: storedCol.id,
            title: storedCol.title,
            notes: Array.isArray(storedCol.notes) ? storedCol.notes.map(note => ({
                id: String(note.id || `note-fallback-${Date.now()}-${Math.random()}`),
                content: String(note.content || ''),
                previousColumnId: typeof note.previousColumnId === 'string' ? note.previousColumnId : undefined,
                attachment: typeof note.attachment === 'string' ? note.attachment : undefined,
            })).filter(note => note.id && note.id.startsWith('note-')) : [],
            color: storedCol.color || (defaultInitialData.columns[colId] ? defaultInitialData.columns[colId].color : undefined),
            isCustom: storedCol.isCustom !== undefined
                        ? storedCol.isCustom
                        : (defaultInitialData.columns[colId] ? defaultInitialData.columns[colId].isCustom : true),
          };
        }
      }
    }

    for (const coreColId in defaultInitialData.columns) {
      if (!loadedColumns[coreColId]) {
        loadedColumns[coreColId] = JSON.parse(JSON.stringify(defaultInitialData.columns[coreColId]));
      } else {
         const defaultCoreCol = defaultInitialData.columns[coreColId];
         if (defaultCoreCol) {
             loadedColumns[coreColId].isCustom = defaultCoreCol.isCustom;
             if (!defaultCoreCol.isCustom && loadedColumns[coreColId].title !== defaultCoreCol.title) {
                 loadedColumns[coreColId].title = defaultCoreCol.title;
             }
             if (!loadedColumns[coreColId].color && defaultCoreCol.color) {
                 loadedColumns[coreColId].color = defaultCoreCol.color;
             }
         }
      }
    }
    
    if (!loadedColumns.lixeira || typeof loadedColumns.lixeira.notes === 'undefined') {
      loadedColumns.lixeira = JSON.parse(JSON.stringify(defaultInitialData.columns.lixeira));
    } else {
      loadedColumns.lixeira = { // Ensure it's fully structured like the default
        ...defaultInitialData.columns.lixeira, // Start with default structure for lixeira
        ...loadedColumns.lixeira, // Override with loaded properties
        notes: Array.isArray(loadedColumns.lixeira.notes) ? loadedColumns.lixeira.notes.map(note => ({
              id: String(note.id || `note-fallback-${Date.now()}-${Math.random()}`),
              content: String(note.content || ''),
              previousColumnId: typeof note.previousColumnId === 'string' ? note.previousColumnId : undefined,
              attachment: typeof note.attachment === 'string' ? note.attachment : undefined,
          })).filter(note => note.id && note.id.startsWith('note-')) : [],
      };
    }


    Object.keys(loadedColumns).forEach(colId => {
        const col = loadedColumns[colId];
        const uniqueNotesMap = new Map<string, Note>();
        if (Array.isArray(col.notes)) {
            for (const note of col.notes) {
                if (note && typeof note.id === 'string') { // Ensure note and note.id are valid
                    if (!uniqueNotesMap.has(note.id)) {
                        uniqueNotesMap.set(note.id, note);
                    }
                }
            }
            loadedColumns[colId].notes = Array.from(uniqueNotesMap.values());
        } else {
          loadedColumns[colId].notes = [];
        }
    });

    if (storedState.columnOrder && Array.isArray(storedState.columnOrder)) {
      loadedColumnOrder = storedState.columnOrder.filter(id => loadedColumns[id] && id !== 'lixeira');
    }

    const orderedIdsSet = new Set(loadedColumnOrder);
    defaultInitialData.columnOrder.forEach(coreId => {
      if (loadedColumns[coreId] && !orderedIdsSet.has(coreId)) {
        const initialIndex = defaultInitialData.columnOrder.indexOf(coreId);
        let inserted = false;
        for (let i = 0; i < loadedColumnOrder.length; i++) {
            const currentLoadedColId = loadedColumnOrder[i];
            const currentLoadedColInitialIndex = defaultInitialData.columnOrder.indexOf(currentLoadedColId);
            if (currentLoadedColInitialIndex > initialIndex) {
                loadedColumnOrder.splice(i, 0, coreId);
                inserted = true;
                break;
            }
        }
        if (!inserted) loadedColumnOrder.push(coreId);
        orderedIdsSet.add(coreId);
      }
    });

    Object.keys(loadedColumns).filter(id => id !== 'lixeira' && !defaultInitialData.columns[id]).forEach(customColId => {
        if(!orderedIdsSet.has(customColId)) {
            loadedColumnOrder.push(customColId);
        }
    });
    
    if (loadedColumnOrder.length === 0 && Object.keys(loadedColumns).filter(id => id !== 'lixeira').length > 0) {
        loadedColumnOrder = defaultInitialData.columnOrder.filter(id => loadedColumns[id]);
         Object.keys(loadedColumns).filter(id => id !== 'lixeira' && !loadedColumnOrder.includes(id)).forEach(id => loadedColumnOrder.push(id));
    }


    return { columns: loadedColumns, columnOrder: loadedColumnOrder };

  } catch (error) {
    console.error("Could not load state from local storage", error);
    return getInitialKanbanData();
  }
};

export const saveStateToLocalStorage = (state: KanbanState): void => {
  if (typeof window === 'undefined' || !state) return;
  try {
    const stateToSave: KanbanState = JSON.parse(JSON.stringify(state)); // Deep copy

    Object.values(stateToSave.columns).forEach(col => {
      if (!Array.isArray(col.notes)) col.notes = [];
      col.notes = col.notes.map(note => ({
        id: String(note.id || `note-fallback-${Date.now()}-${Math.random()}`),
        content: String(note.content || ''),
        previousColumnId: typeof note.previousColumnId === 'string' ? note.previousColumnId : undefined,
        attachment: typeof note.attachment === 'string' ? note.attachment : undefined,
      })).filter(note => note.id && note.id.startsWith('note-'));
    });

    stateToSave.columnOrder = stateToSave.columnOrder.filter(id => stateToSave.columns[id] && id !== 'lixeira');

    const serializedState = JSON.stringify(stateToSave);
    localStorage.setItem(KANBAN_DATA_KEY, serializedState);
  } catch (error) {
    console.error("Could not save state to local storage", error);
  }
};

export const clearLocalStorage = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(KANBAN_DATA_KEY);
  }
};
