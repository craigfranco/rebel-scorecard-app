import { useQuery } from '@tanstack/react-query';
import { appParams } from '@/lib/app-params';

const EXTERNAL_APP_ID = '69d57633cdc86dba45d18ca2';
const BASE_URL = `https://api.base44.com/v1/apps/${EXTERNAL_APP_ID}/entities`;

async function fetchExternalEntity(entityName) {
  const token = appParams.token;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/${entityName}?limit=200`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch ${entityName} from external app`);
  return res.json();
}

/**
 * Fetches the Property list from the external source app (69d57633cdc86dba45d18ca2).
 * Returns { data: Property[], isLoading, error }
 */
export function useExternalProperties() {
  return useQuery({
    queryKey: ['external-properties'],
    queryFn: () => fetchExternalEntity('Property'),
    staleTime: 60_000, // cache for 1 min
    select: (data) => Array.isArray(data) ? data : (data?.items ?? data?.data ?? []),
  });
}