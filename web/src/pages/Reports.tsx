import React, { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Download, 
  Calendar,
  User,
  MapPin,
  Target,
  DollarSign,
  Users,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Activity
} from "lucide-react";
import { useSupabaseLeads } from "@/hooks/useSupabaseLeads";
import { useLeadSources } from "@/hooks/useLeadSources";
import { useSalesStageIds } from "@/hooks/useSalesStageIds";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, isWithinInterval, parseISO, format } from "date-fns";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 76%, 36%)", // green
  "hsl(38, 92%, 50%)", // amber
  "hsl(280, 65%, 60%)", // purple
  "hsl(200, 98%, 39%)", // cyan
  "hsl(346, 77%, 49%)", // rose
  "hsl(24, 95%, 53%)", // orange
  "hsl(173, 58%, 39%)", // teal
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export function Reports() {
  const { leads, stages, loading } = useSupabaseLeads();
  const { leadSources, loading: sourcesLoading } = useLeadSources();
  const { salesStageIds } = useSalesStageIds();
  const { profile, orgId: authOrgId } = useAuth();
  const orgId = authOrgId || profile?.organization_id;
  
  const [selectedPeriod, setSelectedPeriod] = useState("este_mes");
  const [selectedSource, setSelectedSource] = useState("todas");
  const [selectedSeller, setSelectedSeller] = useState("todos");
  const [selectedPipeline, setSelectedPipeline] = useState("todas");
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [pipelines, setPipelines] = useState<Array<{ id: string; name: string }>>([]);
  const [pipelineStageMap, setPipelineStageMap] = useState<Record<string, string>>({}); // stage_id -> pipeline_id

  // Fetch all pipelines and their stages (to map stages -> pipeline)
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: pipelineList } = await supabase.rpc('get_org_pipelines', { p_org_id: orgId });
        const list = (pipelineList || []) as Array<{ id: string; name: string }>;
        if (cancelled) return;
        setPipelines(list);

        const map: Record<string, string> = {};
        await Promise.all(
          list.map(async (p) => {
            const { data: stageList } = await supabase.rpc('get_pipeline_stages', { p_pipeline_id: p.id });
            (stageList || []).forEach((s: any) => {
              map[s.id] = p.id;
            });
          })
        );
        if (!cancelled) setPipelineStageMap(map);
      } catch (err) {
        console.error('Error loading pipelines for reports filter:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);


  const getDateRange = (period: string) => {
    const now = new Date();
    
    switch (period) {
      case "hoje":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "ontem":
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case "semana_passada":
        const lastWeekStart = startOfWeek(subWeeks(now, 1));
        const lastWeekEnd = endOfWeek(subWeeks(now, 1));
        return { start: lastWeekStart, end: lastWeekEnd };
      case "este_mes":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "mes_passado":
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case "ultimos_3_meses":
        return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
      case "custom":
        if (customDateRange.from && customDateRange.to) {
          return { start: startOfDay(customDateRange.from), end: endOfDay(customDateRange.to) };
        }
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "maximo":
        return { start: new Date(2020, 0, 1), end: now };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const filteredLeads = useMemo(() => {
    if (loading || !leads.length) return [];

    const { start, end } = getDateRange(selectedPeriod);
    
    return leads.filter(lead => {
      const leadDate = parseISO(lead.created_at);
      const isInDateRange = isWithinInterval(leadDate, { start, end });
      const sourceMatch = selectedSource === "todas" || lead.source === selectedSource;
      const sellerMatch = selectedSeller === "todos" || lead.seller_name === selectedSeller;
      const pipelineMatch =
        selectedPipeline === "todas" ||
        (lead.stage_id && pipelineStageMap[lead.stage_id] === selectedPipeline);
      
      return isInDateRange && sourceMatch && sellerMatch && pipelineMatch;
    });
  }, [leads, selectedPeriod, selectedSource, selectedSeller, selectedPipeline, pipelineStageMap, loading, customDateRange]);

  const uniqueSources = useMemo(() => {
    const registeredSources = leadSources.map(source => source.name);
    const usedSources = [...new Set(leads.map(lead => lead.source).filter(Boolean))];
    const allSources = [...new Set([...registeredSources, ...usedSources])];
    return allSources.sort();
  }, [leadSources, leads]);

  const uniqueSellers = useMemo(() => {
    const sellers = [...new Set(leads.map(lead => lead.seller_name).filter(Boolean))];
    return sellers.sort();
  }, [leads]);

  const reportMetrics = useMemo(() => {
    if (loading || !filteredLeads.length) {
      return {
        totalLeads: 0,
        salesCount: 0,
        conversionRate: 0,
        avgTicket: 0,
        totalRevenue: 0
      };
    }

    const totalLeads = filteredLeads.length;

    // Usa o conjunto de stage_ids de venda de TODAS as pipelines da org
    const soldLeads = filteredLeads.filter(lead =>
      lead.stage_id && salesStageIds.has(lead.stage_id)
    );

    const salesCount = soldLeads.length;
    const conversionRate = totalLeads > 0 ? (salesCount / totalLeads * 100) : 0;

    const totalRevenue = soldLeads.reduce((total, lead) => {
      if (lead.valor_negocio) return total + lead.valor_negocio;
      const price = parseFloat(
        lead.price?.replace(/[^\d,]/g, '')?.replace(',', '.') || '0'
      );
      return total + (isNaN(price) ? 0 : price);
    }, 0);

    const avgTicket = soldLeads.length > 0 ? totalRevenue / soldLeads.length : 0;

    return {
      totalLeads,
      salesCount,
      conversionRate,
      avgTicket,
      totalRevenue
    };
  }, [filteredLeads, salesStageIds, loading]);

  // Dados para o gráfico de barras por etapa
  const stageChartData = useMemo(() => {
    return stages.map((stage, index) => {
      const count = filteredLeads.filter(lead => lead.stage_id === stage.id).length;
      return {
        name: stage.name.length > 12 ? stage.name.substring(0, 12) + '...' : stage.name,
        fullName: stage.name,
        leads: count,
        color: stage.color || CHART_COLORS[index % CHART_COLORS.length]
      };
    });
  }, [stages, filteredLeads]);

  // Dados para o gráfico de pizza por origem
  const sourceChartData = useMemo(() => {
    const sourceMap = filteredLeads.reduce((acc, lead) => {
      const source = lead.source || 'Não informado';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(sourceMap)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([name, value], index) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        fullName: name,
        value,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }));
  }, [filteredLeads]);

  // Dados para vendedor
  const sellerChartData = useMemo(() => {
    const sellerMap = filteredLeads.reduce((acc, lead) => {
      const seller = lead.seller_name || 'Não atribuído';
      acc[seller] = (acc[seller] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(sellerMap)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, value], index) => ({
        name: name.length > 12 ? name.substring(0, 12) + '...' : name,
        fullName: name,
        leads: value,
        fill: CHART_COLORS[index % CHART_COLORS.length]
      }));
  }, [filteredLeads]);

  // Dados para o funil de conversão
  const funnelData = useMemo(() => {
    const totalLeads = filteredLeads.length;
    if (totalLeads === 0) return [];

    return stages.map((stage, index) => {
      const count = filteredLeads.filter(lead => lead.stage_id === stage.id).length;
      const percentage = (count / totalLeads) * 100;
      return {
        name: stage.name,
        value: count,
        percentage: percentage.toFixed(1),
        fill: stage.color || CHART_COLORS[index % CHART_COLORS.length]
      };
    });
  }, [stages, filteredLeads]);

  // Export PDF (mantendo a lógica existente)
  const exportToPDF = () => {
    if (filteredLeads.length === 0) {
      toast.error('Nenhum dado para exportar. Ajuste os filtros e tente novamente.');
      return;
    }
    try {
      const doc = new jsPDF();
      let currentY = 30;
      
      doc.setFontSize(20);
      doc.text('Relatório de Vendas', 20, currentY);
      currentY += 15;
      
      const periodLabels = {
        "hoje": "Hoje",
        "ontem": "Ontem",
        "semana_passada": "Semana Passada", 
        "este_mes": "Este Mês",
        "mes_passado": "Mês Passado",
        "ultimos_3_meses": "Últimos 3 Meses",
        "custom": "Data Personalizada",
        "maximo": "Período Completo"
      };
      
      doc.setFontSize(12);
      doc.text(`Período: ${periodLabels[selectedPeriod as keyof typeof periodLabels] || selectedPeriod}`, 20, currentY);
      currentY += 8;
      doc.text(`Data de geração: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, currentY);
      currentY += 15;
      
      doc.setFontSize(14);
      doc.text('Métricas Principais', 20, currentY);
      currentY += 10;
      
      doc.setFontSize(11);
      doc.text(`• Total de Leads: ${reportMetrics.totalLeads}`, 25, currentY);
      currentY += 7;
      doc.text(`• Vendas Fechadas: ${reportMetrics.salesCount}`, 25, currentY);
      currentY += 7;
      doc.text(`• Taxa de Conversão: ${reportMetrics.conversionRate.toFixed(1)}%`, 25, currentY);
      currentY += 7;
      doc.text(`• Ticket Médio: R$ ${reportMetrics.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 25, currentY);
      currentY += 7;
      doc.text(`• Receita Total: R$ ${reportMetrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 25, currentY);
      currentY += 20;

      if (stageChartData.length > 0) {
        doc.setFontSize(14);
        doc.text('Leads por Etapa', 20, currentY);
        currentY += 10;

        const stageData = stageChartData.map(s => [s.fullName, s.leads.toString()]);
        
        if (typeof (doc as any).autoTable === 'function') {
          (doc as any).autoTable({
            startY: currentY,
            head: [['Etapa', 'Quantidade']],
            body: stageData,
            theme: 'striped',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [59, 130, 246] }
          });
          currentY = (doc as any).lastAutoTable?.finalY + 15;
        }
      }
      
      doc.save(`relatorio-${format(new Date(), 'dd-MM-yyyy')}.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{payload[0]?.payload?.fullName || label}</p>
          <p className="text-sm text-primary font-semibold">{payload[0]?.value} leads</p>
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const percentage = filteredLeads.length > 0 
        ? ((payload[0].value / filteredLeads.length) * 100).toFixed(1) 
        : 0;
      return (
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{payload[0]?.payload?.fullName}</p>
          <p className="text-sm text-primary font-semibold">{payload[0]?.value} leads ({percentage}%)</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-screen">
      {/* Header */}
      <PageHeader 
        title="Relatórios" 
        description="Análises detalhadas e insights do seu funil de vendas"
      >
        <Button 
          className="btn-gradient text-white font-poppins font-medium shadow-lg hover:shadow-xl transition-all"
          onClick={exportToPDF}
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </PageHeader>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-0 bg-gradient-to-br from-card to-card/80 shadow-lg backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-1">
                <Calendar className="h-4 w-4 text-primary" />
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-44 border-0 bg-transparent font-poppins text-sm shadow-none focus:ring-0">
                    <SelectValue placeholder="Selecionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="ontem">Ontem</SelectItem>
                    <SelectItem value="semana_passada">Semana Passada</SelectItem>
                    <SelectItem value="este_mes">Este Mês</SelectItem>
                    <SelectItem value="mes_passado">Mês Passado</SelectItem>
                    <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
                    <SelectItem value="custom">Data Personalizada</SelectItem>
                    <SelectItem value="maximo">Máximo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {selectedPeriod === "custom" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[280px] justify-start text-left font-normal font-poppins text-sm",
                        !customDateRange.from && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {customDateRange.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, "dd/MM/yyyy")} -{" "}
                            {format(customDateRange.to, "dd/MM/yyyy")}
                          </>
                        ) : (
                          format(customDateRange.from, "dd/MM/yyyy")
                        )
                      ) : (
                        <span>Selecionar período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={{ from: customDateRange.from, to: customDateRange.to }}
                      onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              )}

              <div className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-1">
                <User className="h-4 w-4 text-primary" />
                <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                  <SelectTrigger className="w-44 border-0 bg-transparent font-poppins text-sm shadow-none focus:ring-0">
                    <SelectValue placeholder="Vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os vendedores</SelectItem>
                    {uniqueSellers.map((seller) => (
                      <SelectItem key={seller} value={seller}>{seller}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-1">
                <MapPin className="h-4 w-4 text-primary" />
                <Select value={selectedSource} onValueChange={setSelectedSource}>
                  <SelectTrigger className="w-44 border-0 bg-transparent font-poppins text-sm shadow-none focus:ring-0">
                    <SelectValue placeholder="Origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as origens</SelectItem>
                    {uniqueSources.map((source) => (
                      <SelectItem key={source} value={source}>{source}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 bg-background/50 rounded-lg px-3 py-1">
                <Target className="h-4 w-4 text-primary" />
                <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                  <SelectTrigger className="w-44 border-0 bg-transparent font-poppins text-sm shadow-none focus:ring-0">
                    <SelectValue placeholder="Pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as pipelines</SelectItem>
                    {pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="ml-auto flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">{filteredLeads.length} leads</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPI Cards */}
      <motion.div 
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-gradient-to-br from-blue-500/10 to-blue-600/5 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total de Leads</p>
                  <p className="text-3xl font-bold text-foreground">{reportMetrics.totalLeads}</p>
                  <div className="flex items-center gap-1 text-xs">
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">No período</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <Users className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Vendas Fechadas</p>
                  <p className="text-3xl font-bold text-foreground">{reportMetrics.salesCount}</p>
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-500 font-medium">Conversões</span>
                  </div>
                </div>
                <div className="p-3 bg-emerald-500/20 rounded-xl">
                  <Target className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-gradient-to-br from-amber-500/10 to-amber-600/5 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Taxa de Conversão</p>
                  <p className="text-3xl font-bold text-foreground">{reportMetrics.conversionRate.toFixed(1)}%</p>
                  <div className="flex items-center gap-1 text-xs">
                    <Zap className="h-3 w-3 text-amber-500" />
                    <span className="text-amber-500 font-medium">Lead → Venda</span>
                  </div>
                </div>
                <div className="p-3 bg-amber-500/20 rounded-xl">
                  <BarChart3 className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-gradient-to-br from-purple-500/10 to-purple-600/5 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Ticket Médio</p>
                  <p className="text-3xl font-bold text-foreground">
                    R$ {reportMetrics.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <div className="flex items-center gap-1 text-xs">
                    <DollarSign className="h-3 w-3 text-purple-500" />
                    <span className="text-purple-500 font-medium">Por venda</span>
                  </div>
                </div>
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <DollarSign className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Charts Row 1 */}
      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* Bar Chart - Leads por Etapa */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="font-poppins font-semibold flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              Leads por Etapa do Funil
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredLeads.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stageChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={90} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="leads" radius={[0, 6, 6, 0]}>
                      {stageChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Sem dados para o período selecionado</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart - Origem dos Leads */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="font-poppins font-semibold flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <PieChart className="h-4 w-4 text-primary" />
              </div>
              Distribuição por Origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sourceChartData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={sourceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {sourceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value, entry: any) => (
                        <span className="text-xs text-muted-foreground">{value}</span>
                      )}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <PieChart className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Sem dados para o período selecionado</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row 2 */}
      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {/* Performance por Vendedor */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/90 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="font-poppins font-semibold flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="h-4 w-4 text-primary" />
              </div>
              Performance por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sellerChartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sellerChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="leads" radius={[6, 6, 0, 0]}>
                      {sellerChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 flex items-center justify-center">
                <div className="text-center">
                  <Users className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Sem dados para o período selecionado</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo do Funil */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-card/90">
          <CardHeader className="pb-2">
            <CardTitle className="font-poppins font-semibold flex items-center gap-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelData.length > 0 ? (
              <div className="space-y-3">
                {funnelData.map((stage, index) => (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate max-w-[140px]">{stage.name}</span>
                      <span className="font-semibold">{stage.value} <span className="text-xs text-muted-foreground">({stage.percentage}%)</span></span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full rounded-full"
                        style={{ backgroundColor: stage.fill }}
                        initial={{ width: 0 }}
                        animate={{ width: `${stage.percentage}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm">Sem dados</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Revenue Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-0 shadow-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-primary/20 rounded-2xl">
                  <DollarSign className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Receita Total no Período</p>
                  <p className="text-4xl font-bold text-foreground">
                    R$ {reportMetrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-foreground">{reportMetrics.salesCount}</p>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div>
                  <p className="text-2xl font-bold text-foreground">{reportMetrics.conversionRate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Conversão</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    R$ {reportMetrics.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">Ticket Médio</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
