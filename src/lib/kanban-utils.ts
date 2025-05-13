
import type { KanbanState, ColumnId, ColumnData, Note } from '@/types/kanban';

export const KANBAN_DATA_KEY = 'kanbanflow-data';

// Helper function to create a new note object for initial data
const createInitialNote = (id: string, content: string, attachment?: string): Note => ({
  id,
  content,
  previousColumnId: undefined, // Default notes don't have a previous column in this context
  attachment,
});

// --- Defina as Notas Padrão Aqui ---
// Para definir as notas padrão que aparecem quando o aplicativo é resetado ou
// aberto pela primeira vez (se não houver dados no localStorage):
//
// 1. Identifique a coluna desejada (ex: 'importante', 'em-processo', 'feito').
// 2. Adicione objetos de nota ao array 'notes' da respectiva coluna.
//    Utilize a função auxiliar `createInitialNote(id, content, attachment?)`.
//    - 'id': Deve ser uma string única para cada nota (ex: 'note-default-1').
//    - 'content': O texto principal da nota.
//    - 'attachment' (opcional): Qualquer texto ou link para o anexo da nota.
//
// Exemplo de como adicionar uma nota padrão à coluna 'importante':
//
// notes: [
//   createInitialNote('minha-nota-padrao-1', 'Conteúdo da nota padrão.', 'Algum anexo opcional aqui.'),
//   createInitialNote('minha-nota-padrao-2', 'Outra nota padrão.')
// ],

export const initialCoreColumnsData: Record<string, ColumnData> = {
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
    isCustom: false, // Indica que esta é uma coluna principal (não personalizada pelo usuário)
    color: '#A93226', // Cor padrão para 'Importante'
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
    color: '#9A7D0A', // Cor padrão para 'Em processo'
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
    color: '#1E8449', // Cor padrão para 'Feito'
  },
  'lixeira': { // A coluna Lixeira geralmente começa vazia
    id: 'lixeira',
    title: 'Lixeira',
    notes: [],
    isCustom: false,
    // color: undefined, // Ou uma cor neutra se desejar estilizar
  },
};

// A ordem em que as colunas principais (excluindo a Lixeira) aparecem por padrão.
// A Lixeira é normalmente tratada separadamente e exibida por último.
export const initialColumnOrder: ColumnId[] = ['importante', 'em-processo', 'feito'];

// Cores pastel para a criação de novas colunas personalizadas
export const pastelColors: string[] = [
  '#A93226', '#AF601A', '#9A7D0A', '#1E8449', '#17A589',
  '#2471A3', '#6C3483', '#B977A4', '#795548', '#455A64',
];


