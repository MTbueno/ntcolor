"use client";
import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
// Button component is not directly used here based on the provided structure, 
// AlertDialogAction and AlertDialogCancel are used instead.

interface NoteAttachmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialContent?: string;
  onSave: (content: string) => void;
}

export default function NoteAttachmentDialog({
  isOpen,
  onClose,
  initialContent = '',
  onSave,
}: NoteAttachmentDialogProps) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent]);

  const handleSave = () => {
    onSave(content);
    // onClose(); // Closing is handled by onSave in the parent or by onOpenChange
  };

  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anexar Nota/Links</AlertDialogTitle>
          <AlertDialogDescription>
            Adicione informações ou links relacionados a esta nota.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite sua anotação ou cole links aqui..."
            className="min-h-[100px] bg-background text-foreground border-input"
            aria-label="Conteúdo do anexo"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave}>Salvar Anexo</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
