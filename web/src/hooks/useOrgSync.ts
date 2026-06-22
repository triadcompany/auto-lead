import { useEffect, useRef } from 'react';
import { useOrganization as useClerkOrganization, useUser } from '@clerk/clerk-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * useOrgSync — keeps Supabase `organizations` and `profiles` tables
 * in sync whenever the Clerk active organization or user changes.
 *
 * Runs on:
 *  a) First login (profile may not exist yet)
 *  b) Active org change in Clerk (updates organization_id on profile)
 */
export function useOrgSync() {
  const { user, isLoaded: userLoaded } = useUser();
  const { organization: clerkOrg } = useClerkOrganization();
  const { orgId, refreshProfile } = useAuth();
  const lastSyncRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userLoaded || !user || !clerkOrg) return;

    const clerkOrgId = clerkOrg.id;
    const orgName = clerkOrg.name;
    const clerkUserId = user.id;

    // Avoid duplicate syncs for the same org
    const syncKey = `${clerkUserId}:${clerkOrgId}`;
    if (lastSyncRef.current === syncKey) return;
    lastSyncRef.current = syncKey;

    const sync = async () => {
      try {
        console.log('🔄 useOrgSync: syncing org', clerkOrgId, orgName);

        // 1. Upsert clerk_organizations → get the UUID
        const { data: orgData, error: orgErr } = await supabase
          .from('clerk_organizations')
          .upsert(
            {
              clerk_org_id: clerkOrgId,
              name: orgName,
            },
            { onConflict: 'clerk_org_id' }
          )
          .select('id')
          .single();

        if (orgErr) {
          console.error('❌ useOrgSync: clerk_organizations upsert failed:', orgErr.message);
          return;
        }

        const supabaseOrgId = orgData.id;

        // 2. Upsert legacy organizations table
        const { error: legacyErr } = await supabase
          .from('organizations')
          .upsert(
            {
              id: supabaseOrgId,
              name: orgName,
              is_active: true,
            },
            { onConflict: 'id' }
          );

        if (legacyErr) {
          console.warn('⚠️ useOrgSync: legacy organizations upsert warning:', legacyErr.message);
        }

        // 2b. Seed default pipeline if none exists
        const { data: existingPipelines } = await supabase
          .from('pipelines')
          .select('id')
          .eq('organization_id', supabaseOrgId)
          .limit(1);

        if (!existingPipelines || existingPipelines.length === 0) {
          console.log('🌱 useOrgSync: seeding default pipeline and lead sources');

          // We need a profile ID for created_by — will be set after profile upsert below
          // For now, seed pipeline after profile is ensured
        }

        // 2c. Seed default lead sources if none exist
        const { data: existingSources } = await supabase
          .from('lead_sources')
          .select('id')
          .eq('organization_id', supabaseOrgId)
          .limit(1);

        const needsSeedSources = !existingSources || existingSources.length === 0;
        const needsSeedPipeline = !existingPipelines || existingPipelines.length === 0;

        // 3. Ensure org_members entry exists (preserve existing role for invited users)
        const { data: existingMember } = await supabase
          .from('org_members')
          .select('role')
          .eq('clerk_org_id', clerkOrgId)
          .eq('clerk_user_id', clerkUserId)
          .maybeSingle();

        // Determine if this user is the org creator (admin) or a joiner (default seller).
        // - If they already have a row → preserve role.
        // - Else if the org has zero members yet → they're the creator → admin.
        // - Else → they're joining an existing org without a prior row → default to seller
        //   (prevents privilege escalation when sync-login race hasn't created the row yet).
        let memberRole = existingMember?.role;
        if (!memberRole) {
          const { count: memberCount } = await supabase
            .from('org_members')
            .select('clerk_user_id', { count: 'exact', head: true })
            .eq('clerk_org_id', clerkOrgId);

          memberRole = (memberCount ?? 0) === 0 ? 'admin' : 'seller';
        }

        const { error: memberErr } = await supabase
          .from('org_members')
          .upsert(
            {
              organization_id: supabaseOrgId,
              clerk_org_id: clerkOrgId,
              clerk_user_id: clerkUserId,
              role: memberRole,
              status: 'active',
            },
            { onConflict: 'clerk_org_id,clerk_user_id' }
          );

        if (memberErr) {
          console.warn('⚠️ useOrgSync: org_members upsert warning:', memberErr.message);
        }

        // 4. Upsert profile
        const email = user.primaryEmailAddress?.emailAddress || '';
        const userName = user.fullName || user.firstName || email.split('@')[0] || 'User';

        const { error: profileErr } = await supabase
          .from('profiles')
          .upsert(
            {
              clerk_user_id: clerkUserId,
              email,
              name: userName,
              avatar_url: user.imageUrl || null,
              organization_id: supabaseOrgId,
              onboarding_completed: true,
            },
            { onConflict: 'clerk_user_id' }
          );

        if (profileErr) {
          console.warn('⚠️ useOrgSync: profiles upsert warning:', profileErr.message);
        }

        // 4b. Ensure user_roles entry exists (preserve existing role)
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('clerk_user_id', clerkUserId)
          .eq('organization_id', supabaseOrgId)
          .maybeSingle();

        if (!existingRole) {
          const { error: roleErr } = await supabase
            .from('user_roles')
            .insert({
              clerk_user_id: clerkUserId,
              organization_id: supabaseOrgId,
              role: (memberRole === 'admin' ? 'admin' : 'seller') as 'admin' | 'seller',
            });

          if (roleErr) {
            console.warn('⚠️ useOrgSync: user_roles insert warning:', roleErr.message);
          }
        }

        // 5. Seed default pipeline & stages for new orgs
        if (needsSeedPipeline) {
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('id')
            .eq('clerk_user_id', clerkUserId)
            .single();

          if (profileRow) {
            const { data: newPipeline } = await supabase
              .from('pipelines')
              .insert({ organization_id: supabaseOrgId, name: 'Pipeline Principal', is_default: true, created_by: profileRow.id })
              .select('id')
              .single();

            if (newPipeline) {
              const stages = [
                { name: 'Novo Lead', position: 1, color: '#3B82F6' },
                { name: 'Andamento', position: 2, color: '#F59E0B' },
                { name: 'Qualificado', position: 3, color: '#10B981' },
                { name: 'Agendado', position: 4, color: '#8B5CF6' },
                { name: 'Visita Realizada', position: 5, color: '#6366F1' },
                { name: 'Negociando Proposta', position: 6, color: '#EC4899' },
                { name: 'Venda', position: 7, color: '#22C55E' },
                { name: 'Follow Up', position: 8, color: '#F97316' },
                { name: 'Perdido', position: 9, color: '#EF4444' },
              ];
              await supabase.from('pipeline_stages').insert(
                stages.map(s => ({ ...s, pipeline_id: newPipeline.id, created_by: profileRow.id }))
              );
              console.log('✅ useOrgSync: seeded default pipeline with 9 stages');
            }
          }
        }

        // 6. Seed default lead sources for new orgs
        if (needsSeedSources) {
          const defaultSources = [
            { name: 'Meta Ads', sort_order: 0 },
            { name: 'Indicação', sort_order: 1 },
            { name: 'Instagram Orgânico', sort_order: 2 },
            { name: 'WhatsApp', sort_order: 3 },
            { name: 'Marketplace', sort_order: 4 },
          ];
          await supabase.from('lead_sources').insert(
            defaultSources.map(s => ({ ...s, organization_id: supabaseOrgId, is_active: true }))
          );
          console.log('✅ useOrgSync: seeded default lead sources');
        }

        // Refresh auth context to pick up new orgId
        if (orgId !== supabaseOrgId) {
          await refreshProfile();
        }

        console.log('✅ useOrgSync: sync complete, orgId:', supabaseOrgId);
      } catch (err) {
        console.error('❌ useOrgSync error:', err);
        // Reset sync key so it retries on next render
        lastSyncRef.current = null;
      }
    };

    sync();
  }, [userLoaded, user, clerkOrg, orgId, refreshProfile]);
}
