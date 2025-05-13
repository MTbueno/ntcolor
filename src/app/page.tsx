
"use client";
import { useState, useEffect, useMemo } from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import GlobalNoteInput from '@/components/GlobalNoteInput';
import CreateColumnDialog from '@/components/CreateColumnDialog';
import EditColumnsDialog from '@/components/EditColumnsDialog';
import ResetConfirmationDialog from '@/components/ResetConfirmationDialog'; // Import the new dialog
import { useKanbanState } from '@/hooks/useKanbanState';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { clearLocalStorage } from '@/lib/kanban-utils';


export default function Home() {
  const [noteToCategorize, setNoteToCategorize] = useState<string | null>(null);
  const [isCreateColumnDialogOpen, setIsCreateColumnDialogOpen] = useState(false);
  const [isEditColumnsDialogOpen, setIsEditColumnsDialogOpen] = useState(false);
  const [isResetConfirmationDialogOpen, setIsResetConfirmationDialogOpen] = useState(false); // State for reset confirmation
  
  const { 
    kanbanState, 
    isLoaded,
    createColumn, 
    reorderColumns, 
    updateColumn, 
    deleteColumn, 
    addNoteToColumn,
    deleteNote,
    restoreNote,
    clearTrash,
    handleDragStart,
    handleDrop,
    addOrUpdateNoteAttachment,
    trashColumnId 
   } = useKanbanState();


  const handleInitiateAddNote = (content: string) => {
    if (content.trim()) {
      setNoteToCategorize(content);
    }
  };

  const handleDialogClose = () => {
    setNoteToCategorize(null);
  };

  const handleCreateColumn = (title: string, color: string) => {
    createColumn(title, color); 
  };

  const handleReorderColumns = (newOrder: string[]) => {
    reorderColumns(newOrder); 
  };

  const handleUpdateColumn = (columnId: string, title: string, color: string) => {
    updateColumn(columnId, title, color);
  };

  const handleDeleteColumn = (columnId: string) => {
    deleteColumn(columnId);
  };

  const handleConfirmResetApp = () => {
    clearLocalStorage();
    window.location.reload();
    setIsResetConfirmationDialogOpen(false); // Close dialog after reset
  };


  const displayableColumnsForEditDialog = useMemo(() => {
    if (!isLoaded) return [];
    return kanbanState.columnOrder
      .filter(id => id !== trashColumnId && kanbanState.columns[id])
      .map(id => ({ ...kanbanState.columns[id] }));
  }, [kanbanState.columns, kanbanState.columnOrder, trashColumnId, isLoaded]);

  const currentOrderForEditDialog = useMemo(() => {
    if (!isLoaded) return [];
    return kanbanState.columnOrder
      .filter(id => id !== trashColumnId && kanbanState.columns[id]);
  }, [kanbanState.columnOrder, kanbanState.columns, trashColumnId, isLoaded]);


  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-2 md:p-3 shadow-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="w-8 h-8 md:w-10 md:h-10"></div> {/* Placeholder for centering */}
          
          <div className="flex flex-col items-center">
            <p className="text-xs text-muted-foreground mb-0">
              Design by Murillo Bueno
            </p>
            <div className="flex items-end">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight mt-0">
                <span>Note.</span>
                <span style={{ color: '#FF6347' }}>C</span>
                <span style={{ color: '#FFA07A' }}>o</span>
                <span style={{ color: '#FFD700' }}>l</span>
                <span style={{ color: '#FFEE93' }}>o</span>
                <span style={{ color: '#FFFACD' }}>r</span>
                <span style={{ color: '#FFFFE0' }}>s</span>
              </h1>
              <span className="text-xs text-muted-foreground ml-1 mb-1">beta</span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8 md:w-10 md:h-10">
                <MoreVertical className="h-5 w-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsCreateColumnDialogOpen(true)}>
                Criar nova coluna
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditColumnsDialogOpen(true)}>
                Editar colunas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsResetConfirmationDialogOpen(true)}> {/* Open confirmation dialog */}
                Reset App
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      
      <div className="flex-grow flex flex-col overflow-hidden"> 
        <main className="container mx-auto flex-grow flex flex-col py-4 md:py-6 overflow-y-auto pb-32">
          <KanbanBoard
            noteToSelectCategoryFor={noteToCategorize}
            onDialogClose={handleDialogClose}
            kanbanState={kanbanState}
            isLoaded={isLoaded}
            addNoteToColumn={addNoteToColumn}
            deleteNote={deleteNote}
            restoreNote={restoreNote}
            clearTrash={clearTrash}
            handleDragStart={handleDragStart}
            handleDrop={handleDrop}
            addOrUpdateNoteAttachment={addOrUpdateNoteAttachment}
            trashColumnId={trashColumnId}
          />
        </main>
        <GlobalNoteInput onAddNoteRequest={handleInitiateAddNote} />
      </div>


      {isCreateColumnDialogOpen && (
        <CreateColumnDialog
          isOpen={isCreateColumnDialogOpen}
          onClose={() => setIsCreateColumnDialogOpen(false)}
          onCreateColumn={handleCreateColumn}
        />
      )}
      
      {isEditColumnsDialogOpen && isLoaded && (
        <EditColumnsDialog
          isOpen={isEditColumnsDialogOpen}
          onClose={() => setIsEditColumnsDialogOpen(false)}
          columns={displayableColumnsForEditDialog} 
          currentOrder={currentOrderForEditDialog}   
          onReorderColumns={handleReorderColumns}
          onUpdateColumn={handleUpdateColumn}
          onDeleteColumn={handleDeleteColumn}
        />
      )}

      {isResetConfirmationDialogOpen && (
        <ResetConfirmationDialog
          isOpen={isResetConfirmationDialogOpen}
          onClose={() => setIsResetConfirmationDialogOpen(false)}
          onConfirm={handleConfirmResetApp}
        />
      )}
    </div>
  );
}
