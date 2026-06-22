import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useApi } from "@/hooks/useApi"
import { useSocket } from "@/hooks/useSocket"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"

export interface Lead {
  id: string
  name: string
  email: string | null
  phone: string
  seller_id: string | null
  source: string | null
  interest: string | null
  observations: string | null
  stage_id: string
  pipeline_id: string | null
  created_at: string
  created_by: string | null
  valor_negocio?: number | null
  servico?: string | null
  cidade?: string | null
  estado?: string | null
  status?: string | null
}

export interface PipelineStage {
  id: string
  name: string
  position: number
  color: string | null
  isActive: boolean
}

export interface KanbanColumn {
  id: string
  title: string
  leads: Lead[]
  color: string | null
  count: number
  position: number
}

const stagesKey = (orgId: string | null, pipelineId: string | undefined) =>
  ["stages", orgId, pipelineId] as const

const leadsKey = (orgId: string | null, pipelineId: string | undefined) =>
  ["leads", orgId, pipelineId] as const

export function useLeads(pipelineId?: string) {
  const api = useApi()
  const { on } = useSocket()
  const { orgId } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState("")

  // ── Pipelines / stages ────────────────────────────────────────────────────
  const stagesQuery = useQuery({
    queryKey: stagesKey(orgId, pipelineId),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PipelineStage[]> => {
      let activePipelineId = pipelineId

      if (!activePipelineId) {
        const pipelines = await api.pipelines.list()
        const def = pipelines.find((p: any) => p.isDefault) || pipelines[0]
        if (!def) {
          const created = await api.pipelines.ensureDefault()
          activePipelineId = created?.id
        } else {
          activePipelineId = def.id
        }
      }

      if (!activePipelineId) return []
      return api.pipelines.stages(activePipelineId)
    },
  })

  // ── Leads ─────────────────────────────────────────────────────────────────
  const leadsQuery = useQuery({
    queryKey: leadsKey(orgId, pipelineId),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
    queryFn: () => api.leads.list({ pipeline_id: pipelineId }),
  })

  const leads: Lead[] = leadsQuery.data ?? []
  const stages: PipelineStage[] = stagesQuery.data ?? []
  const loading = leadsQuery.isLoading || stagesQuery.isLoading

  // ── Realtime via Socket.io (substitui Supabase Realtime) ──────────────────
  useEffect(() => {
    if (!orgId) return
    const key = leadsKey(orgId, pipelineId)

    const unsubs = [
      on("lead:created", () => queryClient.invalidateQueries({ queryKey: key })),
      on("lead:updated", () => queryClient.invalidateQueries({ queryKey: key })),
      on("lead:deleted", (data: any) => {
        queryClient.setQueryData<Lead[]>(key, (old) =>
          (old ?? []).filter((l) => l.id !== data?.leadId)
        )
      }),
      on("lead:moved", (data: any) => {
        queryClient.setQueryData<Lead[]>(key, (old) =>
          (old ?? []).map((l) =>
            l.id === data?.leadId ? { ...l, stage_id: data.toStageId } : l
          )
        )
      }),
    ]

    return () => unsubs.forEach((u) => u())
  }, [orgId, pipelineId, on, queryClient])

  // ── Derived state ─────────────────────────────────────────────────────────
  const filteredLeads = useMemo<Lead[]>(() => {
    if (!searchTerm.trim()) return leads
    const term = searchTerm.toLowerCase()
    return leads.filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        l.phone.includes(term) ||
        l.email?.toLowerCase().includes(term) ||
        l.interest?.toLowerCase().includes(term) ||
        l.observations?.toLowerCase().includes(term)
    )
  }, [leads, searchTerm])

  const kanbanColumns = useMemo<KanbanColumn[]>(() => {
    return stages
      .map((stage) => ({
        id: stage.id,
        title: stage.name,
        leads: filteredLeads.filter((l) => l.stage_id === stage.id),
        color: stage.color,
        count: filteredLeads.filter((l) => l.stage_id === stage.id).length,
        position: stage.position,
      }))
      .sort((a, b) => a.position - b.position)
  }, [filteredLeads, stages])

  // ── Mutations ─────────────────────────────────────────────────────────────
  const moveLeadMutation = useMutation({
    mutationFn: ({ leadId, newStageId }: { leadId: string; newStageId: string }) =>
      api.leads.moveStage(leadId, newStageId),
    onMutate: async ({ leadId, newStageId }) => {
      const key = leadsKey(orgId, pipelineId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Lead[]>(key)
      queryClient.setQueryData<Lead[]>(key, (old) =>
        (old ?? []).map((l) => (l.id === leadId ? { ...l, stage_id: newStageId } : l))
      )
      return { previous }
    },
    onError: (err: any, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(leadsKey(orgId, pipelineId), ctx.previous)
      toast({ title: "Erro", description: err.message || "Erro ao mover lead", variant: "destructive" })
    },
    onSuccess: () => toast({ title: "Sucesso", description: "Lead movido" }),
  })

  const updateLeadMutation = useMutation({
    mutationFn: ({ leadId, data }: { leadId: string; data: Partial<Lead> }) =>
      api.leads.update(leadId, data as any),
    onMutate: async ({ leadId, data }) => {
      const key = leadsKey(orgId, pipelineId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Lead[]>(key)
      queryClient.setQueryData<Lead[]>(key, (old) =>
        (old ?? []).map((l) => (l.id === leadId ? { ...l, ...data } : l))
      )
      return { previous }
    },
    onError: (err: any, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(leadsKey(orgId, pipelineId), ctx.previous)
      toast({ title: "Erro", description: err.message, variant: "destructive" })
    },
    onSuccess: () => toast({ title: "Sucesso", description: "Lead atualizado" }),
  })

  const addLeadMutation = useMutation({
    mutationFn: (data: Omit<Lead, "id" | "created_at" | "created_by"> & { stage_id?: string }) => {
      const stageId = data.stage_id || [...stages].sort((a, b) => a.position - b.position)[0]?.id
      if (!stageId) throw new Error("Nenhuma etapa disponível. Selecione uma etapa.")
      return api.leads.create({ ...data, stage_id: stageId } as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leadsKey(orgId, pipelineId) })
      toast({ title: "Sucesso", description: "Lead criado" })
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  })

  const deleteLeadMutation = useMutation({
    mutationFn: (leadId: string) => api.leads.delete(leadId),
    onMutate: async (leadId) => {
      const key = leadsKey(orgId, pipelineId)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Lead[]>(key)
      queryClient.setQueryData<Lead[]>(key, (old) => (old ?? []).filter((l) => l.id !== leadId))
      return { previous }
    },
    onError: (err: any, _, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(leadsKey(orgId, pipelineId), ctx.previous)
      toast({ title: "Erro", description: err.message, variant: "destructive" })
    },
    onSuccess: () => toast({ title: "Sucesso", description: "Lead excluído" }),
  })

  return {
    leads,
    stages,
    loading,
    searchTerm,
    setSearchTerm,
    filteredLeads,
    kanbanColumns,
    moveLead: (leadId: string, newStageId: string) =>
      moveLeadMutation.mutateAsync({ leadId, newStageId }),
    updateLead: (leadId: string, data: Partial<Lead>) =>
      updateLeadMutation.mutateAsync({ leadId, data }),
    addLead: (data: any) => addLeadMutation.mutateAsync(data),
    deleteLead: (leadId: string) => deleteLeadMutation.mutateAsync(leadId),
    refreshLeads: () => queryClient.invalidateQueries({ queryKey: leadsKey(orgId, pipelineId) }),
  }
}
