import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/hooks/useApi";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, Loader2, Download, CheckCircle2, ArrowLeft,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

// Campos-alvo do lead e apelidos aceitos nos cabeçalhos da planilha
const TARGET_FIELDS: { key: string; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "name", label: "Nome", required: true, aliases: ["nome", "name", "cliente", "lead", "contato"] },
  { key: "phone", label: "Telefone", required: true, aliases: ["telefone", "phone", "celular", "whatsapp", "fone", "tel"] },
  { key: "email", label: "E-mail", aliases: ["email", "e-mail", "mail"] },
  { key: "source", label: "Origem", aliases: ["origem", "source", "fonte", "canal"] },
  { key: "interest", label: "Interesse", aliases: ["interesse", "interest", "produto", "servico", "serviço"] },
  { key: "cidade", label: "Cidade", aliases: ["cidade", "city", "municipio", "município"] },
  { key: "estado", label: "Estado", aliases: ["estado", "state", "uf"] },
];

const NONE = "__none__";

const norm = (s: string) =>
  String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function ImportLeadsModal({ open, onClose, onImported }: Props) {
  const api = useApi();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setFileName(""); setHeaders([]); setRows([]); setMapping({});
      setPipelineId(""); setStageId(""); setResult(null);
    }
  }, [open]);

  // Carrega pipelines
  useEffect(() => {
    if (!open) return;
    api.pipelines.list().then((list: any[]) => {
      const ps = (list || []).map((p) => ({ id: p.id, name: p.name }));
      setPipelines(ps);
      if (ps[0]) setPipelineId(ps[0].id);
    }).catch(() => {});
  }, [open]);

  // Carrega etapas quando o pipeline muda
  useEffect(() => {
    if (!pipelineId) { setStages([]); return; }
    api.pipelines.stages(pipelineId).then((list: any[]) => {
      const ss = (list || []).map((s) => ({ id: s.id, name: s.name }));
      setStages(ss);
      setStageId(ss[0]?.id || "");
    }).catch(() => {});
  }, [pipelineId]);

  const autoMap = (hdrs: string[]) => {
    const map: Record<string, string> = {};
    for (const field of TARGET_FIELDS) {
      const found = hdrs.find((h) => field.aliases.includes(norm(h)));
      if (found) map[field.key] = found;
    }
    setMapping(map);
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setResult(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      if (json.length === 0) {
        toast.error("A planilha está vazia ou sem cabeçalho.");
        return;
      }
      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setRows(json);
      setFileName(file.name);
      autoMap(hdrs);
    } catch (e) {
      console.error(e);
      toast.error("Não consegui ler o arquivo. Use .xlsx, .xls ou .csv");
    } finally {
      setParsing(false);
    }
  };

  // Linhas mapeadas para o formato do backend
  const mappedRows = useMemo(() => {
    if (rows.length === 0) return [] as Record<string, any>[];
    return rows.map((r) => {
      const out: Record<string, any> = {};
      for (const field of TARGET_FIELDS) {
        const col = mapping[field.key];
        if (col && r[col] != null && String(r[col]).trim() !== "") {
          out[field.key] = String(r[col]).trim();
        }
      }
      return out;
    });
  }, [rows, mapping]);

  const validRows = useMemo(
    () => mappedRows.filter((r) => r.name && r.phone),
    [mappedRows]
  );

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error("Nenhuma linha válida (é preciso Nome e Telefone).");
      return;
    }
    setImporting(true);
    try {
      const res = await api.leads.importBatch(
        validRows,
        pipelineId || undefined,
        stageId || undefined,
      );
      setResult({ created: res.created, skipped: res.skipped });
      toast.success(`${res.created} lead(s) importado(s)`);
      onImported?.();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao importar");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headersRow = "Nome,Telefone,Email,Origem,Interesse,Cidade,Estado";
    const example = "João Silva,5511999999999,joao@email.com,Indicação,Plano Premium,São Paulo,SP";
    const csv = "﻿" + headersRow + "\n" + example;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo-leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const hasFile = rows.length > 0;
  const missingRequired = TARGET_FIELDS.filter((f) => f.required && !mapping[f.key]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar leads por planilha
          </DialogTitle>
        </DialogHeader>

        {/* Resultado */}
        {result ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <p className="text-lg font-semibold">{result.created} lead(s) importado(s)</p>
            {result.skipped > 0 && (
              <p className="text-sm text-muted-foreground">{result.skipped} linha(s) ignorada(s) (sem nome/telefone)</p>
            )}
            <Button onClick={onClose} className="mt-2">Concluir</Button>
          </div>
        ) : !hasFile ? (
          /* Passo 1: escolher arquivo */
          <div className="space-y-4">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
              className="w-full border-2 border-dashed border-border rounded-xl py-12 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              {parsing ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">Clique para escolher a planilha</p>
                <p className="text-xs text-muted-foreground">Excel (.xlsx, .xls) ou CSV</p>
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleFile(f); }}
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Não tem um modelo?</span>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Baixar modelo
              </Button>
            </div>
          </div>
        ) : (
          /* Passo 2: mapear + configurar */
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground truncate">
                <span className="font-medium text-foreground">{fileName}</span> · {rows.length} linha(s), {validRows.length} válida(s)
              </p>
              <Button variant="ghost" size="sm" onClick={() => { setRows([]); setHeaders([]); setFileName(""); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Trocar arquivo
              </Button>
            </div>

            {/* Mapeamento de colunas */}
            <div>
              <p className="text-sm font-medium mb-2">Relacione as colunas da planilha</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TARGET_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-2">
                    <label className="text-sm w-24 shrink-0">
                      {field.label}{field.required && <span className="text-destructive"> *</span>}
                    </label>
                    <Select
                      value={mapping[field.key] || NONE}
                      onValueChange={(v) => setMapping((m) => ({ ...m, [field.key]: v === NONE ? "" : v }))}
                    >
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— ignorar —</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {missingRequired.length > 0 && (
                <p className="text-xs text-destructive mt-2">
                  Faltando: {missingRequired.map((f) => f.label).join(", ")} (obrigatório)
                </p>
              )}
            </div>

            {/* Destino: pipeline + etapa */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Pipeline</label>
                <Select value={pipelineId} onValueChange={setPipelineId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {pipelines.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Etapa inicial</label>
                <Select value={stageId} onValueChange={setStageId} disabled={!stages.length}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            {validRows.length > 0 && (
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Prévia (primeiras 3 de {validRows.length})
                </div>
                <div className="divide-y divide-border">
                  {validRows.slice(0, 3).map((r, i) => (
                    <div key={i} className="px-3 py-2 text-sm flex items-center gap-3">
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground">{r.phone}</span>
                      {r.email && <span className="text-muted-foreground text-xs">{r.email}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleImport} disabled={importing || validRows.length === 0 || missingRequired.length > 0}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Importar {validRows.length} lead(s)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
