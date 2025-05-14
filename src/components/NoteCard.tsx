
"use client";
import type { Note, ColumnId } from '@/types/kanban';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, Undo2, Paperclip } from 'lucide-react';
import type { DragEvent, MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import React, { useState, useMemo } from 'react';
import NoteAttachmentDialog from './NoteAttachmentDialog';


interface NoteCardProps {
  note: Note;
  columnId: ColumnId;
  columnColor?: string; 
  isCustomColumn?: boolean; 
  onDragStart: (e: DragEvent<HTMLDivElement>, noteId: string, sourceColumnId: string) => void;
  onDelete: (noteId: string, columnId: ColumnId) => void;
  onRestore: (noteId: string) => void;
  onAddOrUpdateAttachment: (noteId: string, columnId: ColumnId, attachmentContent: string) => void;
}

function darkenColor(hexcolor: string, percent: number): string {
  if (!hexcolor || hexcolor.length < 7) return hexcolor; 
  try {
    let r = parseInt(hexcolor.slice(1, 3), 16);
    let g = parseInt(hexcolor.slice(3, 5), 16);
    let b = parseInt(hexcolor.slice(5, 7), 16);

    r = Math.max(0, Math.floor(r * (1 - percent / 100)));
    g = Math.max(0, Math.floor(g * (1 - percent / 100)));
    b = Math.max(0, Math.floor(b * (1 - percent / 100)));
    
    const toHex = (c: number) => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  } catch (e) {
    console.warn("Failed to darken color:", hexcolor, e);
    return hexcolor; 
  }
}

function getLinkColorForColumn(columnColor?: string, columnId?: ColumnId): string {
  if (columnColor && columnId !== 'lixeira') {
    // For custom columns with a color, use a slightly darkened version of that color for links
    // or a fixed contrasting color if darkening isn't enough.
    // For now, let's use primary for simplicity, can be refined.
    return 'hsl(var(--primary))'; // Or a processed version of columnColor
  }
  // For default columns, use their specific tag background colors for links
  switch (columnId) {
    case 'importante':
      return 'hsl(var(--column-importante-tag-bg))'; 
    case 'em-processo':
      return 'hsl(var(--column-em-processo-tag-bg))';
    case 'feito':
      return 'hsl(var(--column-feito-tag-bg))';
    default:
      return 'hsl(var(--primary))'; // Fallback for other cases or lixeira (though links in lixeira are less common)
  }
}

function parseContentWithLinks(content: string, linkColor: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  // Regex to find @mentions that are not part of an email address or other characters
  const mentionRegex = /(?<!\S)@([a-zA-Z0-9_]+)/g;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1];
    const fullMention = match[0]; // Includes the "@"
    const startIndex = match.index;

    // Add text before the mention
    if (startIndex > lastIndex) {
      parts.push(content.substring(lastIndex, startIndex));
    }

    // Add the mention as a link
    parts.push(
      <a
        key={`mention-${startIndex}-${username}`} // Unique key for React
        href={`https://instagram.com/${username}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: linkColor }}
        className="hover:underline"
        onClick={(e) => e.stopPropagation()} // Prevent card drag or other parent clicks
      >
        {fullMention}
      </a>
    );
    lastIndex = mentionRegex.lastIndex;
  }

  // Add any remaining text after the last mention
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }
  
  // If no mentions were found, but content exists, return the original content
  if (parts.length === 0 && content) {
    return [content];
  }

  return parts;
}

export default function NoteCard({ note, columnId, columnColor, isCustomColumn, onDragStart, onDelete, onRestore, onAddOrUpdateAttachment }: NoteCardProps) {
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);
  
  const getNoteCardStyles = () => {
    const opacityHex = 'B3'; // 70% opacity (0.7 * 255 = 178.5 -> B3 in hex)
    if (columnColor && columnId !== 'lixeira') {
      // For custom columns, try to use their color with opacity
      const noteBg = darkenColor(columnColor, 10); // Darken slightly for better contrast if needed
      return { style: { backgroundColor: `${noteBg}${opacityHex}` } }; // Apply 70% opacity
    }
    // For default columns, use the HSL variables defined in globals.css
    switch (columnId) {
      case 'importante':
        return { className: `bg-[hsl(var(--note-card-importante-bg))]` };
      case 'em-processo':
        return { className: `bg-[hsl(var(--note-card-em-processo-bg))]` };
      case 'feito':
        return { className: `bg-[hsl(var(--note-card-feito-bg))]` };
      case 'lixeira':
        // Lixeira notes use a specific muted background also defined with opacity
        return { className: `bg-[hsl(var(--note-card-lixeira-bg))] border-muted-foreground/30` };
      default:
        // Fallback for any other column type (should ideally not happen with defined columns)
        // Using card default with applied opacity.
        return { className: `bg-card/${opacityHex.toLowerCase()}` }; 
    }
  };

  const noteCardStyles = getNoteCardStyles();
  const linkColor = getLinkColorForColumn(columnColor, columnId);
  const renderedContent = parseContentWithLinks(note.content, linkColor);

  const attachmentPreview = useMemo(() => {
    if (note.attachment && note.attachment.trim() !== "") {
      const firstLine = note.attachment.split('\n')[0];
      const maxLength = 70; // Max length for the preview line
      return firstLine.length > maxLength ? firstLine.substring(0, maxLength) + '...' : firstLine;
    }
    return null;
  }, [note.attachment]);

  const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent card drag
    onDelete(note.id, columnId);
  };

  const handleRestoreClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent card drag
    onRestore(note.id);
  };

  const handleAttachmentClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setIsAttachmentDialogOpen(true);
  };

  const handleSaveAttachment = (attachmentContent: string) => {
    onAddOrUpdateAttachment(note.id, columnId, attachmentContent);
    setIsAttachmentDialogOpen(false); // Close dialog after saving
  };

  return (
    <>
      <Card
        data-note-id={note.id} // Added data-note-id
        draggable={columnId !== 'lixeira'}
        onDragStart={(e) => columnId !== 'lixeira' && onDragStart(e, note.id, columnId)}
        onDragOver={(e) => e.preventDefault()} // Allow dropping over this card
        className={cn(
          "text-card-foreground shadow-lg hover:shadow-xl transition-shadow duration-200 relative group", 
          columnId !== 'lixeira' ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          noteCardStyles.className // This applies the HSL-based background
        )}
        style={noteCardStyles.style} // This applies hex-based background with opacity
        aria-label={`Nota: ${note.content}`}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between w-full">
            <div className="flex items-start space-x-2 flex-grow min-w-0">
              <div className="h-2 w-2 bg-foreground rounded-full flex-shrink-0 mt-1.5" aria-hidden="true"></div>
              <div className="flex-grow min-w-0"> {/* Wrapper for main content */}
                <p className="text-sm whitespace-pre-wrap break-words text-foreground">
                  {renderedContent.map((part, index) => (
                    <React.Fragment key={index}>{part}</React.Fragment>
                  ))}
                </p>
              </div>
            </div>

            {/* Action Buttons Area - aligned to the start of the note content */}
            <div className="flex items-center space-x-1 ml-2 flex-shrink-0 self-start">
              {columnId !== 'lixeira' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                      "h-7 w-7", // Consistent size
                      note.attachment ? "text-foreground hover:text-foreground/80" : "text-muted-foreground hover:text-muted-foreground/80"
                  )}
                  onClick={handleAttachmentClick}
                  aria-label={note.attachment ? "Ver/Editar anexo" : "Adicionar anexo"}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              )}

              {columnId === 'lixeira' ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground"
                  onClick={handleRestoreClick}
                  aria-label="Restaurar nota"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleDeleteClick}
                  aria-label="Mover para lixeira"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Attachment Preview - also indented */}
          {attachmentPreview && (
            <div className="mt-1.5 pl-4"> {/* Indent preview to align with main text */}
              <p className="text-xs text-foreground opacity-60 break-words">
                {attachmentPreview}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Attachment Dialog - remains unchanged */}
      {isAttachmentDialogOpen && (
        <NoteAttachmentDialog
            isOpen={isAttachmentDialogOpen}
            onClose={() => setIsAttachmentDialogOpen(false)}
            initialContent={note.attachment || ''}
            onSave={handleSaveAttachment}
        />
     )}
    </>
  );
}

