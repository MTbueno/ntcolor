
"use client";
import type { ColumnData, ColumnId } from '@/types/kanban';
import NoteCard from './NoteCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { DragEvent } from 'react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Trash2 } from 'lucide-react'; 

interface KanbanColumnProps {
  column: ColumnData;
  handleDragStart: (e: DragEvent<HTMLDivElement>, noteId: string, sourceColumnId: string) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>, targetColumnId: ColumnId) => void;
  onDeleteNote: (noteId: string, columnId: ColumnId) => void;
  onRestoreNote: (noteId: string) => void;
  onClearTrash: () => void; 
  onAddOrUpdateAttachment: (noteId: string, columnId: ColumnId, attachmentContent: string) => void;
}

// Helper function to get a contrasting text color (black or white)
function getContrastColor(hexcolor: string): string {
  if (!hexcolor || hexcolor.length < 7) return '#FFFFFF'; // Default to white for invalid/short hex
  try {
    const r = parseInt(hexcolor.slice(1, 3), 16);
    const g = parseInt(hexcolor.slice(3, 5), 16);
    const b = parseInt(hexcolor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#FFFFFF';
  } catch (e) {
    return '#FFFFFF'; // Default to white on error
  }
}


export default function KanbanColumn({ 
  column, 
  handleDragStart, 
  handleDrop, 
  onDeleteNote, 
  onRestoreNote, 
  onClearTrash,
  onAddOrUpdateAttachment
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(column.id === 'lixeira' ? false : true); 

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (column.id === 'lixeira') {
      e.preventDefault(); 
      return; 
    }
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    setIsDragOver(false);
  };

  const onDropInternal = (e: DragEvent<HTMLDivElement>) => {
    if (column.id === 'lixeira') { 
        e.preventDefault();
        return;
    }
    handleDrop(e, column.id);
    setIsDragOver(false);
  };

  const getColumnStyles = (col: ColumnData) => {
    const baseOpacity = '33'; // 20% opacity
    if (col.color && col.id !== 'lixeira') {
      const tagTextColor = getContrastColor(col.color);
      return {
        bgStyle: { backgroundColor: `${col.color}${baseOpacity}` }, 
        tagStyle: { backgroundColor: col.color, color: tagTextColor },
        isCustomStyled: true, 
      };
    }
    // Define HSL based styles for default columns
    switch (col.id) {
      case 'importante':
        return {
          bgClass: `bg-[hsl(var(--column-importante-bg))]`, 
          tagBgClass: 'bg-[hsl(var(--column-importante-tag-bg))]',
          tagTextClass: 'text-[hsl(var(--column-importante-tag-text))]',
        };
      case 'em-processo':
        return {
          bgClass: `bg-[hsl(var(--column-em-processo-bg))]`,
          tagBgClass: 'bg-[hsl(var(--column-em-processo-tag-bg))]',
          tagTextClass: 'text-[hsl(var(--column-em-processo-tag-text))]',
        };
      case 'feito':
        return {
          bgClass: `bg-[hsl(var(--column-feito-bg))]`,
          tagBgClass: 'bg-[hsl(var(--column-feito-tag-bg))]',
          tagTextClass: 'text-[hsl(var(--column-feito-tag-text))]',
        };
      case 'lixeira':
        return {
          bgClass: 'bg-muted/20 border border-dashed border-muted-foreground/30', 
          tagBgClass: 'bg-muted hover:bg-muted/80', 
          tagTextClass: 'text-muted-foreground', 
        };
      default: 
        return { bgClass: `bg-card/20`, tagBgClass: 'bg-primary', tagTextClass: 'text-primary-foreground' };
    }
  };

  const styles = getColumnStyles(column);

  if (column.id === 'lixeira') {
    return (
      <Accordion type="single" collapsible value={isTrashOpen ? "trash-item" : ""} onValueChange={(value) => setIsTrashOpen(!!value)}>
        <AccordionItem value="trash-item" className={cn("border-none rounded-lg overflow-hidden shadow-sm mb-4", styles.bgClass)} style={styles.bgStyle}>
          <div className="p-0"> 
            <AccordionTrigger
              className={cn(
                "flex items-center justify-between w-full gap-2 p-3 md:p-4 font-medium hover:no-underline focus:outline-none",
                styles.tagBgClass,
                styles.tagTextClass,
                "hover:bg-accent/10" // Adicionado para consistência de hover
              )}
              style={styles.tagStyle} 
              aria-label={isTrashOpen ? "Ocultar Lixeira" : "Mostrar Lixeira"}
            >
              <div className="flex items-center gap-2 flex-grow"> 
                <Trash2 className="h-5 w-5" />
                <span id={`column-title-${column.id}`} className="text-base font-semibold">
                  {column.title}
                </span>
              </div>
              <div className="flex items-center shrink-0"> 
                {isTrashOpen && column.notes.length > 0 && (
                    <Button
                        asChild 
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onClearTrash(); }}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive px-2 py-1 h-auto mr-2"
                        aria-label="Limpar Lixeira"
                    >
                        <span className="inline-flex items-center cursor-pointer">
                            <Trash2 className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Limpar Lixeira</span>
                        </span>
                    </Button>
                )}
                <Badge
                  variant="secondary"
                  className="text-sm font-medium text-[hsl(var(--column-count-text))] bg-transparent px-2 py-0.5"
                >
                  {column.notes.length}
                </Badge>
              </div>
            </AccordionTrigger>
          </div>
          
          <AccordionContent
             className="flex flex-col" // Torna o container interno do AccordionContent um flex container
             onDragOver={(e) => e.preventDefault()} 
             onDrop={(e) => e.preventDefault()} 
          >
            {/* 
              A classe `flex-grow` permite que ScrollArea tente preencher o espaço.
              `min-h-0` é importante para flex children com max-height para permitir que encolham.
              `max-h-[calc(60vh-theme(spacing.8))]` (aproximadamente 60vh menos o padding de AccordionContent)
              ou uma altura mais fixa como `max-h-[300px]` ou `max-h-[400px]` pode ser mais previsível.
              Testaremos com 60vh, mas se for necessário, subtrair o padding vertical do AccordionContent (pb-4, pt-0) pode ajudar.
              O padding padrão de AccordionContent é pb-4 (1rem), pt-0.
            */}
            <ScrollArea className="flex-grow min-h-0 max-h-[60vh]"> 
              <div className="p-3 md:p-4 space-y-3"> {/* Padding já estava aqui, mantido. Removido min-h daqui */}
                {column.notes.length === 0 && (
                  <p className="text-sm text-muted-foreground italic text-center py-4">A lixeira está vazia.</p>
                )}
                {column.notes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    columnId={column.id}
                    columnColor={column.color} 
                    isCustomColumn={column.isCustom} 
                    onDragStart={handleDragStart}
                    onDelete={onDeleteNote}
                    onRestore={onRestoreNote}
                    onAddOrUpdateAttachment={onAddOrUpdateAttachment}
                  />
                ))}
              </div>
            </ScrollArea>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col w-full rounded-lg shadow-lg overflow-hidden",
        styles.bgClass, 
        isDragOver ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      )}
      style={styles.bgStyle} 
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDropInternal}
      aria-labelledby={`column-title-${column.id}`}
    >
      <div className="p-3 md:p-4">
        <div className="flex justify-between items-center gap-2">
          <Badge
             id={`column-title-${column.id}`}
             variant="secondary" 
             className={cn(
               "text-base font-semibold px-3 py-1 border-transparent",
               styles.tagBgClass, 
               styles.tagTextClass 
             )}
             style={styles.tagStyle} 
           >
            {column.title}
          </Badge>
          <span className="text-sm font-medium text-[hsl(var(--column-count-text))] px-1">
            {column.notes.length}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-grow"> {/* Para colunas normais, flex-grow deve funcionar bem */}
         <div className="p-3 md:p-4 space-y-3 min-h-[100px]">
          {column.notes.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-4">Nenhuma nota nesta coluna.</p>
          )}
          {column.notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              columnId={column.id}
              columnColor={column.color} 
              isCustomColumn={column.isCustom} 
              onDragStart={handleDragStart}
              onDelete={onDeleteNote}
              onRestore={onRestoreNote}
              onAddOrUpdateAttachment={onAddOrUpdateAttachment}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

