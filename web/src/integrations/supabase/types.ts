export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_agent_profiles: {
        Row: {
          agent_name: string
          agent_role: string
          autonomous_rules: Json | null
          business_description: string | null
          created_at: string
          created_by: string | null
          examples: Json | null
          funnel_rules: Json | null
          id: string
          is_active: boolean
          niche: string
          organization_id: string
          personality: string
          prioritization_rules: Json | null
          products_services: Json | null
          qualification_rules: Json | null
          questions_per_message: number
          response_length: string
          response_time: string
          rules: Json | null
          tone: string
          updated_at: string
          version: number
        }
        Insert: {
          agent_name?: string
          agent_role?: string
          autonomous_rules?: Json | null
          business_description?: string | null
          created_at?: string
          created_by?: string | null
          examples?: Json | null
          funnel_rules?: Json | null
          id?: string
          is_active?: boolean
          niche?: string
          organization_id: string
          personality?: string
          prioritization_rules?: Json | null
          products_services?: Json | null
          qualification_rules?: Json | null
          questions_per_message?: number
          response_length?: string
          response_time?: string
          rules?: Json | null
          tone?: string
          updated_at?: string
          version?: number
        }
        Update: {
          agent_name?: string
          agent_role?: string
          autonomous_rules?: Json | null
          business_description?: string | null
          created_at?: string
          created_by?: string | null
          examples?: Json | null
          funnel_rules?: Json | null
          id?: string
          is_active?: boolean
          niche?: string
          organization_id?: string
          personality?: string
          prioritization_rules?: Json | null
          products_services?: Json | null
          qualification_rules?: Json | null
          questions_per_message?: number
          response_length?: string
          response_time?: string
          rules?: Json | null
          tone?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ai_agent_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ai_agent_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ai_agent_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ai_agent_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_auto_reply_jobs: {
        Row: {
          conversation_id: string
          created_at: string
          error: string | null
          id: string
          idempotency_key: string
          inbound_message_id: string
          organization_id: string
          processed_at: string | null
          result: Json | null
          status: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key: string
          inbound_message_id: string
          organization_id: string
          processed_at?: string | null
          result?: Json | null
          status?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string
          inbound_message_id?: string
          organization_id?: string
          processed_at?: string | null
          result?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_auto_reply_jobs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_interactions: {
        Row: {
          agent_name: string
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          input_data: Json | null
          interaction_type: string
          organization_id: string | null
          output_data: Json | null
          status: string | null
          webhook_id: string | null
        }
        Insert: {
          agent_name: string
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          interaction_type: string
          organization_id?: string | null
          output_data?: Json | null
          status?: string | null
          webhook_id?: string | null
        }
        Update: {
          agent_name?: string
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_data?: Json | null
          interaction_type?: string
          organization_id?: string | null
          output_data?: Json | null
          status?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ai_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ai_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ai_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "ai_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_stage_actions: {
        Row: {
          ai_interaction_id: string | null
          applied_at: string | null
          applied_by: string | null
          conversation_id: string
          created_at: string
          from_stage_id: string | null
          from_stage_name: string | null
          id: string
          lead_id: string | null
          organization_id: string
          status: string
          suggested_action_type: string | null
          suggested_pipeline_id: string | null
          suggested_reason: string | null
          to_stage_id: string | null
          to_stage_name: string | null
        }
        Insert: {
          ai_interaction_id?: string | null
          applied_at?: string | null
          applied_by?: string | null
          conversation_id: string
          created_at?: string
          from_stage_id?: string | null
          from_stage_name?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          status?: string
          suggested_action_type?: string | null
          suggested_pipeline_id?: string | null
          suggested_reason?: string | null
          to_stage_id?: string | null
          to_stage_name?: string | null
        }
        Update: {
          ai_interaction_id?: string | null
          applied_at?: string | null
          applied_by?: string | null
          conversation_id?: string
          created_at?: string
          from_stage_id?: string | null
          from_stage_name?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          status?: string
          suggested_action_type?: string | null
          suggested_pipeline_id?: string | null
          suggested_reason?: string | null
          to_stage_id?: string | null
          to_stage_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_stage_actions_ai_interaction_id_fkey"
            columns: ["ai_interaction_id"]
            isOneToOne: false
            referencedRelation: "ai_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_stage_actions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_stage_actions_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          anotacoes: string | null
          arquivos: string[] | null
          client_id: string | null
          collaborator_id: string | null
          created_at: string | null
          criado_por: string | null
          datetime: string
          duration_minutes: number | null
          id: string
          organization_id: string | null
          patient_id: string | null
          professional_id: string | null
          status: string | null
          tipo: string
          updated_at: string
          valor_consulta: number | null
        }
        Insert: {
          anotacoes?: string | null
          arquivos?: string[] | null
          client_id?: string | null
          collaborator_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          datetime: string
          duration_minutes?: number | null
          id?: string
          organization_id?: string | null
          patient_id?: string | null
          professional_id?: string | null
          status?: string | null
          tipo: string
          updated_at?: string
          valor_consulta?: number | null
        }
        Update: {
          anotacoes?: string | null
          arquivos?: string[] | null
          client_id?: string | null
          collaborator_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          datetime?: string
          duration_minutes?: number | null
          id?: string
          organization_id?: string | null
          patient_id?: string | null
          professional_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string
          valor_consulta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_event_runs: {
        Row: {
          automation_event_id: string
          automation_id: string
          error: string | null
          finished_at: string | null
          id: string
          organization_id: string
          output: Json | null
          skipped_reason: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          automation_event_id: string
          automation_id: string
          error?: string | null
          finished_at?: string | null
          id?: string
          organization_id: string
          output?: Json | null
          skipped_reason?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          automation_event_id?: string
          automation_id?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          organization_id?: string
          output?: Json | null
          skipped_reason?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_event_runs_automation_event_id_fkey"
            columns: ["automation_event_id"]
            isOneToOne: false
            referencedRelation: "automation_events"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          conversation_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          error: string | null
          event_name: string
          id: string
          idempotency_key: string | null
          lead_id: string | null
          opportunity_id: string | null
          organization_id: string
          payload: Json | null
          processed_at: string | null
          source: string
          source_ai_interaction_id: string | null
          status: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          error?: string | null
          event_name: string
          id?: string
          idempotency_key?: string | null
          lead_id?: string | null
          opportunity_id?: string | null
          organization_id: string
          payload?: Json | null
          processed_at?: string | null
          source?: string
          source_ai_interaction_id?: string | null
          status?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          error?: string | null
          event_name?: string
          id?: string
          idempotency_key?: string | null
          lead_id?: string | null
          opportunity_id?: string | null
          organization_id?: string
          payload?: Json | null
          processed_at?: string | null
          source?: string
          source_ai_interaction_id?: string | null
          status?: string
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          automation_event_id: string | null
          automation_id: string | null
          channel: string | null
          created_at: string
          debug_json: Json
          event_name: string
          fail_reason: string | null
          id: string
          message_text: string | null
          organization_id: string
          phone: string | null
          status: string
          trace_id: string
        }
        Insert: {
          automation_event_id?: string | null
          automation_id?: string | null
          channel?: string | null
          created_at?: string
          debug_json?: Json
          event_name: string
          fail_reason?: string | null
          id?: string
          message_text?: string | null
          organization_id: string
          phone?: string | null
          status?: string
          trace_id: string
        }
        Update: {
          automation_event_id?: string | null
          automation_id?: string | null
          channel?: string | null
          created_at?: string
          debug_json?: Json
          event_name?: string
          fail_reason?: string | null
          id?: string
          message_text?: string | null
          organization_id?: string
          phone?: string | null
          status?: string
          trace_id?: string
        }
        Relationships: []
      }
      automation_flows: {
        Row: {
          automation_id: string
          created_at: string
          edges: Json
          entry_node_id: string | null
          id: string
          nodes: Json
          organization_id: string
          updated_at: string
          version: number
        }
        Insert: {
          automation_id: string
          created_at?: string
          edges?: Json
          entry_node_id?: string | null
          id?: string
          nodes?: Json
          organization_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          automation_id?: string
          created_at?: string
          edges?: Json
          entry_node_id?: string | null
          id?: string
          nodes?: Json
          organization_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_flows_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          attempts: number
          automation_id: string
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          node_id: string
          organization_id: string
          payload: Json | null
          run_id: string
          scheduled_for: string
          status: string
        }
        Insert: {
          attempts?: number
          automation_id: string
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          node_id: string
          organization_id: string
          payload?: Json | null
          run_id: string
          scheduled_for: string
          status?: string
        }
        Update: {
          attempts?: number
          automation_id?: string
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          node_id?: string
          organization_id?: string
          payload?: Json | null
          run_id?: string
          scheduled_for?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_jobs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_keyword_rules: {
        Row: {
          create_lead: boolean
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          lead_source: string
          match_type: string
          name: string
          organization_id: string
          pipeline_id: string | null
          priority: number
          stage_id: string | null
          tags: Json | null
          updated_at: string
        }
        Insert: {
          create_lead?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          lead_source?: string
          match_type?: string
          name: string
          organization_id: string
          pipeline_id?: string | null
          priority?: number
          stage_id?: string | null
          tags?: Json | null
          updated_at?: string
        }
        Update: {
          create_lead?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          lead_source?: string
          match_type?: string
          name?: string
          organization_id?: string
          pipeline_id?: string | null
          priority?: number
          stage_id?: string | null
          tags?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_keyword_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "automation_keyword_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "automation_keyword_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "automation_keyword_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "automation_keyword_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          automation_id: string | null
          created_at: string
          data: Json | null
          id: string
          level: string
          message: string | null
          node_id: string | null
          organization_id: string
          run_id: string | null
        }
        Insert: {
          automation_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          level?: string
          message?: string | null
          node_id?: string | null
          organization_id: string
          run_id?: string | null
        }
        Update: {
          automation_id?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          level?: string
          message?: string | null
          node_id?: string | null
          organization_id?: string
          run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          context: Json | null
          current_node_id: string | null
          entity_id: string
          entity_type: string
          finished_at: string | null
          id: string
          last_error: string | null
          organization_id: string
          started_at: string
          status: string
        }
        Insert: {
          automation_id: string
          context?: Json | null
          current_node_id?: string | null
          entity_id: string
          entity_type?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          organization_id: string
          started_at?: string
          status?: string
        }
        Update: {
          automation_id?: string
          context?: Json | null
          current_node_id?: string | null
          entity_id?: string
          entity_type?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          organization_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          allow_ai_triggers: boolean | null
          allow_human_triggers: boolean | null
          channel: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean | null
          name: string
          organization_id: string
          throttle_seconds: number | null
          trigger_event_name: string | null
          trigger_type: string | null
          updated_at: string
        }
        Insert: {
          allow_ai_triggers?: boolean | null
          allow_human_triggers?: boolean | null
          channel?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean | null
          name: string
          organization_id: string
          throttle_seconds?: number | null
          trigger_event_name?: string | null
          trigger_type?: string | null
          updated_at?: string
        }
        Update: {
          allow_ai_triggers?: boolean | null
          allow_human_triggers?: boolean | null
          channel?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean | null
          name?: string
          organization_id?: string
          throttle_seconds?: number | null
          trigger_event_name?: string | null
          trigger_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      broadcast_campaigns: {
        Row: {
          automation_id: string | null
          buttons: Json | null
          created_at: string
          created_by: string
          enable_automation: boolean
          id: string
          instance_name: string
          name: string
          organization_id: string
          payload: Json
          payload_type: string
          response_window_hours: number
          scheduled_at: string | null
          settings: Json
          source_filters: Json | null
          source_type: string
          status: string
        }
        Insert: {
          automation_id?: string | null
          buttons?: Json | null
          created_at?: string
          created_by: string
          enable_automation?: boolean
          id?: string
          instance_name: string
          name: string
          organization_id: string
          payload?: Json
          payload_type: string
          response_window_hours?: number
          scheduled_at?: string | null
          settings?: Json
          source_filters?: Json | null
          source_type?: string
          status?: string
        }
        Update: {
          automation_id?: string | null
          buttons?: Json | null
          created_at?: string
          created_by?: string
          enable_automation?: boolean
          id?: string
          instance_name?: string
          name?: string
          organization_id?: string
          payload?: Json
          payload_type?: string
          response_window_hours?: number
          scheduled_at?: string | null
          settings?: Json
          source_filters?: Json | null
          source_type?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_campaigns_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "broadcast_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          error: string | null
          id: string
          inbound_button_value: string | null
          inbound_text: string | null
          message_id: string | null
          name: string | null
          organization_id: string
          phone: string
          response_at: string | null
          response_message_id: string | null
          response_received: boolean
          sent_at: string | null
          status: string
          variables: Json | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          error?: string | null
          id?: string
          inbound_button_value?: string | null
          inbound_text?: string | null
          message_id?: string | null
          name?: string | null
          organization_id: string
          phone: string
          response_at?: string | null
          response_message_id?: string | null
          response_received?: boolean
          sent_at?: string | null
          status?: string
          variables?: Json | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          error?: string | null
          id?: string
          inbound_button_value?: string | null
          inbound_text?: string | null
          message_id?: string | null
          name?: string | null
          organization_id?: string
          phone?: string
          response_at?: string | null
          response_message_id?: string | null
          response_received?: boolean
          sent_at?: string | null
          status?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "broadcast_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          appointment_id: string | null
          attendees: string[] | null
          color: string | null
          created_at: string | null
          description: string | null
          end_time: string
          external_id: string | null
          id: string
          location: string | null
          metadata: Json | null
          organization_id: string | null
          source: string | null
          start_time: string
          sync_status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          all_day?: boolean | null
          appointment_id?: string | null
          attendees?: string[] | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          external_id?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          organization_id?: string | null
          source?: string | null
          start_time: string
          sync_status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          all_day?: boolean | null
          appointment_id?: string | null
          attendees?: string[] | null
          color?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          external_id?: string | null
          id?: string
          location?: string | null
          metadata?: Json | null
          organization_id?: string | null
          source?: string | null
          start_time?: string
          sync_status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "calendar_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capi_event_definitions: {
        Row: {
          active: boolean
          created_at: string
          default_currency: string
          id: string
          meta_event_name: string
          name: string
          organization_id: string
          send_location: boolean
          send_user_data: boolean
          send_value: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_currency?: string
          id?: string
          meta_event_name: string
          name: string
          organization_id: string
          send_location?: boolean
          send_user_data?: boolean
          send_value?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          default_currency?: string
          id?: string
          meta_event_name?: string
          name?: string
          organization_id?: string
          send_location?: boolean
          send_user_data?: boolean
          send_value?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "capi_event_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "capi_event_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "capi_event_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "capi_event_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "capi_event_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clerk_organizations: {
        Row: {
          clerk_org_id: string
          created_at: string
          created_by_clerk_user_id: string | null
          deleted_at: string | null
          id: string
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          clerk_org_id: string
          created_at?: string
          created_by_clerk_user_id?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          clerk_org_id?: string
          created_at?: string
          created_by_clerk_user_id?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          documentos: string | null
          email: string | null
          endereco: string | null
          id: string
          nascimento: string
          nome: string
          observacoes: string | null
          organization_id: string | null
          telefone: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          documentos?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nascimento: string
          nome: string
          observacoes?: string | null
          organization_id?: string | null
          telefone: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          documentos?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nascimento?: string
          nome?: string
          observacoes?: string | null
          organization_id?: string | null
          telefone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          active: boolean | null
          average_rating: number | null
          consultations_this_month: number | null
          created_at: string | null
          credentials: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          position: string
          total_consultations: number | null
          upcoming_appointments: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          average_rating?: number | null
          consultations_this_month?: number | null
          created_at?: string | null
          credentials?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          position: string
          total_consultations?: number | null
          upcoming_appointments?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          average_rating?: number | null
          consultations_this_month?: number | null
          created_at?: string | null
          credentials?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          position?: string
          total_consultations?: number | null
          upcoming_appointments?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaborators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "collaborators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "collaborators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "collaborators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "collaborators_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          appointment_id: string | null
          attachments: Json | null
          client_id: string | null
          collaborator_id: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          organization_id: string | null
          patient_id: string | null
          prescription: string | null
          professional_id: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          appointment_id?: string | null
          attachments?: Json | null
          client_id?: string | null
          collaborator_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          patient_id?: string | null
          prescription?: string | null
          professional_id?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          appointment_id?: string | null
          attachments?: Json | null
          client_id?: string | null
          collaborator_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          patient_id?: string | null
          prescription?: string | null
          professional_id?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "consultations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "consultations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "consultations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "consultations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_events: {
        Row: {
          conversation_id: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          organization_id: string
          performed_by: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          organization_id: string
          performed_by?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_intelligence: {
        Row: {
          confidence: number
          conversation_id: string
          id: string
          intent_label: string | null
          is_qualified: boolean
          last_detected_intent: string
          organization_id: string
          priority_level: string
          sentiment: string
          updated_at: string
          urgency_level: string
        }
        Insert: {
          confidence?: number
          conversation_id: string
          id?: string
          intent_label?: string | null
          is_qualified?: boolean
          last_detected_intent?: string
          organization_id: string
          priority_level?: string
          sentiment?: string
          updated_at?: string
          urgency_level?: string
        }
        Update: {
          confidence?: number
          conversation_id?: string
          id?: string
          intent_label?: string | null
          is_qualified?: boolean
          last_detected_intent?: string
          organization_id?: string
          priority_level?: string
          sentiment?: string
          updated_at?: string
          urgency_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_intelligence_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_intelligence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversation_intelligence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversation_intelligence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversation_intelligence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversation_intelligence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_mode: string
          ai_pending: boolean
          ai_pending_started_at: string | null
          ai_reply_count_since_last_lead: number
          ai_state: string | null
          assigned_at: string | null
          assigned_to: string | null
          channel: string
          contact_name: string | null
          contact_name_source: string | null
          contact_phone: string
          created_at: string
          group_name: string | null
          group_participants_count: number | null
          id: string
          instance_name: string
          is_group: boolean
          last_ai_reply_at: string | null
          last_message_at: string | null
          last_message_preview: string | null
          last_status_change_at: string | null
          lead_id: string | null
          locked_at: string | null
          locked_by: string | null
          organization_id: string
          profile_picture_updated_at: string | null
          profile_picture_url: string | null
          status: string
          unread_count: number
        }
        Insert: {
          ai_mode?: string
          ai_pending?: boolean
          ai_pending_started_at?: string | null
          ai_reply_count_since_last_lead?: number
          ai_state?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          channel?: string
          contact_name?: string | null
          contact_name_source?: string | null
          contact_phone: string
          created_at?: string
          group_name?: string | null
          group_participants_count?: number | null
          id?: string
          instance_name: string
          is_group?: boolean
          last_ai_reply_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_status_change_at?: string | null
          lead_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          organization_id: string
          profile_picture_updated_at?: string | null
          profile_picture_url?: string | null
          status?: string
          unread_count?: number
        }
        Update: {
          ai_mode?: string
          ai_pending?: boolean
          ai_pending_started_at?: string | null
          ai_reply_count_since_last_lead?: number
          ai_state?: string | null
          assigned_at?: string | null
          assigned_to?: string | null
          channel?: string
          contact_name?: string | null
          contact_name_source?: string | null
          contact_phone?: string
          created_at?: string
          group_name?: string | null
          group_participants_count?: number | null
          id?: string
          instance_name?: string
          is_group?: boolean
          last_ai_reply_at?: string | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_status_change_at?: string | null
          lead_id?: string | null
          locked_at?: string | null
          locked_by?: string | null
          organization_id?: string
          profile_picture_updated_at?: string | null
          profile_picture_url?: string | null
          status?: string
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_activities: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          lead_id: string | null
          new_value: string | null
          old_value: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id?: string | null
          new_value?: string | null
          old_value?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_notes: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string | null
          note: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id?: string | null
          note: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string | null
          note?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_to: string | null
          canal: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          email: string | null
          has_payment: boolean | null
          id: string
          is_highlight: boolean | null
          lost_reason: string | null
          name: string
          organization_id: string | null
          payment_value: number | null
          priority: string | null
          source: string | null
          stage: string | null
          updated_at: string | null
          updated_by: string | null
          value: number | null
          whatsapp: string | null
        }
        Insert: {
          assigned_to?: string | null
          canal?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string | null
          has_payment?: boolean | null
          id?: string
          is_highlight?: boolean | null
          lost_reason?: string | null
          name: string
          organization_id?: string | null
          payment_value?: number | null
          priority?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
          updated_by?: string | null
          value?: number | null
          whatsapp?: string | null
        }
        Update: {
          assigned_to?: string | null
          canal?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          email?: string | null
          has_payment?: boolean | null
          id?: string
          is_highlight?: boolean | null
          lost_reason?: string | null
          name?: string
          organization_id?: string | null
          payment_value?: number | null
          priority?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string | null
          updated_by?: string | null
          value?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "crm_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "crm_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "crm_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "crm_leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          order_index: number | null
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          order_index?: number | null
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number | null
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "crm_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "crm_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "crm_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "crm_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          categoria: string
          created_at: string | null
          data_despesa: string | null
          descricao: string
          id: string
          observacoes: string | null
          organization_id: string | null
          recorrente: boolean | null
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          data_despesa?: string | null
          descricao: string
          id?: string
          observacoes?: string | null
          organization_id?: string | null
          recorrente?: boolean | null
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          data_despesa?: string | null
          descricao?: string
          id?: string
          observacoes?: string | null
          organization_id?: string | null
          recorrente?: boolean | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "despesas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "despesas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "despesas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "despesas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_schedules: {
        Row: {
          assigned_user_ids: string[]
          bucket: string
          created_at: string
          days_of_week: number[]
          end_time: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          priority: number
          start_time: string
          updated_at: string
        }
        Insert: {
          assigned_user_ids?: string[]
          bucket?: string
          created_at?: string
          days_of_week?: number[]
          end_time: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          priority?: number
          start_time: string
          updated_at?: string
        }
        Update: {
          assigned_user_ids?: string[]
          bucket?: string
          created_at?: string
          days_of_week?: number[]
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          priority?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      entradas: {
        Row: {
          categoria: string
          cliente_id: string | null
          created_at: string | null
          data_entrada: string
          descricao: string
          id: string
          metodo_pagamento: string
          observacoes: string | null
          organization_id: string
          produto_servico_id: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          categoria: string
          cliente_id?: string | null
          created_at?: string | null
          data_entrada?: string
          descricao: string
          id?: string
          metodo_pagamento?: string
          observacoes?: string | null
          organization_id: string
          produto_servico_id?: string | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          categoria?: string
          cliente_id?: string | null
          created_at?: string | null
          data_entrada?: string
          descricao?: string
          id?: string
          metodo_pagamento?: string
          observacoes?: string | null
          organization_id?: string
          produto_servico_id?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "entradas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entradas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "entradas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "entradas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "entradas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "entradas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entradas_produto_servico_id_fkey"
            columns: ["produto_servico_id"]
            isOneToOne: false
            referencedRelation: "produtos_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      event_dispatch_queue: {
        Row: {
          attempts: number
          automation_id: string | null
          channel: string
          created_at: string
          event_hash: string
          event_name: string
          id: string
          last_error: string | null
          lead_id: string | null
          max_attempts: number
          next_retry_at: string | null
          organization_id: string
          payload: Json
          pipeline_id: string | null
          run_id: string | null
          sent_at: string | null
          stage_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          automation_id?: string | null
          channel?: string
          created_at?: string
          event_hash: string
          event_name: string
          id?: string
          last_error?: string | null
          lead_id?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          organization_id: string
          payload?: Json
          pipeline_id?: string | null
          run_id?: string | null
          sent_at?: string | null
          stage_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          automation_id?: string | null
          channel?: string
          created_at?: string
          event_hash?: string
          event_name?: string
          id?: string
          last_error?: string | null
          lead_id?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          organization_id?: string
          payload?: Json
          pipeline_id?: string | null
          run_id?: string | null
          sent_at?: string | null
          stage_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      evolution_webhook_logs: {
        Row: {
          auth_status: string | null
          created_at: string
          detected_organization_id: string | null
          error_message: string | null
          event_type: string | null
          id: string
          instance_name: string | null
          payload: Json | null
          processing_result: string | null
          remote_jid: string | null
        }
        Insert: {
          auth_status?: string | null
          created_at?: string
          detected_organization_id?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          instance_name?: string | null
          payload?: Json | null
          processing_result?: string | null
          remote_jid?: string | null
        }
        Update: {
          auth_status?: string | null
          created_at?: string
          detected_organization_id?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          instance_name?: string | null
          payload?: Json | null
          processing_result?: string | null
          remote_jid?: string | null
        }
        Relationships: []
      }
      external_integrations: {
        Row: {
          config: Json
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          integration_type: string
          is_active: boolean | null
          last_sync_at: string | null
          name: string
          organization_id: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          integration_type: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name: string
          organization_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          integration_type?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          name?: string
          organization_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      followup_cadences: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string
          steps: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organization_id: string
          steps?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organization_id?: string
          steps?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_cadences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followup_cadences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followup_cadences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followup_cadences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followup_cadences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_templates: {
        Row: {
          category: string
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
          variables: string[] | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followup_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followup_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followup_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followup_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      followups: {
        Row: {
          assigned_to: string
          cadence_id: string | null
          cadence_step: number | null
          channel: Database["public"]["Enums"]["message_channel"] | null
          created_at: string | null
          created_by: string
          id: string
          lead_id: string
          message_custom: string | null
          notes: string | null
          organization_id: string
          result_tag: string | null
          scheduled_for: string
          sent_at: string | null
          sent_by: Database["public"]["Enums"]["followup_sent_by"] | null
          status: Database["public"]["Enums"]["followup_status"] | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to: string
          cadence_id?: string | null
          cadence_step?: number | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          created_at?: string | null
          created_by: string
          id?: string
          lead_id: string
          message_custom?: string | null
          notes?: string | null
          organization_id: string
          result_tag?: string | null
          scheduled_for: string
          sent_at?: string | null
          sent_by?: Database["public"]["Enums"]["followup_sent_by"] | null
          status?: Database["public"]["Enums"]["followup_status"] | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string
          cadence_id?: string | null
          cadence_step?: number | null
          channel?: Database["public"]["Enums"]["message_channel"] | null
          created_at?: string | null
          created_by?: string
          id?: string
          lead_id?: string
          message_custom?: string | null
          notes?: string | null
          organization_id?: string
          result_tag?: string | null
          scheduled_for?: string
          sent_at?: string | null
          sent_by?: Database["public"]["Enums"]["followup_sent_by"] | null
          status?: Database["public"]["Enums"]["followup_status"] | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followups_cadence_id_fkey"
            columns: ["cadence_id"]
            isOneToOne: false
            referencedRelation: "followup_cadences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "followups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "followup_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_connections: {
        Row: {
          connected_by: string | null
          created_at: string | null
          id: string
          instagram_business_account_id: string
          instagram_username: string | null
          is_active: boolean | null
          organization_id: string
          page_access_token: string
          page_id: string
          page_name: string | null
          profile_picture_url: string | null
          updated_at: string | null
        }
        Insert: {
          connected_by?: string | null
          created_at?: string | null
          id?: string
          instagram_business_account_id: string
          instagram_username?: string | null
          is_active?: boolean | null
          organization_id: string
          page_access_token: string
          page_id: string
          page_name?: string | null
          profile_picture_url?: string | null
          updated_at?: string | null
        }
        Update: {
          connected_by?: string | null
          created_at?: string | null
          id?: string
          instagram_business_account_id?: string
          instagram_username?: string | null
          is_active?: boolean | null
          organization_id?: string
          page_access_token?: string
          page_id?: string
          page_name?: string | null
          profile_picture_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_conversation_tag_assignments: {
        Row: {
          assigned_by: string | null
          conversation_id: string
          created_at: string | null
          id: string
          tag_id: string
        }
        Insert: {
          assigned_by?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          assigned_by?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_conversation_tag_assignments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "instagram_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_conversation_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "instagram_conversation_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_conversation_tags: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_conversation_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_conversation_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_conversation_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_conversation_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_conversation_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_conversations: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          connection_id: string
          created_at: string | null
          first_response_at: string | null
          id: string
          instagram_conversation_id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          organization_id: string
          participant_id: string
          participant_name: string | null
          participant_profile_picture: string | null
          participant_username: string | null
          priority: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          connection_id: string
          created_at?: string | null
          first_response_at?: string | null
          id?: string
          instagram_conversation_id: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          organization_id: string
          participant_id: string
          participant_name?: string | null
          participant_profile_picture?: string | null
          participant_username?: string | null
          priority?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          connection_id?: string
          created_at?: string | null
          first_response_at?: string | null
          id?: string
          instagram_conversation_id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          organization_id?: string
          participant_id?: string
          participant_name?: string | null
          participant_profile_picture?: string | null
          participant_username?: string | null
          priority?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_conversations_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_distribution_config: {
        Row: {
          auto_assign_new: boolean | null
          created_at: string | null
          id: string
          max_concurrent_conversations: number | null
          mode: string | null
          organization_id: string
          updated_at: string | null
          working_hours_end: string | null
          working_hours_only: boolean | null
          working_hours_start: string | null
        }
        Insert: {
          auto_assign_new?: boolean | null
          created_at?: string | null
          id?: string
          max_concurrent_conversations?: number | null
          mode?: string | null
          organization_id: string
          updated_at?: string | null
          working_hours_end?: string | null
          working_hours_only?: boolean | null
          working_hours_start?: string | null
        }
        Update: {
          auto_assign_new?: boolean | null
          created_at?: string | null
          id?: string
          max_concurrent_conversations?: number | null
          mode?: string | null
          organization_id?: string
          updated_at?: string | null
          working_hours_end?: string | null
          working_hours_only?: boolean | null
          working_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_distribution_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_distribution_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_distribution_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_distribution_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_distribution_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_distribution_state: {
        Row: {
          id: string
          last_assigned_user_id: string | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          last_assigned_user_id?: string | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          last_assigned_user_id?: string | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_distribution_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_distribution_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_distribution_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_distribution_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_distribution_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          direction: string
          id: string
          instagram_message_id: string | null
          is_quick_reply: boolean | null
          media_url: string | null
          message_type: string | null
          quick_reply_id: string | null
          read_at: string | null
          sent_at: string | null
          sent_by: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          direction: string
          id?: string
          instagram_message_id?: string | null
          is_quick_reply?: boolean | null
          media_url?: string | null
          message_type?: string | null
          quick_reply_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          direction?: string
          id?: string
          instagram_message_id?: string | null
          is_quick_reply?: boolean | null
          media_url?: string | null
          message_type?: string | null
          quick_reply_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "instagram_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_metrics: {
        Row: {
          avg_response_time_seconds: number | null
          conversations_closed: number | null
          conversations_started: number | null
          created_at: string | null
          date: string
          first_response_count: number | null
          id: string
          messages_received: number | null
          messages_sent: number | null
          organization_id: string
          total_first_response_seconds: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avg_response_time_seconds?: number | null
          conversations_closed?: number | null
          conversations_started?: number | null
          created_at?: string | null
          date?: string
          first_response_count?: number | null
          id?: string
          messages_received?: number | null
          messages_sent?: number | null
          organization_id: string
          total_first_response_seconds?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avg_response_time_seconds?: number | null
          conversations_closed?: number | null
          conversations_started?: number | null
          created_at?: string | null
          date?: string
          first_response_count?: number | null
          id?: string
          messages_received?: number | null
          messages_sent?: number | null
          organization_id?: string
          total_first_response_seconds?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_quick_replies: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          organization_id: string
          shortcut: string | null
          title: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id: string
          shortcut?: string | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string
          shortcut?: string | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_quick_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_quick_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_quick_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_quick_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "instagram_quick_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_user_permissions: {
        Row: {
          can_respond: boolean | null
          can_transfer: boolean | null
          can_view: boolean | null
          connection_id: string
          created_at: string | null
          granted_by: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_respond?: boolean | null
          can_transfer?: boolean | null
          can_view?: boolean | null
          connection_id: string
          created_at?: string | null
          granted_by?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_respond?: boolean | null
          can_transfer?: boolean | null
          can_view?: boolean | null
          connection_id?: string
          created_at?: string | null
          granted_by?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instagram_user_permissions_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "instagram_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_definitions: {
        Row: {
          created_at: string
          id: string
          intent_key: string
          intent_label: string
          scope_id: string | null
          scope_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          intent_key: string
          intent_label: string
          scope_id?: string | null
          scope_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          intent_key?: string
          intent_label?: string
          scope_id?: string | null
          scope_type?: string
        }
        Relationships: []
      }
      investimentos_marketing: {
        Row: {
          campanha: string | null
          canal: string
          created_at: string | null
          data_investimento: string | null
          descricao: string | null
          id: string
          organization_id: string | null
          valor: number
        }
        Insert: {
          campanha?: string | null
          canal: string
          created_at?: string | null
          data_investimento?: string | null
          descricao?: string | null
          id?: string
          organization_id?: string | null
          valor: number
        }
        Update: {
          campanha?: string | null
          canal?: string
          created_at?: string | null
          data_investimento?: string | null
          descricao?: string | null
          id?: string
          organization_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "investimentos_marketing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "investimentos_marketing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "investimentos_marketing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "investimentos_marketing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "investimentos_marketing_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignment: {
        Row: {
          assigned_at: string | null
          assigned_user_id: string
          id: string
          lead_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_user_id: string
          id?: string
          lead_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_user_id?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignment_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_audit: {
        Row: {
          created_at: string | null
          data: Json | null
          event: string
          id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          event: string
          id?: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          event?: string
          id?: string
        }
        Relationships: []
      }
      lead_distribution_rules: {
        Row: {
          assigned_user_id: string
          created_at: string | null
          days_of_week: number[] | null
          distribution_setting_id: string
          end_time: string
          id: string
          is_active: boolean | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          assigned_user_id: string
          created_at?: string | null
          days_of_week?: number[] | null
          distribution_setting_id: string
          end_time: string
          id?: string
          is_active?: boolean | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          assigned_user_id?: string
          created_at?: string | null
          days_of_week?: number[] | null
          distribution_setting_id?: string
          end_time?: string
          id?: string
          is_active?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_rules_distribution_setting_id_fkey"
            columns: ["distribution_setting_id"]
            isOneToOne: false
            referencedRelation: "lead_distribution_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_settings: {
        Row: {
          created_at: string | null
          created_by: string
          distribution_type: string | null
          id: string
          is_auto_distribution_enabled: boolean | null
          manual_receiver_id: string | null
          mode: string | null
          organization_id: string
          rr_cursor: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          distribution_type?: string | null
          id?: string
          is_auto_distribution_enabled?: boolean | null
          manual_receiver_id?: string | null
          mode?: string | null
          organization_id: string
          rr_cursor?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          distribution_type?: string | null
          id?: string
          is_auto_distribution_enabled?: boolean | null
          manual_receiver_id?: string | null
          mode?: string | null
          organization_id?: string
          rr_cursor?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "lead_distribution_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "lead_distribution_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "lead_distribution_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "lead_distribution_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_state: {
        Row: {
          assignment_count: number | null
          distribution_setting_id: string
          id: string
          last_assigned_user_id: string | null
          last_assignment_at: string | null
          updated_at: string | null
        }
        Insert: {
          assignment_count?: number | null
          distribution_setting_id: string
          id?: string
          last_assigned_user_id?: string | null
          last_assignment_at?: string | null
          updated_at?: string | null
        }
        Update: {
          assignment_count?: number | null
          distribution_setting_id?: string
          id?: string
          last_assigned_user_id?: string | null
          last_assignment_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_state_distribution_setting_id_fkey"
            columns: ["distribution_setting_id"]
            isOneToOne: true
            referencedRelation: "lead_distribution_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_users: {
        Row: {
          created_at: string | null
          distribution_setting_id: string
          id: string
          is_active: boolean | null
          order_position: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          distribution_setting_id: string
          id?: string
          is_active?: boolean | null
          order_position?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          distribution_setting_id?: string
          id?: string
          is_active?: boolean | null
          order_position?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_users_distribution_setting_id_fkey"
            columns: ["distribution_setting_id"]
            isOneToOne: false
            referencedRelation: "lead_distribution_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_inbox: {
        Row: {
          created_at: string | null
          external_id: string
          id: string
          lead_id: string | null
          payload: Json | null
          received_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          external_id: string
          id?: string
          lead_id?: string | null
          payload?: Json | null
          received_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          external_id?: string
          id?: string
          lead_id?: string | null
          payload?: Json | null
          received_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "lead_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "lead_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "lead_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "lead_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          cidade: string | null
          created_at: string | null
          created_by: string
          email: string | null
          estado: string | null
          id: string
          interest: string | null
          last_inbound_message_at: string | null
          last_inbound_message_text: string | null
          last_reply_at: string | null
          lead_source_id: string | null
          name: string
          observations: string | null
          organization_id: string | null
          phone: string
          price: string | null
          seller_id: string | null
          servico: string | null
          source: string | null
          stage_id: string
          updated_at: string | null
          valor_negocio: number | null
        }
        Insert: {
          assigned_to?: string | null
          cidade?: string | null
          created_at?: string | null
          created_by: string
          email?: string | null
          estado?: string | null
          id?: string
          interest?: string | null
          last_inbound_message_at?: string | null
          last_inbound_message_text?: string | null
          last_reply_at?: string | null
          lead_source_id?: string | null
          name: string
          observations?: string | null
          organization_id?: string | null
          phone: string
          price?: string | null
          seller_id?: string | null
          servico?: string | null
          source?: string | null
          stage_id: string
          updated_at?: string | null
          valor_negocio?: number | null
        }
        Update: {
          assigned_to?: string | null
          cidade?: string | null
          created_at?: string | null
          created_by?: string
          email?: string | null
          estado?: string | null
          id?: string
          interest?: string | null
          last_inbound_message_at?: string | null
          last_inbound_message_text?: string | null
          last_reply_at?: string | null
          lead_source_id?: string | null
          name?: string
          observations?: string | null
          organization_id?: string | null
          phone?: string
          price?: string | null
          seller_id?: string | null
          servico?: string | null
          source?: string | null
          stage_id?: string
          updated_at?: string | null
          valor_negocio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_lead_source_id_fkey"
            columns: ["lead_source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_logs: {
        Row: {
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error_message: string | null
          followup_id: string | null
          id: string
          lead_id: string
          organization_id: string
          provider_message_id: string | null
          status: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["message_channel"]
          content: string
          created_at?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error_message?: string | null
          followup_id?: string | null
          id?: string
          lead_id: string
          organization_id: string
          provider_message_id?: string | null
          status?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["message_channel"]
          content?: string
          created_at?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          error_message?: string | null
          followup_id?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          provider_message_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "message_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "message_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "message_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "message_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_generated: boolean
          ai_interaction_id: string | null
          body: string
          channel: string
          conversation_id: string
          created_at: string
          direction: string
          duration_ms: number | null
          external_message_id: string | null
          id: string
          media_url: string | null
          message_type: string
          mime_type: string | null
          organization_id: string
          sender_avatar_url: string | null
          sender_name: string | null
          sender_phone: string | null
        }
        Insert: {
          ai_generated?: boolean
          ai_interaction_id?: string | null
          body: string
          channel?: string
          conversation_id: string
          created_at?: string
          direction: string
          duration_ms?: number | null
          external_message_id?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          mime_type?: string | null
          organization_id: string
          sender_avatar_url?: string | null
          sender_name?: string | null
          sender_phone?: string | null
        }
        Update: {
          ai_generated?: boolean
          ai_interaction_id?: string | null
          body?: string
          channel?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          duration_ms?: number | null
          external_message_id?: string | null
          id?: string
          media_url?: string | null
          message_type?: string
          mime_type?: string | null
          organization_id?: string
          sender_avatar_url?: string | null
          sender_name?: string | null
          sender_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_ai_interaction_id_fkey"
            columns: ["ai_interaction_id"]
            isOneToOne: false
            referencedRelation: "ai_interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_capi_dedup: {
        Row: {
          created_at: string
          event_id: string
          id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          organization_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_capi_dedup_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_dedup_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_dedup_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_dedup_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_dedup_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_capi_events: {
        Row: {
          attempts: number
          created_at: string
          deal_id: string | null
          dedupe_skipped: boolean | null
          event_id: string
          event_name: string
          event_time: string
          fail_reason: string | null
          id: string
          lead_id: string | null
          mapping_id: string | null
          organization_id: string
          payload_json: Json | null
          phone: string | null
          pipeline_id: string | null
          response_json: Json | null
          source: string | null
          stage_id: string | null
          status: string
          trace_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          deal_id?: string | null
          dedupe_skipped?: boolean | null
          event_id: string
          event_name: string
          event_time?: string
          fail_reason?: string | null
          id?: string
          lead_id?: string | null
          mapping_id?: string | null
          organization_id: string
          payload_json?: Json | null
          phone?: string | null
          pipeline_id?: string | null
          response_json?: Json | null
          source?: string | null
          stage_id?: string | null
          status?: string
          trace_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          deal_id?: string | null
          dedupe_skipped?: boolean | null
          event_id?: string
          event_name?: string
          event_time?: string
          fail_reason?: string | null
          id?: string
          lead_id?: string | null
          mapping_id?: string | null
          organization_id?: string
          payload_json?: Json | null
          phone?: string | null
          pipeline_id?: string | null
          response_json?: Json | null
          source?: string | null
          stage_id?: string | null
          status?: string
          trace_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_capi_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_capi_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_capi_events_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "meta_event_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_capi_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_capi_logs: {
        Row: {
          created_at: string
          fail_reason: string | null
          http_status: number | null
          id: string
          lead_id: string | null
          meta_event: string
          organization_id: string
          pipeline_id: string | null
          request_json: Json | null
          response_json: Json | null
          stage_id: string | null
          status: string
          trace_id: string | null
        }
        Insert: {
          created_at?: string
          fail_reason?: string | null
          http_status?: number | null
          id?: string
          lead_id?: string | null
          meta_event: string
          organization_id: string
          pipeline_id?: string | null
          request_json?: Json | null
          response_json?: Json | null
          stage_id?: string | null
          status?: string
          trace_id?: string | null
        }
        Update: {
          created_at?: string
          fail_reason?: string | null
          http_status?: number | null
          id?: string
          lead_id?: string | null
          meta_event?: string
          organization_id?: string
          pipeline_id?: string | null
          request_json?: Json | null
          response_json?: Json | null
          stage_id?: string | null
          status?: string
          trace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_capi_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_capi_mappings: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          meta_event: string
          organization_id: string
          pipeline_id: string | null
          priority: number
          stage_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          meta_event: string
          organization_id: string
          pipeline_id?: string | null
          priority?: number
          stage_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          meta_event?: string
          organization_id?: string
          pipeline_id?: string | null
          priority?: number
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_capi_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_capi_settings: {
        Row: {
          access_token: string
          created_at: string
          domain: string | null
          enabled: boolean
          id: string
          organization_id: string
          pixel_id: string
          test_event_code: string | null
          test_mode: boolean
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          domain?: string | null
          enabled?: boolean
          id?: string
          organization_id: string
          pixel_id: string
          test_event_code?: string | null
          test_mode?: boolean
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          domain?: string | null
          enabled?: boolean
          id?: string
          organization_id?: string
          pixel_id?: string
          test_event_code?: string | null
          test_mode?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_capi_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_event_mappings: {
        Row: {
          created_at: string
          dedupe_enabled: boolean
          dedupe_window_hours: number
          id: string
          is_active: boolean
          meta_event_name: string
          organization_id: string
          pipeline_id: string
          priority: number
          stage_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dedupe_enabled?: boolean
          dedupe_window_hours?: number
          id?: string
          is_active?: boolean
          meta_event_name?: string
          organization_id: string
          pipeline_id: string
          priority?: number
          stage_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dedupe_enabled?: boolean
          dedupe_window_hours?: number
          id?: string
          is_active?: boolean
          meta_event_name?: string
          organization_id?: string
          pipeline_id?: string
          priority?: number
          stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_event_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_event_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_event_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_event_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_event_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_events_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_id: string
          event_name: string
          event_time: number
          id: string
          lead_id: string | null
          organization_id: string
          payload: Json
          response: Json | null
          success: boolean | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_id: string
          event_name: string
          event_time: number
          id?: string
          lead_id?: string | null
          organization_id: string
          payload: Json
          response?: Json | null
          success?: boolean | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_id?: string
          event_name?: string
          event_time?: number
          id?: string
          lead_id?: string | null
          organization_id?: string
          payload?: Json
          response?: Json | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_events_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_events_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_events_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_events_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_events_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_events_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_integrations: {
        Row: {
          access_token: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          meta_test_event_code: string | null
          organization_id: string
          pixel_id: string
          test_mode: boolean | null
          track_lead_comprou: boolean | null
          track_lead_qualificado: boolean | null
          track_lead_super_qualificado: boolean | null
          track_lead_veio_loja: boolean | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          meta_test_event_code?: string | null
          organization_id: string
          pixel_id: string
          test_mode?: boolean | null
          track_lead_comprou?: boolean | null
          track_lead_qualificado?: boolean | null
          track_lead_super_qualificado?: boolean | null
          track_lead_veio_loja?: boolean | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          meta_test_event_code?: string | null
          organization_id?: string
          pixel_id?: string
          test_mode?: boolean | null
          track_lead_comprou?: boolean | null
          track_lead_qualificado?: boolean | null
          track_lead_super_qualificado?: boolean | null
          track_lead_veio_loja?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_credentials: {
        Row: {
          api_key_encrypted: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_test_at: string | null
          n8n_url: string
          organization_id: string | null
          test_error_message: string | null
          test_status: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_test_at?: string | null
          n8n_url: string
          organization_id?: string | null
          test_error_message?: string | null
          test_status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_test_at?: string | null
          n8n_url?: string
          organization_id?: string | null
          test_error_message?: string | null
          test_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "n8n_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "n8n_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "n8n_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "n8n_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "n8n_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      n8n_workflows: {
        Row: {
          created_at: string | null
          data_mapping: Json | null
          id: string
          is_active: boolean | null
          n8n_workflow_id: string | null
          name: string
          organization_id: string | null
          triggers: Json | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string | null
          data_mapping?: Json | null
          id?: string
          is_active?: boolean | null
          n8n_workflow_id?: string | null
          name: string
          organization_id?: string | null
          triggers?: Json | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string | null
          data_mapping?: Json | null
          id?: string
          is_active?: boolean | null
          n8n_workflow_id?: string | null
          name?: string
          organization_id?: string | null
          triggers?: Json | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "n8n_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "n8n_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "n8n_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "n8n_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "n8n_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          lida: boolean | null
          link: string | null
          mensagem: string
          metadata: Json | null
          organization_id: string | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem: string
          metadata?: Json | null
          organization_id?: string | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lida?: boolean | null
          link?: string | null
          mensagem?: string
          metadata?: Json | null
          organization_id?: string | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          assigned_to: string | null
          created_at: string
          id: string
          lead_id: string
          notes: string | null
          organization_id: string
          pipeline_id: string
          priority: number
          source: string | null
          source_detail: string | null
          stage_id: string | null
          status: string
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          lead_id: string
          notes?: string | null
          organization_id: string
          pipeline_id: string
          priority?: number
          source?: string | null
          source_detail?: string | null
          stage_id?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          id?: string
          lead_id?: string
          notes?: string | null
          organization_id?: string
          pipeline_id?: string
          priority?: number
          source?: string | null
          source_detail?: string | null
          stage_id?: string | null
          status?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          clerk_org_id: string
          clerk_user_id: string
          created_at: string
          id: string
          organization_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          clerk_org_id: string
          clerk_user_id: string
          created_at?: string
          id?: string
          organization_id: string
          role: string
          status?: string
          updated_at?: string
        }
        Update: {
          clerk_org_id?: string
          clerk_user_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "clerk_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_automation_settings: {
        Row: {
          created_at: string
          id: string
          meta_ads_keyword_enabled: boolean
          meta_ads_pipeline_id: string | null
          meta_ads_stage_id: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_ads_keyword_enabled?: boolean
          meta_ads_pipeline_id?: string | null
          meta_ads_stage_id?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_ads_keyword_enabled?: boolean
          meta_ads_pipeline_id?: string | null
          meta_ads_stage_id?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_automation_settings_meta_ads_pipeline_id_fkey"
            columns: ["meta_ads_pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_automation_settings_meta_ads_stage_id_fkey"
            columns: ["meta_ads_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_automation_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_automation_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_automation_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_automation_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_automation_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_webhooks: {
        Row: {
          created_at: string
          default_seller_id: string | null
          default_stage_id: string | null
          id: string
          is_active: boolean | null
          last_lead_at: string | null
          leads_received: number | null
          organization_id: string
          updated_at: string
          webhook_name: string | null
          webhook_token: string
        }
        Insert: {
          created_at?: string
          default_seller_id?: string | null
          default_stage_id?: string | null
          id?: string
          is_active?: boolean | null
          last_lead_at?: string | null
          leads_received?: number | null
          organization_id: string
          updated_at?: string
          webhook_name?: string | null
          webhook_token?: string
        }
        Update: {
          created_at?: string
          default_seller_id?: string | null
          default_stage_id?: string | null
          id?: string
          is_active?: boolean | null
          last_lead_at?: string | null
          leads_received?: number | null
          organization_id?: string
          updated_at?: string
          webhook_name?: string | null
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          ai_auto_debounce_seconds: number
          ai_auto_max_without_reply: number
          ai_auto_reply_throttle_seconds: number
          ai_system_prompt: string | null
          city: string | null
          cnpj: string | null
          created_at: string | null
          email: string | null
          id: string
          inbox_enabled: boolean
          is_active: boolean | null
          logo_url: string | null
          name: string
          owner_profile_id: string | null
          phone: string | null
          state: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          ai_auto_debounce_seconds?: number
          ai_auto_max_without_reply?: number
          ai_auto_reply_throttle_seconds?: number
          ai_system_prompt?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          inbox_enabled?: boolean
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          owner_profile_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          ai_auto_debounce_seconds?: number
          ai_auto_max_without_reply?: number
          ai_auto_reply_throttle_seconds?: number
          ai_system_prompt?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          inbox_enabled?: boolean
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          owner_profile_id?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organizations_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organizations_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          agendamento_id: string | null
          client_id: string | null
          created_at: string | null
          data_pagamento: string | null
          id: string
          metodo: string | null
          observacoes: string | null
          organization_id: string | null
          paciente_id: string | null
          servico_id: string | null
          status: string | null
          valor: number
        }
        Insert: {
          agendamento_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          id?: string
          metodo?: string | null
          observacoes?: string | null
          organization_id?: string | null
          paciente_id?: string | null
          servico_id?: string | null
          status?: string | null
          valor: number
        }
        Update: {
          agendamento_id?: string | null
          client_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          id?: string
          metodo?: string | null
          observacoes?: string | null
          organization_id?: string | null
          paciente_id?: string | null
          servico_id?: string | null
          status?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pagamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pagamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pagamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pagamentos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          documentos: string | null
          email: string | null
          endereco: string | null
          id: string
          nascimento: string
          nome: string
          observacoes: string | null
          organization_id: string | null
          telefone: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          documentos?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nascimento: string
          nome: string
          observacoes?: string | null
          organization_id?: string | null
          telefone: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          documentos?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nascimento?: string
          nome?: string
          observacoes?: string | null
          organization_id?: string | null
          telefone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "patients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          pipeline_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          pipeline_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          pipeline_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_permissions_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          pipeline_id: string | null
          position: number
          sensitive: boolean
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          name: string
          pipeline_id?: string | null
          position: number
          sensitive?: boolean
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          name?: string
          pipeline_id?: string | null
          position?: number
          sensitive?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      pipelines: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pipelines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos_servicos: {
        Row: {
          ativo: boolean | null
          categoria: string
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          organization_id: string
          preco_base: number
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          organization_id: string
          preco_base?: number
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          organization_id?: string
          preco_base?: number
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      professionals: {
        Row: {
          active: boolean | null
          average_rating: number | null
          consultations_this_month: number | null
          created_at: string | null
          crm: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          specialty: string
          total_consultations: number | null
          upcoming_appointments: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          average_rating?: number | null
          consultations_this_month?: number | null
          created_at?: string | null
          crm?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          specialty: string
          total_consultations?: number | null
          upcoming_appointments?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          average_rating?: number | null
          consultations_this_month?: number | null
          created_at?: string | null
          crm?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          specialty?: string
          total_consultations?: number | null
          upcoming_appointments?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "professionals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "professionals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "professionals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "professionals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          clerk_user_id: string
          created_at: string | null
          email: string
          id: string
          name: string
          onboarding_completed: boolean
          organization_id: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp_e164: string | null
        }
        Insert: {
          avatar_url?: string | null
          clerk_user_id: string
          created_at?: string | null
          email: string
          id?: string
          name: string
          onboarding_completed?: boolean
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_e164?: string | null
        }
        Update: {
          avatar_url?: string | null
          clerk_user_id?: string
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          onboarding_completed?: boolean
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_e164?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          address: string | null
          city: string | null
          cnpj: string
          company_name: string | null
          created_at: string | null
          created_by: string | null
          id: string
          main_activity: string | null
          organization_id: string
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          raw_data: Json | null
          state: string | null
          status: string | null
          trade_name: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          cnpj: string
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          main_activity?: string | null
          organization_id: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          raw_data?: Json | null
          state?: string | null
          status?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          cnpj?: string
          company_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          main_activity?: string | null
          organization_id?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          raw_data?: Json | null
          state?: string | null
          status?: string | null
          trade_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "prospects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "prospects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "prospects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "prospects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saidas: {
        Row: {
          categoria: string
          created_at: string | null
          data_saida: string
          descricao: string
          fornecedor: string | null
          id: string
          metodo_pagamento: string
          observacoes: string | null
          organization_id: string
          recorrente: boolean | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          data_saida?: string
          descricao: string
          fornecedor?: string | null
          id?: string
          metodo_pagamento?: string
          observacoes?: string | null
          organization_id: string
          recorrente?: boolean | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          data_saida?: string
          descricao?: string
          fornecedor?: string | null
          id?: string
          metodo_pagamento?: string
          observacoes?: string | null
          organization_id?: string
          recorrente?: boolean | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: []
      }
      servicos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          organization_id: string | null
          preco_padrao: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          organization_id?: string | null
          preco_padrao?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          organization_id?: string | null
          preco_padrao?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servicos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "servicos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "servicos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "servicos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "servicos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_integrations: {
        Row: {
          connected_at: string | null
          connected_by: string | null
          id: string
          ig_business_account_id: string
          ig_profile_picture_url: string | null
          ig_username: string | null
          organization_id: string
          page_access_token: string
          page_id: string
          page_name: string | null
          platform: string
          status: string
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          connected_at?: string | null
          connected_by?: string | null
          id?: string
          ig_business_account_id: string
          ig_profile_picture_url?: string | null
          ig_username?: string | null
          organization_id: string
          page_access_token: string
          page_id: string
          page_name?: string | null
          platform?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          connected_at?: string | null
          connected_by?: string | null
          id?: string
          ig_business_account_id?: string
          ig_profile_picture_url?: string | null
          ig_username?: string | null
          organization_id?: string
          page_access_token?: string
          page_id?: string
          page_name?: string | null
          platform?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "social_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "social_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "social_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "social_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_webhook_logs: {
        Row: {
          auth_status: string | null
          created_at: string | null
          event_type: string | null
          id: string
          organization_id: string | null
          page_id: string | null
          payload: Json | null
          platform: string | null
        }
        Insert: {
          auth_status?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string
          organization_id?: string | null
          page_id?: string | null
          payload?: Json | null
          platform?: string | null
        }
        Update: {
          auth_status?: string | null
          created_at?: string | null
          event_type?: string | null
          id?: string
          organization_id?: string | null
          page_id?: string | null
          payload?: Json | null
          platform?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean | null
          clerk_organization_id: string
          clerk_user_id: string
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle: string
          cancel_at_period_end?: boolean | null
          clerk_organization_id: string
          clerk_user_id: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean | null
          clerk_organization_id?: string
          clerk_user_id?: string
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          data_hora: string
          descricao: string | null
          id: string
          lead_id: string | null
          notificado: boolean | null
          organization_id: string
          prioridade: Database["public"]["Enums"]["task_priority"] | null
          responsavel_id: string
          status: Database["public"]["Enums"]["task_status"] | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          data_hora: string
          descricao?: string | null
          id?: string
          lead_id?: string | null
          notificado?: boolean | null
          organization_id: string
          prioridade?: Database["public"]["Enums"]["task_priority"] | null
          responsavel_id: string
          status?: Database["public"]["Enums"]["task_status"] | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          data_hora?: string
          descricao?: string | null
          id?: string
          lead_id?: string | null
          notificado?: boolean | null
          organization_id?: string
          prioridade?: Database["public"]["Enums"]["task_priority"] | null
          responsavel_id?: string
          status?: Database["public"]["Enums"]["task_status"] | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          name: string | null
          organization_id: string | null
          role: string
          status: string | null
          token: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          name?: string | null
          organization_id?: string | null
          role: string
          status?: string | null
          token?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          name?: string | null
          organization_id?: string | null
          role?: string
          status?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "clerk_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          clerk_user_id: string
          created_at: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          clerk_user_id: string
          created_at?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          clerk_user_id?: string
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      users_profile: {
        Row: {
          avatar_url: string | null
          clerk_user_id: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string | null
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          clerk_user_id: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string | null
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          clerk_user_id?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string | null
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          brand: string
          color: string | null
          created_at: string | null
          created_by: string
          description: string | null
          fuel_type: string | null
          id: string
          images: string[] | null
          mileage: number | null
          model: string
          organization_id: string
          plate: string | null
          price: number | null
          status: string | null
          transmission: string | null
          updated_at: string | null
          year: number
        }
        Insert: {
          brand: string
          color?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          fuel_type?: string | null
          id?: string
          images?: string[] | null
          mileage?: number | null
          model: string
          organization_id: string
          plate?: string | null
          price?: number | null
          status?: string | null
          transmission?: string | null
          updated_at?: string | null
          year: number
        }
        Update: {
          brand?: string
          color?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          fuel_type?: string | null
          id?: string
          images?: string[] | null
          mileage?: number | null
          model?: string
          organization_id?: string
          plate?: string | null
          price?: number | null
          status?: string | null
          transmission?: string | null
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "vehicles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configurations: {
        Row: {
          authentication_config: Json | null
          authentication_type: string | null
          created_at: string | null
          event_types: string[]
          failed_triggers: number | null
          headers: Json | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          name: string
          organization_id: string | null
          rate_limit_per_minute: number | null
          retry_attempts: number | null
          successful_triggers: number | null
          timeout_seconds: number | null
          total_triggers: number | null
          updated_at: string | null
          webhook_url: string
        }
        Insert: {
          authentication_config?: Json | null
          authentication_type?: string | null
          created_at?: string | null
          event_types: string[]
          failed_triggers?: number | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name: string
          organization_id?: string | null
          rate_limit_per_minute?: number | null
          retry_attempts?: number | null
          successful_triggers?: number | null
          timeout_seconds?: number | null
          total_triggers?: number | null
          updated_at?: string | null
          webhook_url: string
        }
        Update: {
          authentication_config?: Json | null
          authentication_type?: string | null
          created_at?: string | null
          event_types?: string[]
          failed_triggers?: number | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string
          organization_id?: string | null
          rate_limit_per_minute?: number | null
          retry_attempts?: number | null
          successful_triggers?: number | null
          timeout_seconds?: number | null
          total_triggers?: number | null
          updated_at?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_event_types: {
        Row: {
          category: string
          created_at: string | null
          description: string
          display_name: string
          event_type: string
          example_payload: Json
          id: string
          is_active: boolean | null
        }
        Insert: {
          category: string
          created_at?: string | null
          description: string
          display_name: string
          event_type: string
          example_payload: Json
          id?: string
          is_active?: boolean | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string
          display_name?: string
          event_type?: string
          example_payload?: Json
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_data: Json
          event_type: string
          execution_time_ms: number | null
          id: string
          organization_id: string | null
          request_payload: Json
          response_data: Json | null
          response_headers: Json | null
          response_status: number | null
          retry_count: number | null
          status: string | null
          webhook_config_id: string | null
          webhook_url: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_data: Json
          event_type: string
          execution_time_ms?: number | null
          id?: string
          organization_id?: string | null
          request_payload: Json
          response_data?: Json | null
          response_headers?: Json | null
          response_status?: number | null
          retry_count?: number | null
          status?: string | null
          webhook_config_id?: string | null
          webhook_url: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_data?: Json
          event_type?: string
          execution_time_ms?: number | null
          id?: string
          organization_id?: string | null
          request_payload?: Json
          response_data?: Json | null
          response_headers?: Json | null
          response_status?: number | null
          retry_count?: number | null
          status?: string | null
          webhook_config_id?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_webhook_config_id_fkey"
            columns: ["webhook_config_id"]
            isOneToOne: false
            referencedRelation: "webhook_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          endpoint: string
          headers: Json | null
          id: string
          ip_address: unknown
          method: string
          organization_id: string | null
          payload: Json | null
          processing_time_ms: number | null
          response_data: Json | null
          response_status: number | null
          user_agent: string | null
          webhook_type: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          headers?: Json | null
          id?: string
          ip_address?: unknown
          method: string
          organization_id?: string | null
          payload?: Json | null
          processing_time_ms?: number | null
          response_data?: Json | null
          response_status?: number | null
          user_agent?: string | null
          webhook_type: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          headers?: Json | null
          id?: string
          ip_address?: unknown
          method?: string
          organization_id?: string | null
          payload?: Json | null
          processing_time_ms?: number | null
          response_data?: Json | null
          response_status?: number | null
          user_agent?: string | null
          webhook_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          api_key: string
          api_url: string
          created_at: string | null
          created_by: string
          id: string
          instance_name: string
          is_active: boolean | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          api_key: string
          api_url: string
          created_at?: string | null
          created_by: string
          id?: string
          instance_name: string
          is_active?: boolean | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          api_url?: string
          created_at?: string | null
          created_by?: string
          id?: string
          instance_name?: string
          is_active?: boolean | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_connections: {
        Row: {
          connected_at: string | null
          created_at: string
          created_by_clerk_user_id: string
          evolution_api_key: string | null
          id: string
          instance_name: string
          last_connected_at: string | null
          last_disconnected_at: string | null
          mirror_enabled: boolean
          mirror_enabled_at: string | null
          organization_id: string
          phone_number: string | null
          qr_code: string | null
          status: string
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          created_at?: string
          created_by_clerk_user_id: string
          evolution_api_key?: string | null
          id?: string
          instance_name: string
          last_connected_at?: string | null
          last_disconnected_at?: string | null
          mirror_enabled?: boolean
          mirror_enabled_at?: string | null
          organization_id: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          created_at?: string
          created_by_clerk_user_id?: string
          evolution_api_key?: string | null
          id?: string
          instance_name?: string
          last_connected_at?: string | null
          last_disconnected_at?: string | null
          mirror_enabled?: boolean
          mirror_enabled_at?: string | null
          organization_id?: string
          phone_number?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_connections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_first_touch: {
        Row: {
          created_at: string
          first_message_at: string
          first_message_id: string | null
          id: string
          organization_id: string
          phone: string
        }
        Insert: {
          created_at?: string
          first_message_at?: string
          first_message_id?: string | null
          id?: string
          organization_id: string
          phone: string
        }
        Update: {
          created_at?: string
          first_message_at?: string
          first_message_id?: string | null
          id?: string
          organization_id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_first_touch_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_first_touch_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_first_touch_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_first_touch_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_first_touch_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_integrations: {
        Row: {
          api_key: string | null
          connected_at: string | null
          created_at: string | null
          evolution_api_key: string | null
          evolution_instance_id: string | null
          id: string
          instance_name: string
          is_active: boolean | null
          last_disconnected_at: string | null
          last_webhook_error: string | null
          last_webhook_event_at: string | null
          n8n_webhook_evolution_notify: string | null
          organization_id: string
          phone_number: string | null
          provider: string
          qr_code_data: string | null
          status: string
          updated_at: string | null
          webhook_token: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          connected_at?: string | null
          created_at?: string | null
          evolution_api_key?: string | null
          evolution_instance_id?: string | null
          id?: string
          instance_name: string
          is_active?: boolean | null
          last_disconnected_at?: string | null
          last_webhook_error?: string | null
          last_webhook_event_at?: string | null
          n8n_webhook_evolution_notify?: string | null
          organization_id: string
          phone_number?: string | null
          provider?: string
          qr_code_data?: string | null
          status?: string
          updated_at?: string | null
          webhook_token?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          connected_at?: string | null
          created_at?: string | null
          evolution_api_key?: string | null
          evolution_instance_id?: string | null
          id?: string
          instance_name?: string
          is_active?: boolean | null
          last_disconnected_at?: string | null
          last_webhook_error?: string | null
          last_webhook_event_at?: string | null
          n8n_webhook_evolution_notify?: string | null
          organization_id?: string
          phone_number?: string | null
          provider?: string
          qr_code_data?: string | null
          status?: string
          updated_at?: string | null
          webhook_token?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          automation_run_id: string | null
          created_at: string
          direction: string
          external_message_id: string | null
          id: string
          instance_name: string | null
          lead_id: string | null
          message_text: string | null
          metadata: Json | null
          organization_id: string
          phone: string
          status: string
          thread_id: string | null
        }
        Insert: {
          automation_run_id?: string | null
          created_at?: string
          direction?: string
          external_message_id?: string | null
          id?: string
          instance_name?: string | null
          lead_id?: string | null
          message_text?: string | null
          metadata?: Json | null
          organization_id: string
          phone: string
          status?: string
          thread_id?: string | null
        }
        Update: {
          automation_run_id?: string | null
          created_at?: string
          direction?: string
          external_message_id?: string | null
          id?: string
          instance_name?: string | null
          lead_id?: string | null
          message_text?: string | null
          metadata?: Json | null
          organization_id?: string
          phone?: string
          status?: string
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_routing_bucket_settings: {
        Row: {
          auto_assign_user_ids: Json
          bucket: string
          enabled: boolean
          fixed_user_id: string | null
          id: string
          mode: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          auto_assign_user_ids?: Json
          bucket: string
          enabled?: boolean
          fixed_user_id?: string | null
          id?: string
          mode?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          auto_assign_user_ids?: Json
          bucket?: string
          enabled?: boolean
          fixed_user_id?: string | null
          id?: string
          mode?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_routing_settings: {
        Row: {
          assign_on: string
          business_hours: Json | null
          business_hours_enabled: boolean
          enabled: boolean
          id: string
          mode: string
          non_traffic_enabled: boolean
          non_traffic_roles: Json
          only_roles: Json
          organization_id: string
          traffic_enabled: boolean
          traffic_roles: Json
          updated_at: string
        }
        Insert: {
          assign_on?: string
          business_hours?: Json | null
          business_hours_enabled?: boolean
          enabled?: boolean
          id?: string
          mode?: string
          non_traffic_enabled?: boolean
          non_traffic_roles?: Json
          only_roles?: Json
          organization_id: string
          traffic_enabled?: boolean
          traffic_roles?: Json
          updated_at?: string
        }
        Update: {
          assign_on?: string
          business_hours?: Json | null
          business_hours_enabled?: boolean
          enabled?: boolean
          id?: string
          mode?: string
          non_traffic_enabled?: boolean
          non_traffic_roles?: Json
          only_roles?: Json
          organization_id?: string
          traffic_enabled?: boolean
          traffic_roles?: Json
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_routing_state: {
        Row: {
          bucket: string
          id: string
          last_assigned_user_id: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          bucket?: string
          id?: string
          last_assigned_user_id?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          bucket?: string
          id?: string
          last_assigned_user_id?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_threads: {
        Row: {
          assigned_at: string | null
          assigned_user_id: string | null
          contact_name: string | null
          contact_phone_e164: string
          created_at: string
          first_message_at: string | null
          first_message_text: string | null
          id: string
          instance_name: string
          last_message_at: string | null
          last_message_preview: string | null
          organization_id: string
          routing_bucket: string
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_user_id?: string | null
          contact_name?: string | null
          contact_phone_e164: string
          created_at?: string
          first_message_at?: string | null
          first_message_text?: string | null
          id?: string
          instance_name: string
          last_message_at?: string | null
          last_message_preview?: string | null
          organization_id: string
          routing_bucket?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_user_id?: string | null
          contact_name?: string | null
          contact_phone_e164?: string
          created_at?: string
          first_message_at?: string | null
          first_message_text?: string | null
          id?: string
          instance_name?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          organization_id?: string
          routing_bucket?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "whatsapp_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_heartbeats: {
        Row: {
          error_count: number
          last_run_at: string
          processed_count: number
          updated_at: string
          worker_name: string
        }
        Insert: {
          error_count?: number
          last_run_at?: string
          processed_count?: number
          updated_at?: string
          worker_name: string
        }
        Update: {
          error_count?: number
          last_run_at?: string
          processed_count?: number
          updated_at?: string
          worker_name?: string
        }
        Relationships: []
      }
    }
    Views: {
      crm_funnel: {
        Row: {
          conversion_rate: number | null
          leads_contato: number | null
          leads_fechados: number | null
          leads_negociacao: number | null
          leads_novos: number | null
          leads_perdidos: number | null
          leads_proposta: number | null
          organization_id: string | null
          organization_name: string | null
          total_leads: number | null
        }
        Relationships: []
      }
      dashboard_stats: {
        Row: {
          active_professionals: number | null
          appointments_this_month: number | null
          appointments_today: number | null
          converted_leads: number | null
          organization_id: string | null
          organization_name: string | null
          revenue_this_month: number | null
          total_leads: number | null
          total_patients: number | null
        }
        Insert: {
          active_professionals?: never
          appointments_this_month?: never
          appointments_today?: never
          converted_leads?: never
          organization_id?: string | null
          organization_name?: string | null
          revenue_this_month?: never
          total_leads?: never
          total_patients?: never
        }
        Update: {
          active_professionals?: never
          appointments_this_month?: never
          appointments_today?: never
          converted_leads?: never
          organization_id?: string | null
          organization_name?: string | null
          revenue_this_month?: never
          total_leads?: never
          total_patients?: never
        }
        Relationships: []
      }
      financial_dashboard: {
        Row: {
          lucro_liquido: number | null
          organization_id: string | null
          ticket_medio: number | null
          total_entradas: number | null
          total_saidas: number | null
          total_transacoes_entrada: number | null
          total_transacoes_saida: number | null
        }
        Relationships: []
      }
      financial_summary: {
        Row: {
          lucro: number | null
          organization_id: string | null
          organization_name: string | null
          ticket_medio: number | null
          total_despesas: number | null
          total_pagamentos: number | null
          total_receitas: number | null
        }
        Insert: {
          lucro?: never
          organization_id?: string | null
          organization_name?: string | null
          ticket_medio?: never
          total_despesas?: never
          total_pagamentos?: never
          total_receitas?: never
        }
        Update: {
          lucro?: never
          organization_id?: string | null
          organization_name?: string | null
          ticket_medio?: never
          total_despesas?: never
          total_pagamentos?: never
          total_receitas?: never
        }
        Relationships: []
      }
      profiles_with_roles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string | null
          name: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
          user_id: string | null
          whatsapp_e164: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_funnel"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_dashboard"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "financial_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_cadence_to_lead: {
        Args: {
          p_assigned_to: string
          p_cadence_id: string
          p_created_by: string
          p_lead_id: string
        }
        Returns: number
      }
      buscar_clientes: {
        Args: { query: string }
        Returns: {
          ativo: boolean
          created_at: string
          documentos: string
          email: string
          endereco: string
          id: string
          nascimento: string
          nome: string
          observacoes: string
          telefone: string
        }[]
      }
      buscar_pacientes: {
        Args: { query: string }
        Returns: {
          ativo: boolean | null
          created_at: string | null
          documentos: string | null
          email: string | null
          endereco: string | null
          id: string
          nascimento: string
          nome: string
          observacoes: string | null
          organization_id: string | null
          telefone: string
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "patients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_meta_capi_dedup: { Args: never; Returns: undefined }
      cleanup_old_automation_events: { Args: never; Returns: undefined }
      cleanup_old_notifications: { Args: never; Returns: number }
      cleanup_old_webhook_logs: { Args: never; Returns: undefined }
      create_appointment_reminders: { Args: never; Returns: number }
      create_crm_stage: {
        Args: {
          p_color: string
          p_name: string
          p_order_index: number
          p_organization_id: string
        }
        Returns: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          order_index: number | null
          organization_id: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "crm_stages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_lead_rpc:
        | {
            Args: {
              p_cidade?: string
              p_clerk_user_id: string
              p_email?: string
              p_estado?: string
              p_interest?: string
              p_name: string
              p_observations?: string
              p_phone: string
              p_price?: string
              p_seller_id?: string
              p_servico?: string
              p_source?: string
              p_stage_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_cidade?: string
              p_clerk_user_id: string
              p_email?: string
              p_estado?: string
              p_interest?: string
              p_name: string
              p_observations?: string
              p_org_id?: string
              p_phone: string
              p_price?: string
              p_seller_id?: string
              p_servico?: string
              p_source?: string
              p_stage_id?: string
            }
            Returns: Json
          }
      create_manual_notification: {
        Args: {
          p_link?: string
          p_mensagem: string
          p_metadata?: Json
          p_organization_id: string
          p_tipo: string
          p_user_ids: string[]
        }
        Returns: number
      }
      create_notification: {
        Args: {
          p_link?: string
          p_mensagem: string
          p_metadata?: Json
          p_organization_id: string
          p_tipo: string
          p_user_id: string
        }
        Returns: string
      }
      create_notification_safe: {
        Args: {
          p_mensagem: string
          p_metadata?: Json
          p_organization_id: string
          p_tipo: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_pipeline: {
        Args: {
          p_created_by?: string
          p_description?: string
          p_name: string
          p_org_id?: string
        }
        Returns: string
      }
      create_pipeline_stage: {
        Args: {
          p_color?: string
          p_created_by?: string
          p_name: string
          p_pipeline_id: string
        }
        Returns: string
      }
      create_secure_notification: {
        Args: {
          p_mensagem: string
          p_metadata?: Json
          p_organization_id: string
          p_tipo: string
          p_user_id: string
        }
        Returns: boolean
      }
      create_system_notification: {
        Args: {
          p_link?: string
          p_mensagem: string
          p_organization_id: string
          p_priority?: string
        }
        Returns: number
      }
      create_user_in_organization: {
        Args: { p_email: string; p_name: string; p_role: string }
        Returns: Json
      }
      decrypt_n8n_api_key: { Args: { encrypted_key: string }; Returns: string }
      delete_lead_rpc: {
        Args: { p_clerk_user_id: string; p_lead_id: string }
        Returns: boolean
      }
      delete_pipeline_rpc: {
        Args: { p_clerk_user_id: string; p_pipeline_id: string }
        Returns: Json
      }
      distribute_instagram_conversation: {
        Args: { p_conversation_id: string; p_organization_id: string }
        Returns: Json
      }
      encrypt_n8n_api_key: { Args: { api_key: string }; Returns: string }
      ensure_default_pipeline: {
        Args: { p_created_by: string; p_org_id: string }
        Returns: string
      }
      get_automation_stats: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      get_clerk_user_id: { Args: never; Returns: string }
      get_conversation_messages: {
        Args: {
          p_clerk_user_id: string
          p_conversation_id: string
          p_limit?: number
          p_org_id: string
        }
        Returns: Json
      }
      get_inbox_contacts_for_broadcast: {
        Args: { p_seller_id?: string; p_status?: string }
        Returns: {
          assigned_to: string
          contact_name: string
          contact_phone: string
          id: string
          last_message_at: string
          status: string
        }[]
      }
      get_my_org_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      get_org_conversations:
        | {
            Args: {
              p_clerk_user_id: string
              p_filter?: string
              p_is_admin?: boolean
              p_limit?: number
              p_org_id: string
              p_search?: string
              p_seller_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_assignment_filter?: string
              p_clerk_user_id: string
              p_filter?: string
              p_is_admin?: boolean
              p_limit?: number
              p_org_id: string
              p_search?: string
              p_seller_id?: string
              p_status_filter?: string
            }
            Returns: Json
          }
      get_org_lead_sources: {
        Args: { p_org_id: string }
        Returns: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }[]
      }
      get_org_leads: {
        Args: {
          p_clerk_user_id: string
          p_is_admin?: boolean
          p_org_id: string
          p_seller_id?: string
        }
        Returns: Json
      }
      get_org_members: {
        Args: { p_org_id: string }
        Returns: {
          clerk_user_id: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      get_org_pipelines: {
        Args: { p_org_id: string }
        Returns: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          organization_id: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "pipelines"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_org_profile_members: {
        Args: { p_org_id: string }
        Returns: {
          avatar_url: string
          clerk_user_id: string
          email: string
          is_owner: boolean
          name: string
          profile_id: string
          role: string
        }[]
      }
      get_org_profiles_with_roles: { Args: { p_org_id: string }; Returns: Json }
      get_org_sales_stage_ids: {
        Args: { p_org_id: string }
        Returns: {
          pipeline_id: string
          stage_id: string
          stage_name: string
        }[]
      }
      get_organization_details: {
        Args: { p_clerk_user_id: string; p_organization_id?: string }
        Returns: {
          out_cnpj: string
          out_id: string
          out_logo_url: string
          out_name: string
        }[]
      }
      get_pipeline_stages: {
        Args: { p_pipeline_id: string }
        Returns: {
          color: string | null
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          name: string
          pipeline_id: string | null
          position: number
          sensitive: boolean
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "pipeline_stages"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_active_org_ids: { Args: never; Returns: string[] }
      get_user_organization_id:
        | { Args: never; Returns: string }
        | { Args: { user_uuid: string }; Returns: string }
      get_user_organizations_with_logos: {
        Args: { p_clerk_user_id: string }
        Returns: {
          clerk_org_id: string
          logo_url: string
          org_name: string
          organization_id: string
          role: string
        }[]
      }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_conversation_event: {
        Args: {
          p_clerk_user_id: string
          p_conversation_id: string
          p_event_type: string
          p_metadata?: Json
          p_org_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: never; Returns: boolean }
      is_org_owner: { Args: { _org_id: string }; Returns: boolean }
      list_pipeline_permissions: {
        Args: { p_pipeline_id: string }
        Returns: {
          profile_id: string
        }[]
      }
      notify_automation_event: {
        Args: { event_data: Json; event_type: string; organization_id: string }
        Returns: undefined
      }
      notify_organization_users: {
        Args: {
          p_link?: string
          p_mensagem: string
          p_metadata?: Json
          p_organization_id: string
          p_tipo: string
        }
        Returns: number
      }
      notify_users_by_role: {
        Args: {
          p_link?: string
          p_mensagem: string
          p_metadata?: Json
          p_organization_id: string
          p_roles: string[]
          p_tipo: string
        }
        Returns: number
      }
      provision_profile_from_membership: {
        Args: {
          p_avatar_url?: string
          p_clerk_user_id: string
          p_email: string
          p_name: string
        }
        Returns: {
          avatar_url: string | null
          clerk_user_id: string
          created_at: string | null
          email: string
          id: string
          name: string
          onboarding_completed: boolean
          organization_id: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp_e164: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      purge_org_membership: {
        Args: { p_clerk_org_id: string; p_clerk_user_id: string }
        Returns: Json
      }
      purge_organization_by_clerk_id: {
        Args: { p_clerk_org_id: string }
        Returns: Json
      }
      purge_organization_cascade: { Args: { p_org_id: string }; Returns: Json }
      purge_user_cascade: { Args: { p_clerk_user_id: string }; Returns: Json }
      reprocess_failed_automation_events: {
        Args: { p_organization_id: string }
        Returns: Json
      }
      seed_default_pipeline:
        | { Args: { p_created_by: string; p_org_id: string }; Returns: string }
        | { Args: { p_organization_id: string }; Returns: string }
      set_organization_context: { Args: { org_id: string }; Returns: undefined }
      set_pipeline_permissions: {
        Args: { p_pipeline_id: string; p_profile_ids: string[] }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      switch_active_organization: {
        Args: { p_clerk_user_id: string; p_organization_id: string }
        Returns: {
          organization_id: string
          role: string
        }[]
      }
      test_automation_trigger: {
        Args: {
          p_event_type: string
          p_organization_id: string
          p_test_data?: Json
        }
        Returns: Json
      }
      test_n8n_connection: {
        Args: {
          p_api_key: string
          p_n8n_url: string
          p_organization_id: string
        }
        Returns: Json
      }
      test_webhook_configuration: {
        Args: { p_test_data?: Json; p_webhook_config_id: string }
        Returns: Json
      }
      trigger_webhook_event: {
        Args: {
          p_event_data: Json
          p_event_type: string
          p_organization_id: string
        }
        Returns: Json
      }
      update_conversation: {
        Args: {
          p_clerk_user_id: string
          p_conversation_id: string
          p_org_id: string
          p_updates: Json
        }
        Returns: boolean
      }
      update_lead_rpc: {
        Args: { p_clerk_user_id: string; p_data: Json; p_lead_id: string }
        Returns: Json
      }
      update_organization_details: {
        Args: {
          p_clerk_user_id: string
          p_cnpj: string
          p_logo_url: string
          p_name: string
          p_organization_id?: string
        }
        Returns: {
          out_cnpj: string
          out_id: string
          out_logo_url: string
          out_name: string
        }[]
      }
      update_user_role_rpc: {
        Args: {
          p_caller_clerk_user_id: string
          p_new_role: string
          p_organization_id: string
          p_target_clerk_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "seller"
      followup_sent_by: "AUTO" | "MANUAL"
      followup_status:
        | "PENDENTE"
        | "ENVIADO"
        | "PULADO"
        | "FALHOU"
        | "CANCELADO"
      message_channel: "whatsapp" | "email" | "sms"
      message_direction: "outbound" | "inbound"
      task_priority: "baixa" | "media" | "alta"
      task_status: "pendente" | "em_andamento" | "concluida" | "atrasada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "seller"],
      followup_sent_by: ["AUTO", "MANUAL"],
      followup_status: ["PENDENTE", "ENVIADO", "PULADO", "FALHOU", "CANCELADO"],
      message_channel: ["whatsapp", "email", "sms"],
      message_direction: ["outbound", "inbound"],
      task_priority: ["baixa", "media", "alta"],
      task_status: ["pendente", "em_andamento", "concluida", "atrasada"],
    },
  },
} as const
