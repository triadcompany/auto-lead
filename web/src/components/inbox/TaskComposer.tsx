import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface OrgMember {
  id: string;
  name: string;
}

interface TaskComposerProps {
  orgMembers: OrgMember[];
  organizationId: string;
  onSave: (task: {
    titulo: string;
    data_hora: string;
    descricao?: string;
    prioridade?: 'baixa' | 'media' | 'alta';
    responsavel_id?: string;
    organization_id: string;
  }) => Promise<void>;
}

export function TaskComposer({ orgMembers, organizationId, onSave }: TaskComposerProps) {
  const [titulo, setTitulo] = useState('');
  const [dataHora, setDataHora] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<'baixa' | 'media' | 'alta' | ''>('');
  const [responsavelId, setResponsavelId] = useState('');
  const [saving, setSaving] = useState(false);

  const canSave = titulo.trim() && dataHora;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        titulo: titulo.trim(),
        data_hora: new Date(dataHora).toISOString(),
        organization_id: organizationId,
        ...(descricao.trim() ? { descricao: descricao.trim() } : {}),
        ...(prioridade ? { prioridade } : {}),
        ...(responsavelId ? { responsavel_id: responsavelId } : {}),
      });
      setTitulo('');
      setDataHora('');
      setDescricao('');
      setPrioridade('');
      setResponsavelId('');
      setShowMore(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <Input
        placeholder="Título da tarefa *"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        disabled={saving}
      />
      <Input
        type="datetime-local"
        value={dataHora}
        onChange={(e) => setDataHora(e.target.value)}
        disabled={saving}
      />

      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
        onClick={() => setShowMore(!showMore)}
      >
        {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        Mais opções
      </button>

      {showMore && (
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Descrição (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
            disabled={saving}
          />
          <div className="flex gap-2">
            <Select value={prioridade} onValueChange={(v) => setPrioridade(v as any)} disabled={saving}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={responsavelId}
              onValueChange={setResponsavelId}
              disabled={saving || orgMembers.length === 0}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={orgMembers.length === 0 ? 'Atribuído a você' : 'Responsável'} />
              </SelectTrigger>
              {orgMembers.length > 0 && (
                <SelectContent>
                  {orgMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              )}
            </Select>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Criar tarefa
        </Button>
      </div>
    </div>
  );
}
