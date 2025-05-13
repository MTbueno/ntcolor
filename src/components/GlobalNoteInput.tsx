
"use client";
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Check } from 'lucide-react';

interface GlobalNoteInputProps {
  onAddNoteRequest: (content: string) => void;
}

export default function GlobalNoteInput({ onAddNoteRequest }: GlobalNoteInputProps) {
  const [content, setContent] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onAddNoteRequest(content.trim());
      setContent('');
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 p-0">
      <div className="container mx-auto max-w-xl mb-4"> {/* Reduced max-width to xl */}
        <div className="bg-[hsl(var(--note-input-bg))] p-3 shadow-lg rounded-lg border border-[hsl(var(--note-input-border))]">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite sua nova nota aqui..."
              className="bg-transparent border-[hsl(var(--note-input-border))] text-[hsl(var(--note-input-foreground))] focus:ring-primary focus:border-primary placeholder:text-[hsl(var(--note-input-placeholder-foreground))] resize-none min-h-[38px] max-h-[100px] h-auto flex-grow text-base" // Changed text-sm to text-base, adjusted min-h
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as FormEvent);
                }
              }}
              aria-label="Nova nota"
            />
            <Button
              type="submit"
              size="sm"
              className="bg-[hsl(var(--note-input-button-bg))] hover:bg-[hsl(var(--note-input-button-bg))]/90 text-[hsl(var(--note-input-button-text))] shrink-0 px-3"
              disabled={!content.trim()}
              aria-label="Adicionar nota"
            >
              <Check className="h-4 w-4 md:mr-1" />
              <span className="hidden md:inline">Adicionar</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

