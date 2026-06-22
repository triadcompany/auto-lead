import { useState } from 'react';
import { useProspects, Prospect } from '@/hooks/useProspects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Plus, Loader2, Trash2, Edit, Building2, Phone, Mail, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/PageHeader';

export default function Prospeccao() {
  const {
    prospects,
    loading,
    searchingCnpj,
    searchCnpj,
    addProspect,
    updateProspect,
    deleteProspect,
  } = useProspects();

  const [cnpjInput, setCnpjInput] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    owner_phone: '',
    owner_email: '',
  });

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  };

  const handleSearch = async () => {
    if (!cnpjInput) return;
    const result = await searchCnpj(cnpjInput);
    if (result) {
      setSearchResult(result);
      setShowAddDialog(true);
    }
  };

  const handleAddProspect = async () => {
    if (!searchResult) return;

    await addProspect({
      cnpj: searchResult.cnpj,
      company_name: searchResult.company_name,
      trade_name: searchResult.trade_name,
      owner_name: searchResult.owner_name,
      owner_phone: formData.owner_phone || null,
      owner_email: formData.owner_email || null,
      address: searchResult.address,
      city: searchResult.city,
      state: searchResult.state,
      status: searchResult.status,
      main_activity: searchResult.main_activity,
      raw_data: searchResult.raw_data,
    });

    setShowAddDialog(false);
    setSearchResult(null);
    setCnpjInput('');
    setFormData({ owner_phone: '', owner_email: '' });
  };

  const handleUpdateProspect = async () => {
    if (!editingProspect) return;

    await updateProspect(editingProspect.id, {
      owner_phone: formData.owner_phone,
      owner_email: formData.owner_email,
    });

    setEditingProspect(null);
    setFormData({ owner_phone: '', owner_email: '' });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteProspect(deleteId);
    setDeleteId(null);
  };

  const openEditDialog = (prospect: Prospect) => {
    setEditingProspect(prospect);
    setFormData({
      owner_phone: prospect.owner_phone || '',
      owner_email: prospect.owner_email || '',
    });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader 
        title="Prospecção" 
        description="Consulte empresas por CNPJ e monte sua lista de prospecção"
      />

      {/* Busca por CNPJ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Consultar CNPJ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Digite o CNPJ (ex: 00.000.000/0000-00)"
                value={cnpjInput}
                onChange={(e) => setCnpjInput(formatCnpj(e.target.value))}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={searchingCnpj || !cnpjInput}>
              {searchingCnpj ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Consultar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Prospects */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Lista de Prospecção
            <Badge variant="secondary" className="ml-2">
              {prospects.length} empresas
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : prospects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum prospect cadastrado ainda</p>
              <p className="text-sm">Consulte um CNPJ acima para começar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Sócio/Responsável</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospects.map((prospect) => (
                    <TableRow key={prospect.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {prospect.trade_name || prospect.company_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {prospect.cnpj.replace(
                              /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                              '$1.$2.$3/$4-$5'
                            )}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p>{prospect.owner_name || '-'}</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {prospect.owner_phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />
                              {prospect.owner_phone}
                            </div>
                          )}
                          {prospect.owner_email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />
                              {prospect.owner_email}
                            </div>
                          )}
                          {!prospect.owner_phone && !prospect.owner_email && (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {prospect.city && prospect.state ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {prospect.city}/{prospect.state}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            prospect.status?.toLowerCase().includes('ativa')
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {prospect.status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(prospect)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(prospect.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para adicionar prospect após consulta */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar à Lista de Prospecção</DialogTitle>
          </DialogHeader>
          {searchResult && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Razão Social</Label>
                  <p className="font-medium">{searchResult.company_name}</p>
                </div>
                {searchResult.trade_name && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Nome Fantasia</Label>
                    <p>{searchResult.trade_name}</p>
                  </div>
                )}
                {searchResult.owner_name && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Sócio Principal</Label>
                    <p>{searchResult.owner_name}</p>
                  </div>
                )}
                {searchResult.main_activity && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Atividade Principal</Label>
                    <p className="text-sm">{searchResult.main_activity}</p>
                  </div>
                )}
                {searchResult.address && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Endereço</Label>
                    <p className="text-sm">
                      {searchResult.address}, {searchResult.city}/{searchResult.state}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="owner_phone">Telefone do Responsável</Label>
                  <Input
                    id="owner_phone"
                    placeholder="(00) 00000-0000"
                    value={formData.owner_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, owner_phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="owner_email">Email do Responsável</Label>
                  <Input
                    id="owner_email"
                    type="email"
                    placeholder="email@empresa.com"
                    value={formData.owner_email}
                    onChange={(e) =>
                      setFormData({ ...formData, owner_email: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddProspect}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para editar prospect */}
      <Dialog open={!!editingProspect} onOpenChange={() => setEditingProspect(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          {editingProspect && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="font-medium">
                  {editingProspect.trade_name || editingProspect.company_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {editingProspect.owner_name}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="edit_phone">Telefone</Label>
                  <Input
                    id="edit_phone"
                    placeholder="(00) 00000-0000"
                    value={formData.owner_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, owner_phone: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit_email">Email</Label>
                  <Input
                    id="edit_email"
                    type="email"
                    placeholder="email@empresa.com"
                    value={formData.owner_email}
                    onChange={(e) =>
                      setFormData({ ...formData, owner_email: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProspect(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateProspect}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este prospect da lista? Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
