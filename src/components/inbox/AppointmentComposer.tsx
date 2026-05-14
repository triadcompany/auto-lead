import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const APPOINTMENT_TYPES = [
  'Consulta',
  'Retorno',
  'Avaliação',
  'Reunião',
  'Apresentação',
  'Visita',
  'Outro',
];

interface AppointmentComposerProps {
  organizationId: string;
  onSave: (appointment: {
    datetime: string;
    tipo: string;
    duration_minutes?: number;
    anotacoes?: string;
    organization_id: string;
  }) => Promise<void>;
}

export function AppointmentComposer({ organizationId, onSave }: AppointmentComposerProps) {
  const [datetime, setDatetime] = useState('');
  const [tipo, setTipo] = useState('');
  const [customTipo, setCustomTipo] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [duration, setDuration] = useState('');
  const [anotacoes, setAnotacoes] = useState('');
  const [saving, setSaving] = useState(false);

  const resolvedTipo = tipo === 'Outro' ? customTipo.trim() : tipo;
  const canSave = datetime && resolvedTipo;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        datetime: new Date(datetime).toISOString(),
        tipo: resolvedTipo,
        organization_id: organizationId,
        ...(duration ? { duration_minutes: parseInt(duration, 10) } : {}),
        ...(anotacoes.trim() ? { anotacoes: anotacoes.trim() } : {}),
      });
      setDatetime('');
      setTipo('');
      setCustomTipo('');
      setDuration('');
      setAnotacoes('');
      setShowMore(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      <Input
        type="datetime-local"
        value={datetime}
        onChange={(e) => setDatetime(e.target.value)}
        disabled={saving}
      />

      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        disabled={saving}
      >
        <option value="">Tipo de agendamento *</option>
        {APPOINTMENT_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {tipo === 'Outro' && (
        <Input
          placeholder="Descreva o tipo..."
          value={customTipo}
          onChange={(e) => setCustomTipo(e.target.value)}
          disabled={saving}
        />
      )}

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
          <Input
            type="number"
            placeholder="Duração em minutos (opcional)"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            min={1}
            disabled={saving}
          />
          <Textarea
            placeholder="Anotações (opcional)"
            value={anotacoes}
            onChange={(e) => setAnotacoes(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
            disabled={saving}
          />
        </div>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSave || saving}
          className="bg-sky-600 hover:bg-sky-700 text-white"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
          Agendar
        </Button>
      </div>
    </div>
  );
}
