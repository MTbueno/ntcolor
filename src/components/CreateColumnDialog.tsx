
"use client";
import { useState } from 'react';
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pastelColors } from '@/lib/kanban-utils'; // Import pastel colors
import { cn } from '@/lib/utils';

interface CreateColumnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateColumn: (title: string, color: string) => void;
}

export default function CreateColumnDialog({
  isOpen,
  onClose,
  onCreateColumn,
}: CreateColumnDialogProps) {
  const [title, setTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(pastelColors[0]); // Default to the first pastel color

  const handleSubmit = () => {
    if (title.trim() && selectedColor) {
      onCreateColumn(title.trim(), selectedColor);
      setTitle(''); // Reset title
      // setSelectedColor(pastelColors[0]); // Optionally reset color, or keep last selected
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Criar Nova Coluna</AlertDialogTitle>
          <AlertDialogDescription>
            Defina um título e escolha uma cor para sua nova coluna.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="column-title" className="text-right">
              Título
            </Label>
            <Input
              id="column-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="col-span-3"
              placeholder="Ex: Ideias"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">
              Cor
            </Label>
            <div className="col-span-3 grid grid-cols-5 gap-2">
              {pastelColors.map((color) => (
                <Button
                  key={color}
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    selectedColor === color ? 'ring-2 ring-offset-2 ring-primary' : 'hover:opacity-80'
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Selecionar cor ${color}`}
                >
                  {selectedColor === color && <div className="h-3 w-3 rounded-full bg-background opacity-75" />}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={!title.trim()}>
            Criar Coluna
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
