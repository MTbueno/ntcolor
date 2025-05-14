
"use client";
import { useState, useEffect, useMemo } from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import GlobalNoteInput from '@/components/GlobalNoteInput';
import CreateColumnDialog from '@/components/CreateColumnDialog';
import EditColumnsDialog from '@/components/EditColumnsDialog';
import ResetConfirmationDialog from '@/components/ResetConfirmationDialog';
import { useKanbanState } from '@/hooks/useKanbanState';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, LogIn, LogOut, UserCircle, Loader2 } from "lucide-react";
import { clearLocalStorage } from '@/lib/kanban-utils';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


export default function Home() {
  const [noteToCategorize, setNoteToCategorize] = useState<string | null>(null);
  const [isCreateColumnDialogOpen, setIsCreateColumnDialogOpen] = useState(false);
  const [isEditColumnsDialogOpen, setIsEditColumnsDialogOpen] = useState(false);
  const [isResetConfirmationDialogOpen, setIsResetConfirmationDialogOpen] = useState(false);
  
  const { currentUser, signInWithGoogle, signOut: firebaseSignOut, loadingAuth } = useAuth(); // Use AuthContext

  const { 
    kanbanState, 
    isLoaded, // This is now data readiness from useKanbanState
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
    // No explicit reload here, state update should trigger re-render
  };

  const handleReorderColumns = (newOrder: string[]) => {
    reorderColumns(newOrder);
    // No explicit reload here
  };

  const handleUpdateColumn = (columnId: string, title: string, color: string) => {
    updateColumn(columnId, title, color);
    // No explicit reload here
  };

  const handleDeleteColumn = (columnId: string) => {
    deleteColumn(columnId);
    // No explicit reload here
  };

  const handleConfirmResetApp = () => {
    clearLocalStorage(); // Clears local storage specifically
    // If user is logged in, their Firebase data is NOT cleared by this.
    // A separate "clear cloud data" function would be needed.
    // For now, this resets the local anonymous experience.
    window.location.reload(); // Reload to apply reset from local storage
    setIsResetConfirmationDialogOpen(false);
  };


  const displayableColumnsForEditDialog = useMemo(() => {
    if (!isLoaded || !kanbanState) return [];
    return kanbanState.columnOrder
      .filter(id => id !== trashColumnId && kanbanState.columns[id])
      .map(id => ({ ...kanbanState.columns[id] }));
  }, [kanbanState, trashColumnId, isLoaded]);

  const currentOrderForEditDialog = useMemo(() => {
    if (!isLoaded || !kanbanState) return [];
    return kanbanState.columnOrder
      .filter(id => id !== trashColumnId && kanbanState.columns[id]);
  }, [kanbanState, trashColumnId, isLoaded]);

  const handleSignOut = async () => {
    await firebaseSignOut();
    // Optionally, trigger a reload or clear local state further if needed
    // window.location.reload(); // Could be too disruptive, state should adapt
  };

  if (loadingAuth || !isLoaded) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-2 md:p-3 shadow-sm sticky top-0 z-20 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="w-8 h-8 md:w-10 md:h-10"> {/* Placeholder for centering */}
            {currentUser && (
              <Avatar className="h-8 w-8 md:h-10 md:w-10">
                <AvatarImage src={currentUser.photoURL || undefined} alt={currentUser.displayName || "User"} />
                <AvatarFallback>
                  {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : <UserCircle className="h-5 w-5" />}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
          
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
             {currentUser && (
                <p className="text-xs text-muted-foreground mt-1">
                    Logado como: {currentUser.displayName || currentUser.email}
                </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8 md:w-10 md:h-10">
                <MoreVertical className="h-5 w-5" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {currentUser ? (
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={signInWithGoogle}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Login com Google
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsCreateColumnDialogOpen(true)} disabled={!currentUser && false}> {/* Allow create even if not logged in, will use local storage */}
                Criar nova coluna
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditColumnsDialogOpen(true)} disabled={!currentUser && false}>
                Editar colunas
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsResetConfirmationDialogOpen(true)}> 
                Reset App (Local)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      
      <div className="flex-grow flex flex-col overflow-hidden"> 
        <main className="container mx-auto flex-grow flex flex-col py-4 md:py-6 overflow-y-auto pb-32">
          {kanbanState && (
            <KanbanBoard
              noteToSelectCategoryFor={noteToCategorize}
              onDialogClose={handleDialogClose}
              kanbanState={kanbanState}
              isLoaded={isLoaded} // isLoaded here refers to kanban data readiness
              addNoteToColumn={addNoteToColumn}
              deleteNote={deleteNote}
              restoreNote={restoreNote}
              clearTrash={clearTrash}
              handleDragStart={handleDragStart}
              handleDrop={handleDrop}
              addOrUpdateNoteAttachment={addOrUpdateNoteAttachment}
              trashColumnId={trashColumnId}
            />
          )}
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
      
      {isEditColumnsDialogOpen && isLoaded && kanbanState && (
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
