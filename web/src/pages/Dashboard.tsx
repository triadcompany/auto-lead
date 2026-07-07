import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  TrendingUp,
  Target,
  Award,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSupabaseLeads } from "@/hooks/useSupabaseLeads";
import { useSalesStageIds } from "@/hooks/useSalesStageIds";
import { TasksWidget } from "@/components/tasks/TasksWidget";
import { useAuth } from "@/contexts/AuthContext";

export function Dashboard() {
  const { leads, stages, loading } = useSupabaseLeads();
  const { salesStageIds, loading: salesLoading } = useSalesStageIds();
  const { userName } = useAuth();

  // Calcular métricas reais baseadas nos dados
  const metrics = useMemo(() => {
    if (loading || salesLoading) return [];

    const totalLeads = leads.length;

    // Detectar leads vendidos usando o conjunto de stage_ids de TODAS as pipelines
    const soldLeads = leads.filter(lead =>
      lead.stage_id && salesStageIds.has(lead.stage_id)
    );
    const salesCount = soldLeads.length;

    const conversionRate = totalLeads > 0
      ? (salesCount / totalLeads * 100).toFixed(1)
      : '0.0';

    // Receita do mês: somente vendas com data de criação dentro do mês corrente
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const revenue = soldLeads
      .filter(lead => {
        if (!lead.created_at) return false;
        return new Date(lead.created_at) >= startOfMonth;
      })
      .reduce((total, lead) => {
        if (lead.valor_negocio) return total + lead.valor_negocio;
        const price = parseFloat(
          lead.price?.replace(/[^\d,]/g, '')?.replace(',', '.') || '0'
        );
        return total + (isNaN(price) ? 0 : price);
      }, 0);

    return [
      {
        title: "Total de Leads",
        value: totalLeads.toString(),
        change: "+0%",
        icon: Users,
        gradient: "from-primary to-primary/70"
      },
      {
        title: "Vendas Fechadas",
        value: salesCount.toString(),
        change: "+0%",
        icon: Target,
        gradient: "from-emerald-500 to-emerald-400"
      },
      {
        title: "Taxa de Conversão",
        value: `${conversionRate}%`,
        change: "+0%",
        icon: TrendingUp,
        gradient: "from-authority to-authority/70"
      },
      {
        title: "Receita do Mês",
        value: `R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
        change: "+0%",
        icon: DollarSign,
        gradient: "from-amber-500 to-amber-400"
      }
    ];
  }, [leads, salesStageIds, loading, salesLoading]);

  const firstName = (userName || 'Usuário').split(' ')[0];

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header compacto */}
      <div className="flex items-center justify-between pb-5 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-poppins font-bold text-foreground leading-tight">
            {greeting},{' '}
            <span className="text-primary">{firstName}</span>
          </h1>
          <p className="text-sm text-muted-foreground font-poppins mt-0.5 capitalize">
            {formattedDate}
          </p>
        </div>
        <Link to="/leads">
          <Button className="btn-gradient text-white font-poppins font-semibold shadow-md hover:shadow-lg transition-shadow">
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </Link>
      </div>

      {/* Metrics Cards - Improved */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {(loading || salesLoading) ? (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-lg overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          metrics.map((metric) => (
            <Card
              key={metric.title}
              className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${metric.gradient} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-poppins font-medium text-muted-foreground">
                      {metric.title}
                    </p>
                    <p className="text-3xl font-poppins font-bold text-foreground">
                      {metric.value}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      <span className="text-xs font-medium text-emerald-600">
                        {metric.change} vs mês anterior
                      </span>
                    </div>
                  </div>
                  <div className={`p-3 rounded-2xl bg-gradient-to-br ${metric.gradient} shadow-lg`}>
                    <metric.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Charts Row - Improved */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leads por Etapa */}
        <Card className="col-span-2 border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="font-poppins font-semibold text-lg flex items-center gap-2">
              <div className="w-2 h-6 bg-primary rounded-full"></div>
              Leads por Etapa do Funil
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[0,1,2,3].map(i => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : leads.length > 0 ? (
              <div className="space-y-4">
                {stages.map((stage) => {
                  const stageLeads = leads.filter(lead => lead.stage_id === stage.id);
                  const percentage = leads.length > 0 ? (stageLeads.length / leads.length * 100) : 0;
                  
                  return (
                    <div key={stage.id} className="group">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-3 h-3 rounded-full shadow-sm"
                            style={{ backgroundColor: stage.color || '#6366f1' }}
                          />
                          <span className="font-poppins text-sm font-medium">{stage.name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-poppins font-bold text-lg">{stageLeads.length}</span>
                          <span className="text-muted-foreground text-sm">({percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: stage.color || '#6366f1'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-poppins">
                  Adicione seus primeiros leads para ver a distribuição por etapas
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Vendedores */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="font-poppins font-semibold text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              <span>Top Vendedores</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leads.length > 0 ? (
              <div className="space-y-4">
                {Object.entries(
                  leads.reduce((acc, lead) => {
                    const sellerName = lead.seller_name || 'Vendedor';
                    acc[sellerName] = (acc[sellerName] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                )
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([seller, count], index) => (
                  <div key={seller} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-amber-100 text-amber-600' :
                        index === 1 ? 'bg-slate-200 text-slate-600' :
                        index === 2 ? 'bg-orange-100 text-orange-600' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </div>
                      <span className="font-poppins text-sm font-medium">{seller}</span>
                    </div>
                    <span className="font-poppins font-bold text-primary">{count} leads</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  <Award className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-poppins text-sm">
                  Ranking de vendedores aparecerá aqui
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tasks Widget */}
      <div className="grid gap-6">
        <TasksWidget />
      </div>

      {/* Quick Actions - Improved */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-gradient-to-br from-primary to-primary/70 rounded-2xl shadow-lg group-hover:scale-105 transition-transform">
                <Phone className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-poppins font-semibold text-lg">Follow-ups</h3>
                <p className="text-sm text-muted-foreground">0 ligações pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-gradient-to-br from-authority to-authority/70 rounded-2xl shadow-lg group-hover:scale-105 transition-transform">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-poppins font-semibold text-lg">E-mails</h3>
                <p className="text-sm text-muted-foreground">0 enviados hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-400 rounded-2xl shadow-lg group-hover:scale-105 transition-transform">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-poppins font-semibold text-lg">Reuniões</h3>
                <p className="text-sm text-muted-foreground">0 agendadas hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
