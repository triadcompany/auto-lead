import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft, ArrowRight, Upload, Check, Loader2, FileSpreadsheet,
  Zap, Users, MessageSquare, Search, Calendar, Info, SlidersHorizontal,
  ChevronLeft, ChevronRight, CheckCircle, Mic, Square, RotateCcw,
  Trash2, Pencil, FileText, FileIcon, Play, Pause,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useBroadcasts } from '@/hooks/useBroadcasts';
import { supabase } from '@/integrations/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ParsedRow {
  phone: string;
  name?: string;
  variables?: Record<string, any>;
}

interface Props {
  onClose: () => void;
}

type SourceType = 'spreadsheet' | 'crm_leads' | 'inbox';
type PayloadType = 'text' | 'interactive' | 'image' | 'audio' | 'document';

interface CrmFilters {
  period: 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'all' | 'custom';
  dateFrom: string;
  dateTo: string;
  pipelineId: string;
  stageIds: string[];
  source: string;
  sellerId: string;
}

interface InboxFilters {
  status: string;
  sellerId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 10) return null;
  return digits;
}

function formatRecordingTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function docIcon(mimeType: string) {
  if (mimeType === 'application/pdf') return <FileText className="h-6 w-6 text-red-500" />;
  if (mimeType.includes('word')) return <FileText className="h-6 w-6 text-blue-500" />;
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return <FileText className="h-6 w-6 text-green-500" />;
  return <FileIcon className="h-6 w-6 text-muted-foreground" />;
}

