import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Paperclip,
  Smile,
  Mic,
  Send,
  X,
  Square,
  Loader2,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const EmojiPicker = React.lazy(() => import('emoji-picker-react'));

const MAX_VIDEO_MB = 500; // Vídeos até 500MB
const MAX_OTHER_MB = 16; // Demais mídias (WhatsApp media limit)

export interface MediaPayload {
  file: File;
  kind: 'image' | 'video' | 'audio' | 'document';
  caption?: string;
}

interface MessageComposerProps {
  disabled?: boolean;
  sending?: boolean;
  value: string;
  onChange: (v: string) => void;
  onSendText: () => void | Promise<void>;
  onSendMedia: (payload: MediaPayload) => Promise<void>;
}

function inferKind(file: File): 'image' | 'video' | 'audio' | 'document' {
  const t = file.type;
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return 'document';
}

function formatElapsed(s: number) {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function MessageComposer({
  disabled,
  sending,
  value,
  onChange,
  onSendText,
  onSendMedia,
}: MessageComposerProps) {
  // ── Attachment preview ──
  const [pending, setPending] = useState<{ file: File; kind: MediaPayload['kind']; previewUrl?: string } | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const acceptRef = useRef<string>('*/*');

  // ── Emoji ──
  const [emojiOpen, setEmojiOpen] = useState(false);

  // ── Audio recording ──
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File handlers ──
  const openFilePicker = (accept: string) => {
    acceptRef.current = accept;
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const kind = inferKind(file);
    const maxMb = kind === 'video' ? MAX_VIDEO_MB : MAX_OTHER_MB;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Arquivo muito grande (máx. ${maxMb}MB)`);
      return;
    }
    const previewUrl = kind === 'image' || kind === 'video' ? URL.createObjectURL(file) : undefined;
    setPending({ file, kind, previewUrl });
    setCaption('');
  };

  const clearPending = () => {
    if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    setPending(null);
    setCaption('');
  };

  const handleSendPending = async () => {
    if (!pending) return;
    try {
      await onSendMedia({
        file: pending.file,
        kind: pending.kind,
        caption: caption.trim() || undefined,
      });
      clearPending();
    } catch {
      // hook surfaces error
    }
  };

  // ── Audio recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (blob.size > 0) {
          const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
          try {
            await onSendMedia({ file, kind: 'audio' });
          } catch {
            // hook surfaces error
          }
        }
      };
      mr.start(100);
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      console.error('mic error', err);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopAndSend = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelRecording = () => {
    // Discard chunks before stopping
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setElapsed(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ── Text handlers ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (pending) {
        handleSendPending();
      } else {
        onSendText();
      }
    }
  };

  const insertEmoji = (emoji: string) => {
    if (pending) {
      setCaption((c) => c + emoji);
    } else {
      onChange(value + emoji);
    }
    setEmojiOpen(false);
  };

  const sendDisabled =
    sending ||
    disabled ||
    (pending ? false : value.trim().length === 0);

  // ── Recording UI overrides everything ──
  if (recording) {
    return (
      <div className="flex items-center gap-2 p-3 border-t border-border bg-card/30">
        <div className="flex items-center gap-2 flex-1 bg-destructive/10 rounded-full px-4 py-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium text-destructive tabular-nums">
            {formatElapsed(elapsed)}
          </span>
          <span className="text-xs text-muted-foreground ml-1">Gravando…</span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-full text-muted-foreground hover:text-destructive"
          onClick={cancelRecording}
          title="Cancelar"
        >
          <X className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90"
          onClick={stopAndSend}
          title="Parar e enviar"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card/30">
      {/* Attachment preview */}
      {pending && (
        <div className="px-3 pt-3">
          <div className="rounded-xl border border-border bg-background p-3 flex gap-3 items-start">
            <div className="flex-shrink-0">
              {pending.kind === 'image' && pending.previewUrl ? (
                <img
                  src={pending.previewUrl}
                  alt="preview"
                  className="h-20 w-20 rounded-lg object-cover"
                />
              ) : pending.kind === 'video' && pending.previewUrl ? (
                <video
                  src={pending.previewUrl}
                  className="h-20 w-20 rounded-lg object-cover bg-black"
                  muted
                />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                  {pending.kind === 'audio' ? (
                    <Mic className="h-8 w-8 text-muted-foreground" />
                  ) : (
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{pending.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(pending.file.size / 1024).toFixed(0)} KB · {pending.kind}
              </p>
              {(pending.kind === 'image' || pending.kind === 'video' || pending.kind === 'document') && (
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Adicionar legenda..."
                  className="mt-2 min-h-[36px] max-h-[80px] resize-none text-sm"
                  rows={1}
                />
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={clearPending}
              title="Remover"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Composer row */}
      <div className="flex items-end gap-1.5 p-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelected}
        />

        {/* Attach */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 flex-shrink-0 text-muted-foreground hover:text-foreground rounded-full"
              disabled={disabled || !!pending}
              title="Anexar"
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-52">
            <DropdownMenuItem
              onClick={() =>
                openFilePicker(
                  'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm'
                )
              }
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Foto ou vídeo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFilePicker('image/jpeg,image/png,image/webp,image/gif')}>
              <ImageIcon className="h-4 w-4 mr-2" />
              Apenas imagem
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFilePicker('video/mp4,video/quicktime,video/webm')}>
              <VideoIcon className="h-4 w-4 mr-2" />
              Apenas vídeo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                openFilePicker(
                  '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )
              }
            >
              <FileText className="h-4 w-4 mr-2" />
              Documento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Emoji */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 flex-shrink-0 text-muted-foreground hover:text-foreground rounded-full"
              disabled={disabled}
              title="Emoji"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="p-0 border-0 bg-transparent shadow-none w-auto"
          >
            <React.Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Carregando…</div>}>
              <EmojiPicker
                onEmojiClick={(d) => insertEmoji(d.emoji)}
                lazyLoadEmojis
                width={320}
                height={380}
                searchPlaceHolder="Buscar emoji..."
              />
            </React.Suspense>
          </PopoverContent>
        </Popover>

        {/* Text input */}
        <Textarea
          value={pending ? caption : value}
          onChange={(e) => (pending ? setCaption(e.target.value) : onChange(e.target.value))}
          onKeyDown={handleKeyDown}
          placeholder={pending ? 'Adicionar legenda...' : 'Mensagem… Enter para enviar, Shift+Enter para nova linha'}
          className={cn(
            'flex-1 min-h-[40px] max-h-[120px] resize-none text-sm bg-background rounded-2xl px-4 py-2.5'
          )}
          rows={1}
          disabled={disabled || sending}
        />

        {/* Mic (when no text and no pending) */}
        {!pending && value.trim().length === 0 && (
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 flex-shrink-0 text-muted-foreground hover:text-foreground rounded-full"
            onClick={startRecording}
            disabled={disabled || sending}
            title="Gravar áudio"
          >
            <Mic className="h-5 w-5" />
          </Button>
        )}

        {/* Send */}
        <Button
          size="icon"
          onClick={pending ? handleSendPending : onSendText}
          disabled={sendDisabled}
          className="h-10 w-10 flex-shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground"
          title="Enviar"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
