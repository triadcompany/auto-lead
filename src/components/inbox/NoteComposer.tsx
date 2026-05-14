import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface NoteComposerProps {
  onSave: (content: string) => Promise<void>;
}

export function NoteComposer({ onSave }: NoteComposerProps) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      setContent('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <Textarea
        placeholder="Nota interna... (visível só para a equipe)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[80px] resize-none text-sm"
        disabled={saving}
      />
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!content.trim() || saving}
          className="bg-amber-500 hover:bg-amber-600 text-white"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Salvar nota
        </Button>
      </div>
    </div>
  );
}