// ─── Source selection card ────────────────────────────────────────────────────
function SourceCard({
  icon, title, subtitle, description, selected, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border hover:border-primary/40 hover:bg-muted/20'
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" />
        </div>
      )}
      <div className={`mb-3 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>{icon}</div>
      <p className="text-sm font-semibold leading-tight">{title}</p>
      <p className="text-xs text-muted-foreground font-medium mt-0.5 mb-1">{subtitle}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </button>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────
export function NewCampaignWizard({ onClose }: Props) {
  const { orgId, profile } = useAuth();
const { getToken } = useClerkAuth();
  const { createCampaign } = useBroadcasts();
  const api = useApi();
  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<SourceType>('spreadsheet');

  // ── Step 1: Spreadsheet ──
  const [allRawData, setAllRawData] = useState<Record<string, any>[]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [phoneCol, setPhoneCol] = useState('');
  const [nameCol, setNameCol] = useState('');
  const [fileName, setFileName] = useState('');
  const [previewPage, setPreviewPage] = useState(0);
  const PREVIEW_PAGE = 20;

  // ── Step 1: CRM ──
  const [crmFilters, setCrmFilters] = useState<CrmFilters>({
    period: '30d', dateFrom: '', dateTo: '',
    pipelineId: '', stageIds: [], source: 'all', sellerId: 'all',
  });
  const [crmLeads, setCrmLeads] = useState<any[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSearched, setCrmSearched] = useState(false);

  // ── Step 1: Inbox ──
  const [inboxFilters, setInboxFilters] = useState<InboxFilters>({ status: 'all', sellerId: 'all' });
  const [inboxContacts, setInboxContacts] = useState<any[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxSearched, setInboxSearched] = useState(false);

  // ── Resolved recipients ──
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [discarded, setDiscarded] = useState(0);
  const [duplicates, setDuplicates] = useState(0);

  // ── Step 2: Campaign settings ──
  const [campaignName, setCampaignName] = useState('');
  const [instanceName, setInstanceName] = useState('');
  const [payloadType, setPayloadType] = useState<PayloadType>('text');
  const [buttons, setButtons] = useState<Array<{ label: string; value: string }>>([]);
  const [messageText, setMessageText] = useState('');
  const [caption, setCaption] = useState('');
  const [minDelay, setMinDelay] = useState(2);
  const [maxDelay, setMaxDelay] = useState(6);
  const [limitPerHour, setLimitPerHour] = useState(600);
  // Janela vazia por padrão = sem restrição (o worker dispara a qualquer hora).
  // Se o usuário preencher, a janela é aplicada (timezone Brasil).
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [batchSize, setBatchSize] = useState(10);
  const [noDuplicate, setNoDuplicate] = useState(true);
  const [enableAutomation, setEnableAutomation] = useState(false);
  const [selectedAutomationId, setSelectedAutomationId] = useState('');
  const [responseWindowHours, setResponseWindowHours] = useState(24);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledAt, setScheduledAt] = useState('');

  // ── Step 2: Media upload state ──
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState('');
  const [mediaFileName, setMediaFileName] = useState('');
  const [mediaFileSize, setMediaFileSize] = useState(0);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');

  // ── Step 2: Audio recording state ──
  const [audioMode, setAudioMode] = useState<'upload' | 'record'>('upload');
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState('');
  const [audioPlaying, setAudioPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // ── Step 2: Document state ──
  const [docDisplayName, setDocDisplayName] = useState('');
  const [docMimeType, setDocMimeType] = useState('');

  // Recording timer
  useEffect(() => {
    if (!recording) return;
    const interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [recording]);

  // ── Remote data ──
  // WhatsApp instances via API (avoids Supabase RLS issues)
  const { data: instances } = useQuery({
    queryKey: ['whatsapp-instances', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      try {
        const data = await api.whatsapp.me() as any;
        const conn = data?.connection;
        if (conn?.instance_name && (conn.status === 'connected' || conn.status === 'open')) {
          return [{ instance_name: conn.instance_name, status: conn.status, phone_number: conn.phone_number || null }];
        }
        return [];
      } catch {
        return [];
      }
    },
  });

  // Auto-select the only available instance
  useEffect(() => {
    if (!instanceName && instances && instances.length === 1) {
      setInstanceName(instances[0].instance_name);
    }
  }, [instances, instanceName]);

  const { data: pipelines } = useQuery({
    queryKey: ['pipelines-for-broadcast', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const data = await api.pipelines.list();
      return (data || []) as Array<{ id: string; name: string; is_default: boolean; is_active: boolean }>;
    },
  });

  const { data: stagesForPipeline = [] } = useQuery({
    queryKey: ['stages-for-broadcast', crmFilters.pipelineId],
    enabled: !!crmFilters.pipelineId,
    queryFn: async () => {
      const data = await api.pipelines.stages(crmFilters.pipelineId);
      return (data || []) as Array<{ id: string; name: string; position: number }>;
    },
  });

  const { data: sellers } = useQuery({
    queryKey: ['sellers-for-broadcast', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const data = await api.users.list();
      return (data || []).filter((u: any) => u.name) as Array<{ id: string; name: string }>;
    },
  });

  const { data: automations } = useQuery({
    queryKey: ['automations-for-broadcast', orgId],
    enabled: !!orgId,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automations-api`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action: 'list', organization_id: orgId }),
      });
      const json = await res.json();
      return (json?.automations || []) as Array<{ id: string; name: string; is_active: boolean }>;
    },
  });

  // ── Storage upload ──
  const uploadToStorage = async (file: File | Blob, folder: string, name: string): Promise<string> => {
    const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
    const token = await getToken();
    const formData = new FormData();
    formData.append('file', file instanceof File ? file : new File([file], name));
    const res = await fetch(`${apiUrl}/broadcasts/upload-media`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Falha no upload da mídia');
    const data = await res.json() as { url: string };
    return data.url;
  };

  // ── Image upload ──
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Imagem deve ter no máximo 5MB'); return; }
    setMediaFileName(file.name);
    setMediaFileSize(file.size);
    setImagePreviewUrl(URL.createObjectURL(file));
    setMediaUploading(true);
    try {
      const url = await uploadToStorage(file, 'images', file.name);
      setUploadedMediaUrl(url);
      toast.success('Imagem enviada com sucesso');
    } catch (err: any) {
      toast.error('Erro ao enviar imagem: ' + err.message);
      setImagePreviewUrl('');
      setMediaFileName('');
    } finally {
      setMediaUploading(false);
    }
    e.target.value = '';
  };

  const clearImage = () => {
    setUploadedMediaUrl('');
    setImagePreviewUrl('');
    setMediaFileName('');
    setMediaFileSize(0);
  };

  // ── Audio file upload ──
  const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Áudio deve ter no máximo 10MB'); return; }
    setMediaFileName(file.name);
    setMediaFileSize(file.size);
    setAudioBlobUrl(URL.createObjectURL(file));
    setMediaUploading(true);
    try {
      const url = await uploadToStorage(file, 'audio', file.name);
      setUploadedMediaUrl(url);
      toast.success('Áudio enviado com sucesso');
    } catch (err: any) {
      toast.error('Erro ao enviar áudio: ' + err.message);
      setMediaFileName('');
    } finally {
      setMediaUploading(false);
    }
    e.target.value = '';
  };

  const clearAudio = () => {
    setUploadedMediaUrl('');
    setAudioBlobUrl('');
    setAudioBlob(null);
    setMediaFileName('');
    setMediaFileSize(0);
    setRecordingTime(0);
  };

  // ── Microphone recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        setAudioBlob(blob);
        setAudioBlobUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setRecordingTime(0);
      setRecording(true);
    } catch {
      toast.error('Permissão de microfone negada');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const confirmRecording = async () => {
    if (!audioBlob) return;
    const ext = audioBlob.type.includes('webm') ? 'webm' : 'ogg';
    const name = `gravacao_${Date.now()}.${ext}`;
    setMediaFileName(name);
    setMediaFileSize(audioBlob.size);
    setMediaUploading(true);
    try {
      const url = await uploadToStorage(audioBlob, 'audio', name);
      setUploadedMediaUrl(url);
      toast.success('Gravação salva com sucesso');
    } catch (err: any) {
      toast.error('Erro ao salvar gravação: ' + err.message);
    } finally {
      setMediaUploading(false);
    }
  };

  const toggleAudioPlay = () => {
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio(audioBlobUrl || uploadedMediaUrl);
      audioPlayerRef.current.onended = () => setAudioPlaying(false);
    }
    if (audioPlaying) {
      audioPlayerRef.current.pause();
      setAudioPlaying(false);
    } else {
      audioPlayerRef.current.src = audioBlobUrl || uploadedMediaUrl;
      audioPlayerRef.current.play();
      setAudioPlaying(true);
    }
  };

  // ── Document upload ──
  const handleDocSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Documento deve ter no máximo 20MB'); return; }
    setMediaFileName(file.name);
    setMediaFileSize(file.size);
    setDocMimeType(file.type);
    setDocDisplayName(file.name);
    setMediaUploading(true);
    try {
      const url = await uploadToStorage(file, 'documents', file.name);
      setUploadedMediaUrl(url);
      toast.success('Documento enviado com sucesso');
    } catch (err: any) {
      toast.error('Erro ao enviar documento: ' + err.message);
      setMediaFileName('');
    } finally {
      setMediaUploading(false);
    }
    e.target.value = '';
  };

  const clearDoc = () => {
    setUploadedMediaUrl('');
    setMediaFileName('');
    setMediaFileSize(0);
    setDocDisplayName('');
    setDocMimeType('');
  };

  // Reset media state on type change
  const handlePayloadTypeChange = (v: string) => {
    setPayloadType(v as PayloadType);
    setUploadedMediaUrl('');
    setImagePreviewUrl('');
    setAudioBlobUrl('');
    setAudioBlob(null);
    setMediaFileName('');
    setMediaFileSize(0);
    setRecordingTime(0);
    setDocDisplayName('');
    setDocMimeType('');
    if (v === 'interactive' && buttons.length === 0) setButtons([{ label: '', value: '' }]);
  };

  // ── Spreadsheet handler ──
  const handleFileComplete = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreviewPage(0);
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
    if (json.length === 0) return;
    const headers = Object.keys(json[0]);
    setRawHeaders(headers);
    setAllRawData(json);
    const phoneCandidates = headers.filter(h => /phone|telefone|celular|whatsapp|numero|número|fone/i.test(h));
    const nameCandidates = headers.filter(h => /name|nome|cliente/i.test(h));
    if (phoneCandidates.length > 0) setPhoneCol(phoneCandidates[0]);
    if (nameCandidates.length > 0) setNameCol(nameCandidates[0]);
  }, []);

  const buildRecipientsFromSpreadsheet = useCallback((): ParsedRow[] => {
    const seen = new Set<string>();
    const valid: ParsedRow[] = [];
    let disc = 0; let dups = 0;
    for (const row of allRawData) {
      const normalized = normalizePhone(String(row[phoneCol] || ''));
      if (!normalized) { disc++; continue; }
      if (seen.has(normalized)) { dups++; continue; }
      seen.add(normalized);
      const name = nameCol && nameCol !== '__none__' ? String(row[nameCol] || '') : undefined;
      const variables: Record<string, any> = {};
      for (const h of rawHeaders) { if (h !== phoneCol && h !== nameCol) variables[h] = row[h]; }
      valid.push({ phone: normalized, name: name || undefined, variables: Object.keys(variables).length > 0 ? variables : undefined });
    }
    setDiscarded(disc); setDuplicates(dups);
    return valid;
  }, [phoneCol, nameCol, allRawData, rawHeaders]);

  // ── CRM leads search ──
  const searchCrmLeads = async () => {
    setCrmLoading(true); setCrmSearched(true);
    try {
      // Fetch all leads — no pipeline_id filter (leads may have pipelineId = null)
      const params: Record<string, string> = { limit: "2000" };

      // Source filter
      if (crmFilters.source !== 'all') params.source = crmFilters.source;

      // Seller filter
      if (crmFilters.sellerId !== 'all') params.seller_id = crmFilters.sellerId;

      // Period / date filter
      const now = new Date();
      if (crmFilters.period === 'today') {
        const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
        params.created_after = startOfDay.toISOString();
      } else if (crmFilters.period === 'yesterday') {
        const yStart = new Date(now); yStart.setDate(yStart.getDate() - 1); yStart.setHours(0, 0, 0, 0);
        const yEnd = new Date(yStart); yEnd.setHours(23, 59, 59, 999);
        params.created_after = yStart.toISOString();
        params.created_before = yEnd.toISOString();
      } else if (crmFilters.period === '7d') {
        params.created_after = new Date(Date.now() - 7 * 86400000).toISOString();
      } else if (crmFilters.period === '30d') {
        params.created_after = new Date(Date.now() - 30 * 86400000).toISOString();
      } else if (crmFilters.period === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        params.created_after = startOfMonth.toISOString();
      } else if (crmFilters.period === 'all') {
        // sem filtro de data
      } else if (crmFilters.period === 'custom') {
        if (crmFilters.dateFrom) params.created_after = new Date(crmFilters.dateFrom).toISOString();
        if (crmFilters.dateTo) params.created_before = new Date(crmFilters.dateTo + 'T23:59:59').toISOString();
      }

      const allLeads = await api.leads.list(params) as any[];

      // Client-side stage filter: match by UUID or by stage name (fallback)
      const selectedStageNames = new Set(
        stagesForPipeline
          .filter(s => crmFilters.stageIds.includes(s.id))
          .map(s => s.name.toLowerCase().trim())
      );
      const leads = crmFilters.stageIds.length > 0
        ? allLeads.filter((l: any) => {
            const stageId = l.stageId || l.stage_id;
            const stageName = (l.stage_name || '').toLowerCase().trim();
            return crmFilters.stageIds.includes(stageId) || (stageName && selectedStageNames.has(stageName));
          })
        : allLeads;

      setCrmLeads(leads || []);
    } catch (err: any) {
      console.error('searchCrmLeads error:', err);
      setCrmLeads([]);
      toast.error(`Erro ao buscar leads: ${err?.message || JSON.stringify(err)}`);
    }
    finally { setCrmLoading(false); }
  };

  const searchInboxContacts = async () => {
    if (!orgId) return;
    setInboxLoading(true); setInboxSearched(true);
    try {
      const { data, error } = await (supabase as any).rpc('get_inbox_contacts_for_broadcast', {
        p_status: inboxFilters.status,
        p_seller_id: inboxFilters.sellerId,
      });
      if (error) throw error;
      setInboxContacts(data || []);
    } catch (err) { console.error('Erro buscando contatos do inbox:', err); setInboxContacts([]); toast.error('Erro ao buscar contatos do inbox'); }
    finally { setInboxLoading(false); }
  };

  const buildRecipientsFromCrm = (): ParsedRow[] => {
    const seen = new Set<string>(); const valid: ParsedRow[] = [];
    for (const lead of crmLeads) {
      const normalized = normalizePhone(String(lead.phone || ''));
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      const nameParts = (lead.name || '').trim().split(' ');
      valid.push({ phone: normalized, name: lead.name || undefined, variables: {
        nome: nameParts[0] || '', nome_completo: lead.name || '', origem: lead.source || '',
        data_cadastro: (lead.createdAt || lead.created_at) ? format(new Date(lead.createdAt || lead.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '',
      }});
    }
    return valid;
  };

  const buildRecipientsFromInbox = (): ParsedRow[] => {
    const seen = new Set<string>(); const valid: ParsedRow[] = [];
    for (const conv of inboxContacts) {
      const normalized = normalizePhone(String(conv.contact_phone || ''));
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      const nameParts = (conv.contact_name || '').trim().split(' ');
      valid.push({ phone: normalized, name: conv.contact_name || undefined, variables: {
        nome: nameParts[0] || '', nome_completo: conv.contact_name || '',
      }});
    }
    return valid;
  };

  const goToStep2 = () => {
    let built: ParsedRow[] = [];
    if (sourceType === 'spreadsheet') { built = buildRecipientsFromSpreadsheet(); }
    else if (sourceType === 'crm_leads') { built = buildRecipientsFromCrm(); setDiscarded(0); setDuplicates(crmLeads.length - built.length); }
    else { built = buildRecipientsFromInbox(); setDiscarded(0); setDuplicates(inboxContacts.length - built.length); }

    if (built.length === 0) {
      toast.error('Nenhum destinatário com telefone válido encontrado. Verifique se os números têm pelo menos 10 dígitos.');
      return;
    }

    setRows(built); setStep(2);
  };

  const canGoToStep2 = () => {
    if (sourceType === 'spreadsheet') return !!phoneCol && allRawData.length > 0;
    if (sourceType === 'crm_leads') return crmSearched && crmLeads.length > 0;
    return inboxSearched && inboxContacts.length > 0;
  };

  const handleCreate = async () => {
    if (!profile) return;
    let payload: Record<string, any>;
    if (payloadType === 'text' || payloadType === 'interactive') {
      payload = { text: messageText };
    } else if (payloadType === 'audio') {
      payload = { audio_url: uploadedMediaUrl };
    } else if (payloadType === 'document') {
      payload = { media_url: uploadedMediaUrl, file_name: docDisplayName, caption };
    } else {
      payload = { media_url: uploadedMediaUrl, caption };
    }

    await createCampaign.mutateAsync({
      name: campaignName,
      instance_name: instanceName,
      payload_type: payloadType as any,
      payload,
      settings: {
        minDelay,
        maxDelay,
        batchSize,
        limitPerHour,
        // Só envia janela se o usuário tiver preenchido AMBOS os campos
        ...(windowStart && windowEnd ? { windowStart, windowEnd } : {}),
        noDuplicate,
      },
      recipients: rows,
      profileId: profile.id,
      enableAutomation,
      automationId: enableAutomation ? selectedAutomationId || null : null,
      responseWindowHours,
      buttons: payloadType === 'interactive' ? buttons.filter(b => b.label && b.value) : null,
      sourceType,
      sourceFilters: sourceType !== 'spreadsheet'
        ? (sourceType === 'crm_leads' ? (crmFilters as any) : (inboxFilters as any))
        : null,
      scheduledAt: scheduleMode === 'later' && scheduledAt ? scheduledAt : null,
    });
    onClose();
  };

  const availableVars = sourceType === 'spreadsheet'
    ? (nameCol ? ['nome', ...rawHeaders.filter(h => h !== phoneCol && h !== nameCol)] : rawHeaders.filter(h => h !== phoneCol))
    : ['nome', 'nome_completo', 'origem', ...(sourceType === 'crm_leads' ? ['data_cadastro'] : [])];

  const needsMedia = payloadType === 'image' || payloadType === 'audio' || payloadType === 'document';
  const step2Valid = !!campaignName && !!instanceName
    && ((payloadType === 'text' || payloadType === 'interactive') ? !!messageText : !!uploadedMediaUrl)
    && (payloadType === 'interactive' ? buttons.filter(b => b.label && b.value).length > 0 : true)
    && (scheduleMode === 'later' ? !!scheduledAt : true);

  // Preview columns
  const previewCols = rawHeaders.length > 0
    ? [
        ...(phoneCol ? [phoneCol] : []),
        ...(nameCol && nameCol !== '__none__' ? [nameCol] : []),
        ...rawHeaders.filter(h => h !== phoneCol && h !== nameCol).slice(0, 2),
      ].slice(0, 4)
    : rawHeaders.slice(0, 4);
  const totalPreviewPages = Math.ceil(allRawData.length / PREVIEW_PAGE);
  const previewRows = allRawData.slice(previewPage * PREVIEW_PAGE, (previewPage + 1) * PREVIEW_PAGE);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl flex flex-col p-0 gap-0 max-h-[90vh]">
        {/* ── Fixed header ── */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="font-poppins">Nova Campanha — Passo {step} de 3</DialogTitle>
        </DialogHeader>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">

          {/* ══════ STEP 1 ══════ */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label className="text-sm font-medium mb-3 block">De onde vêm os destinatários?</Label>
                <div className="grid grid-cols-3 gap-3">
                  <SourceCard
                    icon={<FileSpreadsheet className="h-7 w-7" />}
                    title="Planilha" subtitle="CSV / XLSX"
                    description="Faça upload com telefones e dados dos contatos"
                    selected={sourceType === 'spreadsheet'}
                    onClick={() => setSourceType('spreadsheet')}
                  />
                  <SourceCard
                    icon={<Users className="h-7 w-7" />}
                    title="Leads do CRM" subtitle="Funil de vendas"
                    description="Filtre leads por estágio, origem, período e vendedor"
                    selected={sourceType === 'crm_leads'}
                    onClick={() => setSourceType('crm_leads')}
                  />
                  <SourceCard
                    icon={<MessageSquare className="h-7 w-7" />}
                    title="Inbox" subtitle="WhatsApp"
                    description="Use contatos com conversa ativa no WhatsApp"
                    selected={sourceType === 'inbox'}
                    onClick={() => setSourceType('inbox')}
                  />
                </div>
              </div>

              {/* Spreadsheet */}
              {sourceType === 'spreadsheet' && (
                <div className="space-y-5">
                  {fileName ? (
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium leading-tight">{fileName}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge className="text-xs gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
                                <Users className="h-3 w-3" />{allRawData.length} linhas
                              </Badge>
                              <Badge variant="secondary" className="text-xs">{rawHeaders.length} colunas</Badge>
                            </div>
                          </div>
                        </div>
                        <label className="cursor-pointer text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors shrink-0 ml-4">
                          Trocar arquivo
                          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileComplete} />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer hover:border-primary/50 hover:bg-muted/10 transition-colors">
                      <Upload className="h-10 w-10 text-muted-foreground/40 mb-3" />
                      <span className="text-sm font-medium text-muted-foreground">Arraste ou clique para selecionar</span>
                      <span className="text-xs text-muted-foreground/60 mt-1">CSV, XLSX ou XLS</span>
                      <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileComplete} />
                    </label>
                  )}

                  {rawHeaders.length > 0 && (
                    <div className="rounded-lg border bg-card p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Mapeamento de colunas</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Coluna de Telefone <span className="text-destructive">*</span></Label>
                          <Select value={phoneCol} onValueChange={setPhoneCol}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>{rawHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Coluna de Nome</Label>
                          <Select value={nameCol || '__none__'} onValueChange={setNameCol}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhuma</SelectItem>
                              {rawHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {rawHeaders.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Preview — {previewCols.length} colunas exibidas
                        </span>
                        {allRawData.length > PREVIEW_PAGE && (
                          <span className="text-xs text-muted-foreground">
                            {previewPage * PREVIEW_PAGE + 1}–{Math.min((previewPage + 1) * PREVIEW_PAGE, allRawData.length)} de {allRawData.length}
                          </span>
                        )}
                      </div>
                      <div className="rounded-lg border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40">
                              {previewCols.map(h => (
                                <TableHead key={h} className={`text-xs py-2 max-w-[160px] ${h === phoneCol ? 'text-primary font-semibold' : ''}`}>
                                  <span className="truncate block" title={h}>{h}</span>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewRows.map((row, i) => (
                              <TableRow key={i} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                                {previewCols.map(h => (
                                  <TableCell key={h} className="text-xs py-1.5 max-w-[160px]" title={String(row[h] || '')}>
                                    <span className="truncate block">{String(row[h] || '—')}</span>
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {totalPreviewPages > 1 && (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground px-1">{previewPage + 1} / {totalPreviewPages}</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={previewPage >= totalPreviewPages - 1} onClick={() => setPreviewPage(p => p + 1)}>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {phoneCol && allRawData.length > 0 && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-emerald-800">Pronto para avançar</p>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          {allRawData.length} contatos carregados · Telefone: <strong>{phoneCol}</strong>
                          {nameCol && nameCol !== '__none__' ? ` · Nome: ${nameCol}` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CRM Leads */}
              {sourceType === 'crm_leads' && (
                <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
                  <p className="text-sm font-medium">Filtros de segmentação</p>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">Período de criação</Label>
                    <div className="flex gap-2 flex-wrap">
                      {(['today', 'yesterday', '7d', '30d', 'month', 'all', 'custom'] as const).map(p => (
                        <button key={p} type="button" onClick={() => setCrmFilters(f => ({ ...f, period: p }))}
                          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${crmFilters.period === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'}`}>
                          {p === 'today' ? 'Hoje' : p === 'yesterday' ? 'Ontem' : p === '7d' ? 'Últimos 7 dias' : p === '30d' ? 'Últimos 30 dias' : p === 'month' ? 'Este mês' : p === 'all' ? 'Máximo' : 'Personalizado'}
                        </button>
                      ))}
                    </div>
                    {crmFilters.period === 'custom' && (
                      <div className="flex gap-2 mt-2">
                        <div><Label className="text-xs">De</Label><Input type="date" value={crmFilters.dateFrom} onChange={e => setCrmFilters(f => ({ ...f, dateFrom: e.target.value }))} className="h-8 text-xs" /></div>
                        <div><Label className="text-xs">Até</Label><Input type="date" value={crmFilters.dateTo} onChange={e => setCrmFilters(f => ({ ...f, dateTo: e.target.value }))} className="h-8 text-xs" /></div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Pipeline</Label>
                      <Select value={crmFilters.pipelineId || '__all__'} onValueChange={v => setCrmFilters(f => ({ ...f, pipelineId: v === '__all__' ? '' : v, stageIds: [] }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos os pipelines</SelectItem>
                          {(pipelines || []).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Estágio</Label>
                      {stagesForPipeline.length > 0 ? (
                        <div className="border rounded-md p-2 max-h-28 overflow-y-auto space-y-1">
                          {stagesForPipeline.map(s => (
                            <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                              <Checkbox checked={crmFilters.stageIds.includes(s.id)}
                                onCheckedChange={checked => setCrmFilters(f => ({ ...f, stageIds: checked ? [...f.stageIds, s.id] : f.stageIds.filter(id => id !== s.id) }))}
                              />{s.name}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground py-2">{crmFilters.pipelineId ? 'Carregando...' : 'Selecione um pipeline'}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Origem do lead</Label>
                      <Select value={crmFilters.source} onValueChange={v => setCrmFilters(f => ({ ...f, source: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as origens</SelectItem>
                          <SelectItem value="Meta Ads">Meta Ads</SelectItem>
                          <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                          <SelectItem value="OLX">OLX</SelectItem>
                          <SelectItem value="Webmotors">Webmotors</SelectItem>
                          <SelectItem value="Indicação">Indicação</SelectItem>
                          <SelectItem value="Site">Site</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Responsável</Label>
                      <Select value={crmFilters.sellerId} onValueChange={v => setCrmFilters(f => ({ ...f, sellerId: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="none">Sem responsável</SelectItem>
                          {(sellers || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={searchCrmLeads} disabled={crmLoading} className="w-full gap-2">
                    {crmLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {crmLoading ? 'Buscando...' : 'Buscar Leads'}
                  </Button>
                  {crmSearched && !crmLoading && (
                    <div>
                      <span className={`text-sm font-medium ${crmLeads.length > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {crmLeads.length} leads encontrados
                      </span>
                      {crmLeads.length > 0 && (
                        <div className="border rounded-md overflow-auto max-h-[200px] mt-2">
                          <Table>
                            <TableHeader><TableRow className="bg-muted/40">
                              <TableHead className="text-xs">Nome</TableHead>
                              <TableHead className="text-xs">Telefone</TableHead>
                              <TableHead className="text-xs">Origem</TableHead>
                              <TableHead className="text-xs">Cadastro</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                              {crmLeads.slice(0, 10).map((lead, i) => (
                                <TableRow key={lead.id} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                                  <TableCell className="text-xs py-1.5">{lead.name || '—'}</TableCell>
                                  <TableCell className="text-xs py-1.5 font-mono">{lead.phone}</TableCell>
                                  <TableCell className="text-xs py-1.5">{lead.source || '—'}</TableCell>
                                  <TableCell className="text-xs py-1.5">{lead.created_at ? format(new Date(lead.created_at), 'dd/MM/yy', { locale: ptBR }) : '—'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {crmLeads.length > 10 && <p className="text-xs text-center text-muted-foreground py-2">... e mais {crmLeads.length - 10} leads</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Inbox */}
              {sourceType === 'inbox' && (
                <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
                  <p className="text-sm font-medium">Filtros de contatos</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Status da conversa</Label>
                      <Select value={inboxFilters.status} onValueChange={v => setInboxFilters(f => ({ ...f, status: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="open">Abertos</SelectItem>
                          <SelectItem value="in_progress">Em atendimento</SelectItem>
                          <SelectItem value="waiting_customer">Aguardando cliente</SelectItem>
                          <SelectItem value="closed">Finalizados</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1.5 block">Responsável</Label>
                      <Select value={inboxFilters.sellerId} onValueChange={v => setInboxFilters(f => ({ ...f, sellerId: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="none">Sem responsável</SelectItem>
                          {(sellers || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={searchInboxContacts} disabled={inboxLoading} className="w-full gap-2">
                    {inboxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {inboxLoading ? 'Buscando...' : 'Buscar Contatos'}
                  </Button>
                  {inboxSearched && !inboxLoading && (
                    <div>
                      <p className={`text-sm font-medium ${inboxContacts.length > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                        {inboxContacts.length} contatos encontrados
                      </p>
                      {inboxContacts.length > 0 && (
                        <div className="border rounded-md overflow-auto max-h-[180px] mt-2">
                          <Table>
                            <TableHeader><TableRow className="bg-muted/40">
                              <TableHead className="text-xs">Nome</TableHead>
                              <TableHead className="text-xs">Telefone</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                              {inboxContacts.slice(0, 10).map((c, i) => (
                                <TableRow key={c.id} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                                  <TableCell className="text-xs py-1.5">{c.contact_name || '—'}</TableCell>
                                  <TableCell className="text-xs py-1.5 font-mono">{c.contact_phone}</TableCell>
                                  <TableCell className="text-xs py-1.5">{c.status || '—'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {inboxContacts.length > 10 && <p className="text-xs text-center text-muted-foreground py-2">... e mais {inboxContacts.length - 10} contatos</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════ STEP 2 ══════ */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <Label>Nome da campanha *</Label>
                <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ex: Retomada de leads frios" />
              </div>

              <div>
                <Label>Instância Evolution *</Label>
                {(!instances || instances.length === 0) ? (
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription className="flex items-center justify-between gap-3 flex-wrap">
                      <span>Nenhum WhatsApp conectado.</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => { onClose(); window.location.href = '/configuracoes/whatsapp'; }}
                      >
                        Configurar WhatsApp
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select value={instanceName} onValueChange={setInstanceName}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {instances.map(inst => (
                        <SelectItem key={inst.instance_name} value={inst.instance_name}>
                          {inst.instance_name}{inst.phone_number ? ` · ${inst.phone_number}` : ''} ({inst.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label>Tipo de disparo</Label>
                <Select value={payloadType} onValueChange={handlePayloadTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto livre</SelectItem>
                    <SelectItem value="interactive">Texto com botões</SelectItem>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* TEXT / INTERACTIVE */}
              {(payloadType === 'text' || payloadType === 'interactive') && (
                <div>
                  <Label>Mensagem</Label>
                  <Textarea
                    id="broadcast-message-textarea"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    rows={5}
                    placeholder="Olá {{nome}}, tudo bem?"
                    onDrop={e => {
                      e.preventDefault();
                      const variable = e.dataTransfer.getData('text/plain');
                      if (!variable) return;
                      const ta = e.currentTarget;
                      const start = ta.selectionStart ?? messageText.length;
                      setMessageText(messageText.slice(0, start) + variable + messageText.slice(start));
                    }}
                    onDragOver={e => e.preventDefault()}
                  />
                  {availableVars.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="text-xs text-muted-foreground mr-1">Variáveis:</span>
                      {availableVars.map(v => (
                        <span key={v} draggable
                          onDragStart={e => { e.dataTransfer.setData('text/plain', `{{${v}}}`); e.dataTransfer.effectAllowed = 'copy'; }}
                          onClick={() => {
                            const ta = document.getElementById('broadcast-message-textarea') as HTMLTextAreaElement | null;
                            const pos = ta?.selectionStart ?? messageText.length;
                            setMessageText(messageText.slice(0, pos) + `{{${v}}}` + messageText.slice(pos));
                            setTimeout(() => ta?.focus(), 0);
                          }}
                          className="inline-flex items-center rounded-md border border-input bg-accent/50 px-2 py-0.5 text-xs font-medium cursor-grab active:cursor-grabbing hover:bg-accent transition-colors select-none"
                        >{`{{${v}}}`}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {payloadType === 'interactive' && (
                <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      O WhatsApp deixou de exibir botões nativos em conexões via QR Code. Para garantir entrega em todos os celulares, as opções serão enviadas como <strong>lista numerada de texto</strong> (1, 2, 3…). As respostas continuam sendo capturadas e podem disparar automações pelo número ou texto da opção.
                    </AlertDescription>
                  </Alert>
                  <Label className="font-medium">Opções (até 3)</Label>
                  {buttons.map((btn, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                      <Input placeholder="Texto da opção" value={btn.label}
                        onChange={e => { const u = [...buttons]; u[idx] = { ...u[idx], label: e.target.value }; setButtons(u); }} />
                      <Input placeholder="Valor interno" value={btn.value}
                        onChange={e => { const u = [...buttons]; u[idx] = { ...u[idx], value: e.target.value }; setButtons(u); }} />
                      <Button variant="ghost" size="sm" onClick={() => setButtons(buttons.filter((_, i) => i !== idx))} disabled={buttons.length <= 1}>✕</Button>
                    </div>
                  ))}
                  {buttons.length < 3 && (
                    <Button variant="outline" size="sm" onClick={() => setButtons([...buttons, { label: '', value: '' }])}>+ Adicionar opção</Button>
                  )}
                </div>
              )}

              {/* IMAGE */}
              {payloadType === 'image' && (
                <div className="space-y-3">
                  <Label>Imagem</Label>
                  {!mediaFileName ? (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/10 transition-colors">
                      <Upload className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <span className="text-sm font-medium text-muted-foreground">Clique para selecionar imagem</span>
                      <span className="text-xs text-muted-foreground/60 mt-1">JPG, PNG, WEBP, GIF — máx. 5 MB</span>
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageSelect} />
                    </label>
                  ) : (
                    <div className="rounded-xl border overflow-hidden">
                      {imagePreviewUrl && (
                        <div className="relative bg-muted/30 flex items-center justify-center max-h-48">
                          <img src={imagePreviewUrl} alt="preview" className="max-h-48 object-contain" />
                          {mediaUploading && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="p-3 flex items-center justify-between bg-card">
                        <div className="flex items-center gap-2">
                          {uploadedMediaUrl
                            ? <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                            : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                          }
                          <div>
                            <p className="text-xs font-medium truncate max-w-[220px]">{mediaFileName}</p>
                            {mediaFileSize > 0 && <p className="text-xs text-muted-foreground">{formatFileSize(mediaFileSize)}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <label title="Trocar imagem" className="cursor-pointer p-1.5 rounded hover:bg-muted transition-colors">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageSelect} />
                          </label>
                          <button title="Remover" onClick={clearImage} className="p-1.5 rounded hover:bg-muted transition-colors">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm">Legenda (opcional)</Label>
                    <Textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2} placeholder="Texto que aparece abaixo da imagem..." className="mt-1" />
                  </div>
                </div>
              )}

              {/* AUDIO */}
              {payloadType === 'audio' && (
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Áudio</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => { setAudioMode('upload'); clearAudio(); }}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${audioMode === 'upload' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'}`}>
                        <Upload className="h-4 w-4" /> Upload de arquivo
                      </button>
                      <button type="button" onClick={() => { setAudioMode('record'); clearAudio(); }}
                        className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all ${audioMode === 'record' ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'}`}>
                        <Mic className="h-4 w-4" /> Gravar agora
                      </button>
                    </div>
                  </div>

                  {audioMode === 'upload' && (
                    <div>
                      {!mediaFileName ? (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/10 transition-colors">
                          <Upload className="h-8 w-8 text-muted-foreground/40 mb-2" />
                          <span className="text-sm font-medium text-muted-foreground">Clique para selecionar áudio</span>
                          <span className="text-xs text-muted-foreground/60 mt-1">MP3, OGG, M4A, WAV — máx. 10 MB</span>
                          <input type="file" accept="audio/mpeg,audio/ogg,audio/mp4,audio/wav,audio/webm" className="hidden" onChange={handleAudioFileSelect} />
                        </label>
                      ) : (
                        <div className="rounded-xl border p-3 flex items-center justify-between bg-card">
                          <div className="flex items-center gap-3">
                            <button onClick={toggleAudioPlay}
                              className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                              {audioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                            </button>
                            <div>
                              {uploadedMediaUrl
                                ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 inline mr-1" />
                                : <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground inline mr-1" />
                              }
                              <span className="text-xs font-medium">{mediaFileName}</span>
                              {mediaFileSize > 0 && <p className="text-xs text-muted-foreground">{formatFileSize(mediaFileSize)}</p>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <label title="Trocar" className="cursor-pointer p-1.5 rounded hover:bg-muted transition-colors">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              <input type="file" accept="audio/mpeg,audio/ogg,audio/mp4,audio/wav,audio/webm" className="hidden" onChange={handleAudioFileSelect} />
                            </label>
                            <button onClick={clearAudio} className="p-1.5 rounded hover:bg-muted transition-colors">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {audioMode === 'record' && (
                    <div className="border rounded-xl p-4 bg-muted/20 space-y-4">
                      {!uploadedMediaUrl ? (
                        <>
                          {/* Waveform / recording state */}
                          <div className="flex items-center justify-center gap-1 h-10">
                            {recording
                              ? Array.from({ length: 12 }).map((_, i) => (
                                  <div key={i} className="w-1 bg-red-500 rounded-full animate-pulse"
                                    style={{ height: `${20 + Math.random() * 20}px`, animationDelay: `${i * 80}ms` }} />
                                ))
                              : audioBlob
                              ? Array.from({ length: 12 }).map((_, i) => (
                                  <div key={i} className="w-1 bg-primary/40 rounded-full"
                                    style={{ height: `${12 + (i % 4) * 8}px` }} />
                                ))
                              : <p className="text-sm text-muted-foreground">Pressione para iniciar</p>
                            }
                          </div>

                          {(recording || audioBlob) && (
                            <p className="text-center text-lg font-mono font-medium">
                              {formatRecordingTime(recordingTime)}
                            </p>
                          )}

                          <div className="flex gap-2 justify-center">
                            {!recording && !audioBlob && (
                              <Button onClick={startRecording} className="gap-2 bg-red-500 hover:bg-red-600 border-0">
                                <Mic className="h-4 w-4" /> Iniciar gravação
                              </Button>
                            )}
                            {recording && (
                              <Button onClick={stopRecording} className="gap-2 bg-red-500 hover:bg-red-600 border-0 animate-pulse">
                                <Square className="h-4 w-4" /> Parar gravação
                              </Button>
                            )}
                            {audioBlob && !recording && (
                              <>
                                <Button variant="outline" size="sm" onClick={toggleAudioPlay} className="gap-1">
                                  {audioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                  {audioPlaying ? 'Pausar' : 'Ouvir'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => { setAudioBlob(null); setAudioBlobUrl(''); setRecordingTime(0); }} className="gap-1">
                                  <RotateCcw className="h-4 w-4" /> Regravar
                                </Button>
                                <Button size="sm" onClick={confirmRecording} disabled={mediaUploading} className="gap-1">
                                  {mediaUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                  Usar gravação
                                </Button>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button onClick={toggleAudioPlay}
                              className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0">
                              {audioPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                            </button>
                            <div>
                              <div className="flex items-center gap-1">
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-xs font-medium text-emerald-700">Áudio salvo</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{formatRecordingTime(recordingTime)} · {formatFileSize(mediaFileSize)}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={clearAudio} className="gap-1 text-muted-foreground">
                            <RotateCcw className="h-3.5 w-3.5" /> Regravar
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENT */}
              {payloadType === 'document' && (
                <div className="space-y-3">
                  <Label>Documento</Label>
                  {!mediaFileName ? (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/10 transition-colors">
                      <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <span className="text-sm font-medium text-muted-foreground">Clique para selecionar documento</span>
                      <span className="text-xs text-muted-foreground/60 mt-1">PDF, DOC, DOCX, XLS, XLSX — máx. 20 MB</span>
                      <input type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleDocSelect} />
                    </label>
                  ) : (
                    <div className="rounded-xl border p-3 flex items-center justify-between bg-card">
                      <div className="flex items-center gap-3">
                        {docIcon(docMimeType)}
                        <div>
                          {uploadedMediaUrl
                            ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500 inline mr-1" />
                            : <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground inline mr-1" />
                          }
                          <span className="text-xs font-medium">{mediaFileName}</span>
                          {mediaFileSize > 0 && <p className="text-xs text-muted-foreground">{formatFileSize(mediaFileSize)}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <label title="Trocar" className="cursor-pointer p-1.5 rounded hover:bg-muted transition-colors">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          <input type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleDocSelect} />
                        </label>
                        <button onClick={clearDoc} className="p-1.5 rounded hover:bg-muted transition-colors">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  )}
                  {mediaFileName && (
                    <div>
                      <Label className="text-sm">Nome do arquivo no WhatsApp</Label>
                      <Input value={docDisplayName} onChange={e => setDocDisplayName(e.target.value)} className="mt-1" placeholder="Ex: Proposta Comercial.pdf" />
                      <p className="text-xs text-muted-foreground mt-1">Este é o nome que aparecerá para o destinatário</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm">Legenda (opcional)</Label>
                    <Textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2} placeholder="Mensagem junto ao documento..." className="mt-1" />
                  </div>
                </div>
              )}

              {/* Upload progress indicator */}
              {mediaUploading && needsMedia && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando arquivo para o servidor...
                </div>
              )}

              {/* Speed presets */}
              <div className="space-y-2">
                <Label>Velocidade dos disparos</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={minDelay === 1 && maxDelay === 3 && batchSize === 15 ? 'default' : 'outline'}
                    onClick={() => { setMinDelay(1); setMaxDelay(3); setBatchSize(15); setLimitPerHour(500); }}
                  >
                    Rápido (1–3s)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={minDelay === 3 && maxDelay === 8 && batchSize === 10 ? 'default' : 'outline'}
                    onClick={() => { setMinDelay(3); setMaxDelay(8); setBatchSize(10); setLimitPerHour(300); }}
                  >
                    Balanceado (3–8s) — recomendado
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={minDelay === 10 && maxDelay === 25 && batchSize === 5 ? 'default' : 'outline'}
                    onClick={() => { setMinDelay(10); setMaxDelay(25); setBatchSize(5); setLimitPerHour(100); }}
                  >
                    Seguro (10–25s)
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Quanto mais rápido, maior o risco de o WhatsApp bloquear o número. Ajuste manualmente abaixo se quiser.
                </p>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Delay mínimo (seg)</Label><Input type="number" value={minDelay} onChange={e => setMinDelay(+e.target.value)} /></div>
                <div><Label>Delay máximo (seg)</Label><Input type="number" value={maxDelay} onChange={e => setMaxDelay(+e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>Limite/hora</Label><Input type="number" value={limitPerHour} onChange={e => setLimitPerHour(+e.target.value)} /></div>
                <div><Label>Msgs por lote</Label><Input type="number" min={1} max={50} value={batchSize} onChange={e => setBatchSize(+e.target.value)} /></div>
                <div></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Janela início (opcional)</Label><Input type="time" value={windowStart} onChange={e => setWindowStart(e.target.value)} placeholder="24h" /></div>
                <div><Label>Janela fim (opcional)</Label><Input type="time" value={windowEnd} onChange={e => setWindowEnd(e.target.value)} placeholder="24h" /></div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={noDuplicate} onCheckedChange={setNoDuplicate} />
                <Label>Não reenviar para o mesmo telefone nesta campanha</Label>
              </div>

              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-3">
                  <Switch checked={enableAutomation} onCheckedChange={setEnableAutomation} />
                  <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /><Label className="font-medium">Iniciar automação após resposta</Label></div>
                </div>
                {enableAutomation && (
                  <div className="space-y-2">
                    <Select value={selectedAutomationId} onValueChange={setSelectedAutomationId}>
                      <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione uma automação..." /></SelectTrigger>
                      <SelectContent>{(automations || []).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <div>
                      <Label className="text-sm">Janela de resposta (horas)</Label>
                      <Input type="number" min={1} max={168} value={responseWindowHours} onChange={e => setResponseWindowHours(+e.target.value)} className="mt-1 w-32" />
                    </div>
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-3">
                  <Switch checked={scheduleMode === 'later'} onCheckedChange={v => setScheduleMode(v ? 'later' : 'now')} />
                  <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-purple-500" /><Label className="font-medium">Agendar para depois</Label></div>
                </div>
                {scheduleMode === 'later' && (
                  <div>
                    <Label className="text-sm">Data e hora do disparo</Label>
                    <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} min={new Date().toISOString().slice(0, 16)} className="mt-1 w-full" />
                    <Alert className="mt-2"><Info className="h-4 w-4" /><AlertDescription className="text-xs">A campanha será criada com status "Agendada". Para iniciar automaticamente no horário, configure um cron job no Supabase que chame o broadcast-worker.</AlertDescription></Alert>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════ STEP 3 ══════ */}
          {step === 3 && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-2">
                  {[
                    ['Campanha', campaignName],
                    ['Instância', instanceName],
                    ['Tipo', payloadType === 'text' ? 'Texto' : payloadType === 'interactive' ? 'Botões' : payloadType === 'image' ? 'Imagem' : payloadType === 'audio' ? 'Áudio' : 'Documento'],
                    ['Fonte', sourceType === 'spreadsheet' ? 'Planilha' : sourceType === 'crm_leads' ? 'Leads CRM' : 'Inbox'],
                    ['Total válidos', rows.length],
                    ...(discarded > 0 ? [['Inválidos removidos', discarded]] : []),
                    ...(duplicates > 0 ? [['Duplicatas removidas', duplicates]] : []),
                    ['Velocidade', `${minDelay}–${maxDelay}s · lote ${batchSize}`],
                    ['Limite/hora', limitPerHour],
                    ['Janela', windowStart && windowEnd ? `${windowStart} – ${windowEnd}` : 'Sem restrição (24h)'],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium">{String(value)}</span>
                    </div>
                  ))}
                  {scheduleMode === 'later' && scheduledAt && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Agendado para</span>
                      <span className="text-sm font-medium text-purple-600">{format(new Date(scheduledAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                  {enableAutomation && selectedAutomationId && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Automação</span>
                      <Badge variant="secondary" className="gap-1"><Zap className="h-3 w-3" />{automations?.find(a => a.id === selectedAutomationId)?.name || 'Selecionada'}</Badge>
                    </div>
                  )}
                  {needsMedia && mediaFileName && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Arquivo</span>
                      <span className="text-sm font-medium truncate max-w-[200px]">{mediaFileName}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(payloadType === 'text' || payloadType === 'interactive') && messageText && (
                <Card>
                  <CardContent className="p-4">
                    <Label className="text-xs text-muted-foreground">Preview da mensagem</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{messageText}</p>
                    {payloadType === 'interactive' && buttons.filter(b => b.label).length > 0 && (
                      <div className="flex gap-2 mt-2">{buttons.filter(b => b.label).map((b, i) => <Badge key={i} variant="outline" className="text-xs">{b.label}</Badge>)}</div>
                    )}
                  </CardContent>
                </Card>
              )}

              {payloadType === 'image' && imagePreviewUrl && (
                <Card>
                  <CardContent className="p-4">
                    <Label className="text-xs text-muted-foreground mb-2 block">Preview da imagem</Label>
                    <img src={imagePreviewUrl} alt="preview" className="max-h-40 rounded-lg object-contain" />
                    {caption && <p className="text-xs text-muted-foreground mt-2 italic">{caption}</p>}
                  </CardContent>
                </Card>
              )}

              {rows.length === 0 && (
                <Alert variant="destructive"><AlertDescription>Nenhum destinatário válido. Volte e verifique a fonte.</AlertDescription></Alert>
              )}
            </div>
          )}
        </div>

        {/* ── Fixed footer ── */}
        <div className="shrink-0 border-t px-6 py-4">
          {step === 1 && (
            <div className="flex justify-end">
              <Button onClick={goToStep2} disabled={!canGoToStep2()} className="gap-2">
                Próximo <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          {step === 2 && (
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
              <Button onClick={() => setStep(3)} disabled={!step2Valid} className="gap-2">Próximo <ArrowRight className="h-4 w-4" /></Button>
            </div>
          )}
          {step === 3 && (
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
              <Button onClick={handleCreate} disabled={createCampaign.isPending || rows.length === 0} className="gap-2">
                {createCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : scheduleMode === 'later' ? <Calendar className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {scheduleMode === 'later' ? 'Agendar campanha' : 'Criar e iniciar'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
