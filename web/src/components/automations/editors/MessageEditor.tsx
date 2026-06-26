import React, { useRef } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Type, Image, Mic, Video, FileText } from "lucide-react";

interface MessageEditorProps {
  config: any;
  onChange: (config: any) => void;
}

const MESSAGE_TYPES = [
  { value: "text",     label: "Texto",     icon: Type },
  { value: "image",    label: "Imagem",    icon: Image },
  { value: "audio",    label: "Áudio",     icon: Mic },
  { value: "video",    label: "Vídeo",     icon: Video },
  { value: "document", label: "Documento", icon: FileText },
] as const;

type MessageType = typeof MESSAGE_TYPES[number]["value"];

const VARIABLES = [
  { key: "{{lead.name}}" },
  { key: "{{lead.phone}}" },
  { key: "{{lead.email}}" },
  { key: "{{lead.source}}" },
  { key: "{{org.name}}" },
];

function VariablesRow({ onInsert }: { onInsert: (v: string) => void }) {
  return (
    <div>
      <Label className="font-poppins text-xs text-muted-foreground">Variáveis</Label>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {VARIABLES.map((v) => (
          <Badge
            key={v.key}
            variant="outline"
            className="cursor-pointer hover:bg-accent text-xs font-poppins"
            onClick={() => onInsert(v.key)}
          >
            {v.key}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function ButtonsSection({
  buttons,
  onAdd,
  onUpdate,
  onRemove,
}: {
  buttons: Array<{ label: string; payload: string }>;
  onAdd: () => void;
  onUpdate: (i: number, field: "label" | "payload", value: string) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="font-poppins text-sm font-medium">Botões (opcional)</Label>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
      </div>
      {buttons.length > 0 && (
        <div className="space-y-2 mt-2">
          {buttons.map((btn, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <Input
                  placeholder="Texto do botão"
                  className="h-8 text-xs"
                  value={btn.label}
                  onChange={(e) => onUpdate(i, "label", e.target.value)}
                />
                <Input
                  placeholder="Payload (ex: sim, nao)"
                  className="h-8 text-xs"
                  value={btn.payload}
                  onChange={(e) => onUpdate(i, "payload", e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive shrink-0"
                onClick={() => onRemove(i)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MessageEditor({ config, onChange }: MessageEditorProps) {
  const messageType: MessageType = config.messageType || "text";
  const buttons: Array<{ label: string; payload: string }> = config.buttons || [];
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setType = (type: MessageType) => onChange({ ...config, messageType: type });

  const insertVariable = (variable: string) => {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? (config.text || "").length;
      const end = el.selectionEnd ?? start;
      const text = config.text || "";
      const newText = text.slice(0, start) + variable + text.slice(end);
      onChange({ ...config, text: newText });
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + variable.length;
        el.focus();
      }, 0);
    } else {
      onChange({ ...config, text: (config.text || "") + variable });
    }
  };

  const addButton = () =>
    onChange({ ...config, buttons: [...buttons, { label: "", payload: "" }] });

  const updateButton = (i: number, field: "label" | "payload", value: string) =>
    onChange({ ...config, buttons: buttons.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)) });

  const removeButton = (i: number) =>
    onChange({ ...config, buttons: buttons.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div>
        <Label className="font-poppins text-xs text-muted-foreground mb-2 block">Tipo de conteúdo</Label>
        <div className="flex flex-wrap gap-1">
          {MESSAGE_TYPES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setType(value)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-poppins font-medium transition-colors border ${
                messageType === value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Texto ── */}
      {messageType === "text" && (
        <>
          <div>
            <Label className="font-poppins text-sm font-medium">Mensagem</Label>
            <Textarea
              ref={textareaRef}
              className="mt-1.5 min-h-[110px] font-poppins text-sm"
              placeholder="Digite a mensagem que será enviada..."
              value={config.text || ""}
              onChange={(e) => onChange({ ...config, text: e.target.value })}
            />
          </div>
          <VariablesRow onInsert={insertVariable} />
          <ButtonsSection
            buttons={buttons}
            onAdd={addButton}
            onUpdate={updateButton}
            onRemove={removeButton}
          />
        </>
      )}

      {/* ── Imagem ── */}
      {messageType === "image" && (
        <div className="space-y-3">
          <div>
            <Label className="font-poppins text-sm font-medium">URL da imagem</Label>
            <Input
              className="mt-1.5"
              placeholder="https://... (.jpg, .png, .webp)"
              value={config.mediaUrl || ""}
              onChange={(e) => onChange({ ...config, mediaUrl: e.target.value })}
            />
          </div>
          <div>
            <Label className="font-poppins text-sm font-medium">Legenda (opcional)</Label>
            <Textarea
              className="mt-1.5 min-h-[70px] text-sm"
              placeholder="Texto junto à imagem..."
              value={config.caption || ""}
              onChange={(e) => onChange({ ...config, caption: e.target.value })}
            />
          </div>
          <VariablesRow
            onInsert={(v) => onChange({ ...config, caption: (config.caption || "") + v })}
          />
        </div>
      )}

      {/* ── Áudio ── */}
      {messageType === "audio" && (
        <div className="space-y-3">
          <div>
            <Label className="font-poppins text-sm font-medium">URL do áudio</Label>
            <Input
              className="mt-1.5"
              placeholder="https://... (.mp3, .ogg, .m4a)"
              value={config.mediaUrl || ""}
              onChange={(e) => onChange({ ...config, mediaUrl: e.target.value })}
            />
          </div>
          <div className="flex items-center justify-between border border-border rounded-lg p-3 bg-muted/30">
            <div>
              <Label className="font-poppins text-sm">Enviar como nota de voz</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Aparece como gravação de voz no WhatsApp
              </p>
            </div>
            <Switch
              checked={config.asVoiceNote ?? true}
              onCheckedChange={(v) => onChange({ ...config, asVoiceNote: v })}
            />
          </div>
        </div>
      )}

      {/* ── Vídeo ── */}
      {messageType === "video" && (
        <div className="space-y-3">
          <div>
            <Label className="font-poppins text-sm font-medium">URL do vídeo</Label>
            <Input
              className="mt-1.5"
              placeholder="https://... (.mp4)"
              value={config.mediaUrl || ""}
              onChange={(e) => onChange({ ...config, mediaUrl: e.target.value })}
            />
          </div>
          <div>
            <Label className="font-poppins text-sm font-medium">Legenda (opcional)</Label>
            <Textarea
              className="mt-1.5 min-h-[70px] text-sm"
              placeholder="Texto junto ao vídeo..."
              value={config.caption || ""}
              onChange={(e) => onChange({ ...config, caption: e.target.value })}
            />
          </div>
          <VariablesRow
            onInsert={(v) => onChange({ ...config, caption: (config.caption || "") + v })}
          />
        </div>
      )}

      {/* ── Documento ── */}
      {messageType === "document" && (
        <div className="space-y-3">
          <div>
            <Label className="font-poppins text-sm font-medium">URL do documento</Label>
            <Input
              className="mt-1.5"
              placeholder="https://... (.pdf, .docx, .xlsx)"
              value={config.mediaUrl || ""}
              onChange={(e) => onChange({ ...config, mediaUrl: e.target.value })}
            />
          </div>
          <div>
            <Label className="font-poppins text-sm font-medium">Nome do arquivo</Label>
            <Input
              className="mt-1.5"
              placeholder="proposta.pdf"
              value={config.filename || ""}
              onChange={(e) => onChange({ ...config, filename: e.target.value })}
            />
          </div>
          <div>
            <Label className="font-poppins text-sm font-medium">Legenda (opcional)</Label>
            <Input
              className="mt-1.5"
              placeholder="Segue o documento..."
              value={config.caption || ""}
              onChange={(e) => onChange({ ...config, caption: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
