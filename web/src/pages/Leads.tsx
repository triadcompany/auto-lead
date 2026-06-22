import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  Eye, 
  Edit, 
  Users,
  UserCheck,
  Calendar
} from "lucide-react";
import { useSupabaseLeads, Lead } from "@/hooks/useSupabaseLeads";
import { useAuth } from "@/contexts/AuthContext";
import { AddLeadModal } from "@/components/modals/AddLeadModal";
import { EditLeadModal } from "@/components/modals/EditLeadModal";
import { EditObservationsModal } from "@/components/modals/EditObservationsModal";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { supabase } from "@/integrations/supabase/client";
import { MobileHeader } from "@/components/mobile/MobileHeader";
import { PageHeader } from "@/components/layout/PageHeader";

interface Profile {
  id: string;
  name: string;
  email: string;
}

export function Leads() {
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
  const [isEditObservationsOpen, setIsEditObservationsOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  const [sellers, setSellers] = useState<Profile[]>([]);
  
  const { leads, loading, updateLead, addLead, deleteLead, refreshLeads } = useSupabaseLeads();
  const { isAdmin } = useAuth();

  // Fetch sellers for filter (only for admins)
  useEffect(() => {
    const fetchSellers = async () => {
      if (!isAdmin) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email')
          .order('name');
        
        if (error) throw error;
        setSellers(data || []);
      } catch (error) {
        console.error('Error fetching sellers:', error);
      }
    };

    fetchSellers();
  }, [isAdmin]);

  // Filter leads based on search and seller
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm);
    
    const matchesSeller = selectedSeller === "all" || lead.seller_id === selectedSeller;
    
    return matchesSearch && matchesSeller;
  });

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setIsEditLeadOpen(true);
  };

  const handleSaveLead = (leadId: string, updatedLead: Partial<Lead>) => {
    updateLead(leadId, updatedLead);
  };

  const handleAddLead = (newLead: Omit<Lead, 'id' | 'created_at' | 'created_by' | 'stage_id'>) => {
    addLead(newLead);
  };

  const getStageColor = (stageId: string) => {
    // You can customize these colors based on stage
    const colors = [
      'bg-gray-100 text-gray-800',
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-yellow-100 text-yellow-800',
      'bg-purple-100 text-purple-800',
      'bg-emerald-100 text-emerald-800',
      'bg-cyan-100 text-cyan-800',
      'bg-red-100 text-red-800'
    ];
    return colors[Math.abs(stageId.charCodeAt(0)) % colors.length];
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-2 font-poppins text-muted-foreground">Carregando leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <MobileHeader title="Contatos" onSearch={() => setIsMobileSearchOpen(s => !s)} />

      {/* Mobile search bar */}
      {isMobileSearchOpen && (
        <div className="md:hidden px-4 py-2 bg-background border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              type="text"
              placeholder="Buscar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}
      
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header - Hidden on mobile */}
        <div className="hidden md:block">
          <PageHeader 
            title="Lista de Leads" 
            description="Gerencie todos os leads cadastrados no sistema"
          >
            <Button 
              onClick={() => setIsAddLeadOpen(true)}
              className="btn-gradient text-white font-poppins font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Lead
            </Button>
          </PageHeader>
        </div>

        {/* Filters Bar */}
        <Card className="card-gradient border-0">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Seller Filter (only for admins) */}
            {isAdmin && (
              <div className="flex items-center space-x-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filtrar por vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os usuários</SelectItem>
                    {sellers.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total de Leads</p>
                <p className="text-2xl font-bold">{filteredLeads.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Phone className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Com Telefone</p>
                <p className="text-2xl font-bold">{filteredLeads.filter(l => l.phone).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Com Email</p>
                <p className="text-2xl font-bold">{filteredLeads.filter(l => l.email).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Leads List */}
        <Card>
        <CardHeader>
          <CardTitle className="font-poppins">{filteredLeads.length} {filteredLeads.length === 1 ? 'Lead' : 'Leads'}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="font-poppins">Nenhum lead encontrado</p>
              <p className="text-sm">Tente ajustar os filtros ou adicione um novo lead</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredLeads.map((lead) => (
                <div key={lead.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1">
                          <h3 className="font-poppins font-medium text-foreground">
                            {lead.name}
                          </h3>
                          <div className="flex items-center space-x-4 mt-1">
                            {lead.phone && (
                              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{lead.phone}</span>
                              </div>
                            )}
                            {lead.email && (
                              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span>{lead.email}</span>
                              </div>
                            )}
                          </div>
                          {lead.source && (
                            <div className="mt-1">
                              <Badge variant="outline" className="text-xs">
                                {lead.source}
                              </Badge>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <Badge className={`text-xs ${getStageColor(lead.stage_id)}`}>
                            {lead.stage_name || 'Sem estágio'}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <AddTaskModal 
                        leadId={lead.id}
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditLead(lead)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {lead.observations && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>{lead.observations}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
        </Card>

        {/* Floating Action Button - Mobile only */}
        <button
          onClick={() => setIsAddLeadOpen(true)}
          className="md:hidden fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        open={isAddLeadOpen} 
        onOpenChange={setIsAddLeadOpen}
        onSave={handleAddLead}
      />

      {/* Edit Lead Modal */}
      <EditLeadModal 
        open={isEditLeadOpen} 
        onOpenChange={setIsEditLeadOpen}
        lead={selectedLead}
        onSave={handleSaveLead}
        onDelete={isAdmin ? deleteLead : undefined}
      />
    </div>
  );
}