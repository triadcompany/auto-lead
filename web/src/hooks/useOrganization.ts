import { useAuth } from '@/contexts/AuthContext';

interface Organization {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useOrganization() {
  const { orgId, orgName, loading } = useAuth();

  const organization: Organization | null = orgId
    ? {
        id: orgId,
        name: orgName,
        email: null,
        phone: null,
        cnpj: null,
        address: null,
        city: null,
        state: null,
        zip_code: null,
        is_active: true,
        created_at: '',
        updated_at: '',
      }
    : null;

  return { organization, loading };
}