export const loadStateFromLocalStorage = (): KanbanState | undefined => {
  if (typeof window === 'undefined') return undefined;

  const getCleanDefaultState = (): KanbanState => ({
    // Utiliza uma cópia profunda para evitar que modificações em initialCoreColumnsData afetem chamadas subsequentes
    columns: JSON.parse(JSON.stringify(initialCoreColumnsData)),
    columnOrder: [...initialColumnOrder], // Utiliza uma cópia da ordem inicial
  });

  try {
    const serializedState = localStorage.getItem(KANBAN_DATA_KEY);
    if (serializedState === null) {
      const defaultState = getCleanDefaultState();
      saveStateToLocalStorage(defaultState);
      return defaultState;
    }

    const storedState: Partial<KanbanState> = JSON.parse(serializedState);
    const loadedColumns: Record<ColumnId, ColumnData> = {};
    let loadedColumnOrder: ColumnId[] = [];

    // Carrega colunas do localStorage e garante que as propriedades essenciais existam
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
            })).filter(note => note.id && note.id.startsWith('note-')) : [], // Garante que notas sejam válidas
            color: storedCol.color || (initialCoreColumnsData[colId] ? initialCoreColumnsData[colId].color : undefined),
            isCustom: storedCol.isCustom !== undefined
                        ? storedCol.isCustom
                        : (initialCoreColumnsData[colId] ? initialCoreColumnsData[colId].isCustom : true),
          };
        }
      }
    }

    // Garante que todas as colunas principais (definidas em initialCoreColumnsData) existam.
    // Se uma coluna principal estiver faltando no localStorage, ela é adicionada a partir da definição padrão.
    // Também sincroniza propriedades não personalizáveis como 'isCustom' e 'title' (se não for customizável).
    for (const coreColId in initialCoreColumnsData) {
      if (!loadedColumns[coreColId]) {
        loadedColumns[coreColId] = JSON.parse(JSON.stringify(initialCoreColumnsData[coreColId]));
      } else {
         const defaultCoreCol = initialCoreColumnsData[coreColId];
         if (defaultCoreCol) {
             loadedColumns[coreColId].isCustom = defaultCoreCol.isCustom;
             // Only update title if it's a core, non-customizable column and the stored title differs
             // OR if the loaded column IS marked as custom but the default definition says it SHOULDN'T be.
             if (!defaultCoreCol.isCustom && loadedColumns[coreColId].title !== defaultCoreCol.title) {
                 loadedColumns[coreColId].title = defaultCoreCol.title;
             }
             if (!loadedColumns[coreColId].color && defaultCoreCol.color) {
                 loadedColumns[coreColId].color = defaultCoreCol.color;
             }
         }
      }
    }

    // Tratamento específico para a Lixeira, garantindo sua integridade.
    if (!loadedColumns.lixeira || typeof loadedColumns.lixeira.notes === 'undefined') {
      loadedColumns.lixeira = JSON.parse(JSON.stringify(initialCoreColumnsData.lixeira));
    } else {
      loadedColumns.lixeira.title = initialCoreColumnsData.lixeira.title;
      loadedColumns.lixeira.isCustom = initialCoreColumnsData.lixeira.isCustom;
      loadedColumns.lixeira.color = initialCoreColumnsData.lixeira.color;
      loadedColumns.lixeira.notes = Array.isArray(loadedColumns.lixeira.notes) ? loadedColumns.lixeira.notes.map(note => ({
            id: String(note.id || `note-fallback-${Date.now()}-${Math.random()}`),
            content: String(note.content || ''),
            previousColumnId: typeof note.previousColumnId === 'string' ? note.previousColumnId : undefined,
            attachment: typeof note.attachment === 'string' ? note.attachment : undefined,
        })).filter(note => note.id && note.id.startsWith('note-')) : [];
    }

    // Remove notas duplicadas dentro de cada coluna (baseado no ID da nota)
    Object.keys(loadedColumns).forEach(colId => {
        const col = loadedColumns[colId];
        const uniqueNotesMap = new Map<string, Note>();
        if (Array.isArray(col.notes)) {
            for (const note of col.notes) {
                if (!uniqueNotesMap.has(note.id)) {
                    uniqueNotesMap.set(note.id, note);
                } else {
                    // console.warn(`Duplicate note ID '${note.id}' found in column '${col.id}' during load. Keeping first instance.`);
                }
            }
            loadedColumns[colId].notes = Array.from(uniqueNotesMap.values());
        } else {
          loadedColumns[colId].notes = []; // Garante que 'notes' seja sempre um array
        }
    });

    // Valida e constrói a ordem das colunas
    if (storedState.columnOrder && Array.isArray(storedState.columnOrder)) {
      loadedColumnOrder = storedState.columnOrder.filter(id => loadedColumns[id] && id !== 'lixeira');
    }

    const orderedIdsSet = new Set(loadedColumnOrder);
    const allLoadedNonTrashIds = Object.keys(loadedColumns).filter(id => id !== 'lixeira');

    // Garante que as colunas principais estejam na ordem e presentes, se existirem
    initialColumnOrder.forEach(coreId => {
      if (loadedColumns[coreId] && !orderedIdsSet.has(coreId)) {
        // Add to the correct position if possible, otherwise append
        const initialIndex = initialColumnOrder.indexOf(coreId);
        let inserted = false;
        for (let i = 0; i < loadedColumnOrder.length; i++) {
            const currentLoadedColId = loadedColumnOrder[i];
            const currentLoadedColInitialIndex = initialColumnOrder.indexOf(currentLoadedColId);
            if (currentLoadedColInitialIndex > initialIndex) {
                loadedColumnOrder.splice(i, 0, coreId);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            loadedColumnOrder.push(coreId);
        }
        orderedIdsSet.add(coreId);
      }
    });

    // Adiciona quaisquer outras colunas carregadas que não sejam lixeira e não estejam na ordem ainda (custom columns)
    allLoadedNonTrashIds.forEach(id => {
      if (!orderedIdsSet.has(id) && !initialCoreColumnsData[id]) { // Ensure it's not a core column already handled
        loadedColumnOrder.push(id);
      }
    });

    // Se a ordem carregada estiver vazia mas houver colunas, tenta reconstruir a partir da ordem inicial
    if (loadedColumnOrder.length === 0 && allLoadedNonTrashIds.length > 0) {
        loadedColumnOrder = allLoadedNonTrashIds.filter(id => initialColumnOrder.includes(id));
        allLoadedNonTrashIds.forEach(id => {
            if (!loadedColumnOrder.includes(id)) {
                loadedColumnOrder.push(id);
            }
        });
    }

    return { columns: loadedColumns, columnOrder: loadedColumnOrder };

  } catch (error) {
    console.error("Could not load state from local storage", error);
    return getCleanDefaultState(); // Retorna o estado padrão limpo em caso de erro
  }
};

export const saveStateToLocalStorage = (state: KanbanState): void => {
  if (typeof window === 'undefined') return;
  try {
    // Cria uma cópia profunda do estado para evitar mutações diretas no estado da aplicação
    const stateToSave: KanbanState = JSON.parse(JSON.stringify(state));

    // Garante que todas as notas sejam válidas e tenham IDs antes de salvar
    Object.values(stateToSave.columns).forEach(col => {
      if (!Array.isArray(col.notes)) {
        col.notes = [];
      }
      col.notes = col.notes.map(note => ({
        id: String(note.id || `note-fallback-${Date.now()}-${Math.random()}`),
        content: String(note.content || ''),
        previousColumnId: typeof note.previousColumnId === 'string' ? note.previousColumnId : undefined,
        attachment: typeof note.attachment === 'string' ? note.attachment : undefined,
      })).filter(note => note.id && note.id.startsWith('note-'));
    });

    // Garante que a ordem das colunas não inclua a lixeira e apenas colunas existentes
    stateToSave.columnOrder = stateToSave.columnOrder.filter(id => stateToSave.columns[id] && id !== 'lixeira');

    const serializedState = JSON.stringify(stateToSave);
    localStorage.setItem(KANBAN_DATA_KEY, serializedState);
  } catch (error) {
    console.error("Could not save state to local storage", error);
  }
};


export const clearLocalStorage = (): void => {
  if (typeof window !== 'undefined')
    localStorage.removeItem(KANBAN_DATA_KEY);
}
