import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import { setSession } from './session';
import type { User } from '../types';

it('updates active session observers without retaining another account’s expense cache', () => {
  const client = new QueryClient();
  client.setQueryData(['me'], null);
  client.setQueryData(['expenses'], ['private expense']);
  const observer = new QueryObserver<User | null>(client, { queryKey: ['me'], enabled: false });
  const unsubscribe = observer.subscribe(() => undefined);
  const user: User = { id: 'user-1', name: 'Alex', email: 'alex@example.com', currency: 'USD' };
  setSession(client, user);
  expect(observer.getCurrentResult().data).toEqual(user);
  expect(client.getQueryData(['expenses'])).toBeUndefined();
  client.setQueryData(['dashboard'], { total: '4.50' });
  setSession(client, null);
  expect(observer.getCurrentResult().data).toBeNull();
  expect(client.getQueryData(['dashboard'])).toBeUndefined();
  unsubscribe();
  client.clear();
});
