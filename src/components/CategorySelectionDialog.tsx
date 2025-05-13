
"use client";
import type { ColumnData, ColumnId } from '@/types/kanban';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface CategorySelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnData[];
  onSelectCategory: (columnId: ColumnId) => void;
}

export default function CategorySelectionDialog({
  isOpen,
  onClose,
  columns,
  onSelectCategory,
}: CategorySelectionDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Escolha uma Categoria</AlertDialogTitle>
          <AlertDialogDescription>
            Em qual coluna você gostaria de adicionar esta nota?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 py-4">
          {columns.map((column) => (
            <Button
              key={column.id}
              onClick={() => onSelectCategory(column.id)}
              variant="outline"
              className="w-full justify-start p-4 h-auto text-left hover:bg-accent hover:text-accent-foreground"
            >
              <div className="flex flex-col">
                <span className="font-semibold">{column.title}</span>
                <span className="text-xs text-muted-foreground">{column.notes.length} nota(s)</span>
              </div>
            </Button>
          ))}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
