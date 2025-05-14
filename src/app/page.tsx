
"use client";
import { useState, useEffect, useMemo, type FormEvent } from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import GlobalNoteInput from '@/components/GlobalNoteInput';
import CreateColumnDialog from '@/components/CreateColumnDialog';
import EditColumnsDialog from '@/components/EditColumnsDialog';
import ResetConfirmationDialog from '@/components/ResetConfirmationDialog';
import { useKanbanState } from '@/hooks/useKanbanState';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, LogOut, UserCircle, Loader2, AlertCircle } from "lucide-react";
import { clearLocalStorage } from '@/lib/kanban-utils';
import { useAuth } from '@/contexts/AuthContext'; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";


export default function Home() {
  const [noteToCategorize, setNoteToCategorize] = useState<string | null>(null);
  const [isCreateColumnDialogOpen, setIsCreateColumnDialogOpen] = useState(false);
  const [isEditColumnsDialogOpen, setIsEditColumnsDialogOpen] = useState(false);
  const [isResetConfirmationDialogOpen, setIsResetConfirmationDialogOpen] = useState(false);
  
  const { 
    currentUser, 
    signIn, 
    signUp, 
    signOut: firebaseSignOut, 
    loadingAuth,
    resetPassword,
    mapAuthCodeToMessage
  } = useAuth();

  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  };

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthMessage(null);
    setIsSubmitting(true);
    try {
      if (authMode === 'login') {
        await signIn(email, password);
      } else if (authMode === 'signup') {
        await signUp(email, password);
      } else if (authMode === 'reset') {
        await resetPassword(email);
        setAuthMessage("Email de redefinição de senha enviado! Verifique sua caixa de entrada.");
      }
    } catch (error: any) {
       setAuthError(error.message || "Ocorreu um erro.");
    } finally {
      setIsSubmitting(false);
      if (authMode !== 'reset') { // Não limpar campos se for reset bem sucedido
        setEmail('');
        setPassword('');
      } else if (!authError) { // Limpar email se reset for bem sucedido
        setEmail('');
      }
    }
  };


  if (loadingAuth || !isLoaded && currentUser) { // Apenas mostrar loading se houver usuário e dados não carregados
    return (
      <div className="flex flex-col h-screen bg-background text-foreground items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-lg">Carregando...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground items-center justify-center p-4">
        <div className="flex flex-col items-center mb-8">
            <p className="text-xs text-muted-foreground mb-0">Design by Murillo Bueno</p>
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
        <Card className="w-full max-w-sm shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {authMode === 'login' ? 'Entrar' : authMode === 'signup' ? 'Registrar' : 'Redefinir Senha'}
            </CardTitle>
            <CardDescription className="text-center">
              {authMode === 'login' ? 'Acesse sua conta para continuar.' : authMode === 'signup' ? 'Crie uma nova conta.' : 'Insira seu email para redefinir a senha.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="seu@email.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  className="mt-1"
                />
              </div>
              {authMode !== 'reset' && (
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="********" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                    className="mt-1"
                  />
                </div>
              )}
              {authError && (
                <p className="text-sm text-destructive flex items-center"><AlertCircle className="w-4 h-4 mr-1" />{authError}</p>
              )}
              {authMessage && (
                <p className="text-sm text-green-600">{authMessage}</p>
              )}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : 
                 authMode === 'login' ? 'Entrar' : authMode === 'signup' ? 'Registrar' : 'Enviar Email'}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              {authMode === 'login' && (
                <>
                  Não tem uma conta?{' '}
                  <Button variant="link" onClick={() => { setAuthMode('signup'); setAuthError(null); setAuthMessage(null); }} className="p-0 h-auto">
                    Registre-se
                  </Button>
                  <br />
                  <Button variant="link" onClick={() => { setAuthMode('reset'); setAuthError(null); setAuthMessage(null); }} className="p-0 h-auto mt-2">
                    Esqueceu a senha?
                  </Button>
                </>
              )}
              {authMode === 'signup' && (
                <>
                  Já tem uma conta?{' '}
                  <Button variant="link" onClick={() => { setAuthMode('login'); setAuthError(null); setAuthMessage(null); }} className="p-0 h-auto">
                    Entrar
                  </Button>
                </>
              )}
              {authMode === 'reset' && (
                 <Button variant="link" onClick={() => { setAuthMode('login'); setAuthError(null); setAuthMessage(null); }} className="p-0 h-auto mt-2">
                    Voltar para Login
                  </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-2 md:p-3 shadow-sm sticky top-0 z-20 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div className="w-8 h-8 md:w-10 md:h-10">
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
                // Opção de login removida daqui, pois o formulário é mostrado se não logado
                <DropdownMenuItem disabled>Entrar/Registrar</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsCreateColumnDialogOpen(true)} disabled={!currentUser && false}>
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
          {kanbanState && isLoaded && ( // Adicionado isLoaded aqui também
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
