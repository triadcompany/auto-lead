import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversationTransfer, TransferSeller } from '@/hooks/useConversationTransfer';

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  orgId: string;
  leadName?: string;
}

export function TransferModal({
  open,
  onOpenChange,
  conversationId,
  orgId,
  leadName,
}: TransferModalProps) {
  const { sellers, loadingSellers, fetchSellers, transferConversation, transferring } =
    useConversationTransfer(orgId);

  const [selectedSeller, setSelectedSeller] = useState<TransferSeller | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      fetchSellers();
      setSelectedSeller(null);
      setNote('');
    }
  }, [open, fetchSellers]);

  const handleTransfer = async () => {
    if (!selectedSeller) return;
    const ok = await transferConversation(conversationId, selectedSeller.id, note);
    if (ok) onOpenChange(false);
  };

  const defaultMessage = selectedSeller
    ? `Olá ${leadName ?? ''}! Vou te conectar com ${selectedSeller.name}, nosso consultor especialista. Ele dará continuidade ao seu atendimento.`.trim()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-orange-400" />
            Transferir conversa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seller list */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Escolha o vendedor</p>
            {loadingSellers ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sellers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum vendedor encontrado
              </p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {sellers.map((seller) => (
                  <button
                    key={seller.id}
                    onClick={() => setSelectedSeller(seller)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left',
                      selectedSeller?.id === seller.id
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-border hover:bg-accent',
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px] bg-muted">
                          {getInitials(seller.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{seller.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {seller.open_conversation_count === 0
                            ? 'Nenhuma conversa aberta'
                            : `${seller.open_conversation_count} conversa${seller.open_conversation_count > 1 ? 's' : ''} aberta${seller.open_conversation_count > 1 ? 's' : ''}`}
                        </p>
                      </div>
                    </div>
                    {selectedSeller?.id === seller.id && (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">
                        Selecionado
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Internal note */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              Nota para o vendedor{' '}
              <span className="font-normal">(opcional — fica no histórico da conversa)</span>
            </p>
            <Textarea
              placeholder="Ex: Cliente quer Civic 0km, financiamento, entrada ~R$20k"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[70px] text-sm resize-none"
            />
          </div>

          {/* Auto message preview */}
          {selectedSeller && defaultMessage && (
            <div className="rounded-lg bg-green-950/40 border border-green-800/40 px-3 py-2.5">
              <p className="text-[11px] text-green-400 font-semibold mb-1">
                ✓ Mensagem automática que será enviada ao lead
              </p>
              <p className="text-xs text-green-300/80 italic">{defaultMessage}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={transferring}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleTransfer}
              disabled={!selectedSeller || transferring}
            >
              {transferring ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRightLeft className="h-4 w-4 mr-2" />
              )}
              {selectedSeller ? `Transferir para ${selectedSeller.name.split(' ')[0]}` : 'Transferir'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
