"use client";
import { useState, useEffect, type DragEvent } from 'react';
import type { ColumnData, ColumnId } from '@/types/kanban';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { GripVertical, Trash2, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pastelColors, initialCoreColumnsData } from '@/lib/kanban-utils'; 

interface EditColumnsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ColumnData[]; 
  currentOrder: ColumnId[]; 
  onReorderColumns: (newOrder: ColumnId[]) => void;
  onUpdateColumn: (columnId: ColumnId, title: string, color: string) => void;
  onDeleteColumn: (columnId: ColumnId) => void;
}

interface EditableColumn extends ColumnData {
  originalIndex: number; 
}

export default function EditColumnsDialog({
  isOpen,
  onClose,
  columns: initialColumns, 
  currentOrder: initialOrder, 
  onReorderColumns,
  onUpdateColumn,
  onDeleteColumn,
}: EditColumnsDialogProps) {
  const [orderedColumns, setOrderedColumns] = useState<EditableColumn[]>([]);
  const [editingColumn, setEditingColumn] = useState<EditableColumn | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editColor, setEditColor] = useState('');
  const [trashColumnId] = useState<ColumnId>('lixeira'); 

  useEffect(() => {
    if (isOpen) {
      const displayableColumns = initialOrder
          .map((id, index) => {
              const column = initialColumns.find(col => col.id === id);
              return column && column.id !== trashColumnId ? { ...column, originalIndex: index } : null;
          })
          .filter(Boolean) as EditableColumn[]; 
      setOrderedColumns(displayableColumns);
    }
  }, [isOpen, initialColumns, initialOrder, trashColumnId]);


  const handleDragStart = (e: DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ index }));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    const transferData = e.dataTransfer.getData('application/json');
    if (!transferData) return;
    
    try {
        const { index: sourceIndex } = JSON.parse(transferData);
        if (sourceIndex === targetIndex) return;

        setOrderedColumns(prev => {
          const newOrder = [...prev];
          const [draggedItem] = newOrder.splice(sourceIndex, 1);
          newOrder.splice(targetIndex, 0, draggedItem);
          return newOrder;
        });
    } catch (error) {
        console.error("Error parsing drag data:", error);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const handleSaveChangesAndClose = () => {
    const newOrderIds = orderedColumns.map(col => col.id);
    onReorderColumns(newOrderIds); 
    onClose();
  };

  const openEditModal = (column: EditableColumn) => {
    setEditingColumn(column);
    setEditTitle(column.title);
    setEditColor(column.color || pastelColors[0]); 
  };

  const handleUpdateColumnDetailsAndCloseModal = () => {
    if (editingColumn) { 
      const coreColumnCanEditTitle = initialCoreColumnsData[editingColumn.id]?.isCustom === true;
      const titleToSave = editingColumn.isCustom || coreColumnCanEditTitle ? editTitle.trim() : editingColumn.title; 
      
      if (titleToSave) { 
         onUpdateColumn(editingColumn.id, titleToSave, editColor); 
      }
      setEditingColumn(null); 
    }
  };
  
  const handleDeleteColumnFromDialogAndCloseModal = (columnId: ColumnId) => {
     onDeleteColumn(columnId); 
     setEditingColumn(null); 
  };


  if (!isOpen) return null;

  return (
    <>
    <AlertDialog open={isOpen && !editingColumn} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Editar Colunas</AlertDialogTitle>
          <AlertDialogDescription>
            Arraste para reordenar. Você pode editar ou excluir colunas customizadas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-2 py-4">
            {orderedColumns.map((column, index) => (
              <div
                key={column.id}
                draggable={true} 
                onDragStart={(e) => handleDragStart(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragOver={handleDragOver}
                className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-accent/50 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                  <span 
                    className="font-medium"
                    style={column.color ? { borderLeft: `4px solid ${column.color}`, paddingLeft: '8px' } : {}}
                  >
                    {column.title}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditModal(column)}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 text-destructive hover:text-destructive" 
                    onClick={() => handleDeleteColumnFromDialogAndCloseModal(column.id)}
                    disabled={!column.isCustom && initialCoreColumnsData[column.id]?.isCustom === false}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSaveChangesAndClose}>
            Salvar Ordem
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {editingColumn && (
         <AlertDialog open={!!editingColumn} onOpenChange={(open) => !open && setEditingColumn(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Editar Coluna: {editingColumn.title}</AlertDialogTitle>
           </AlertDialogHeader>
           <div className="grid gap-4 py-4">
             <div className="grid grid-cols-4 items-center gap-4">
               <Label htmlFor="edit-column-title" className="text-right">
                 Título
               </Label>
               <Input
                 id="edit-column-title"
                 value={editTitle}
                 onChange={(e) => setEditTitle(e.target.value)}
                 className="col-span-3"
                 disabled={!editingColumn.isCustom && initialCoreColumnsData[editingColumn.id]?.isCustom === false} 
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
                       editColor === color ? 'ring-2 ring-offset-2 ring-primary' : 'hover:opacity-80'
                     )}
                     style={{ backgroundColor: color }}
                     onClick={() => setEditColor(color)}
                     aria-label={`Selecionar cor ${color}`}
                   >
                    {editColor === color && <div className="h-3 w-3 rounded-full bg-background opacity-75" />}
                   </Button>
                 ))}
               </div>
             </div>
           </div>
           <AlertDialogFooter>
             <AlertDialogCancel onClick={() => setEditingColumn(null)}>Cancelar</AlertDialogCancel>
             <AlertDialogAction 
                onClick={handleUpdateColumnDetailsAndCloseModal} 
                disabled={(editingColumn.isCustom || initialCoreColumnsData[editingColumn.id]?.isCustom === true) && !editTitle.trim()}
             >
               Salvar Alterações
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
    )}
    </>
  );
}
