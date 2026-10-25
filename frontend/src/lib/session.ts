import type { QueryClient } from '@tanstack/react-query';
import type { User } from '../types';

export function setSession(queryClient: QueryClient, user: User | null): void {
  void queryClient.cancelQueries({ queryKey: ['me'] });
  queryClient.setQueryData(['me'], user);
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
}
