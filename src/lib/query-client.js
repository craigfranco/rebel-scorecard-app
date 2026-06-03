import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,          // always treat data as stale — refetch on every mount/focus
      gcTime: 0,             // do not cache data in memory between unmounts
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      retry: 1,
    },
  },
});