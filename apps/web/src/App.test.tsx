import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { list, summary, vehicle } from './test/fixtures';

const aging = vehicle({ id: 'v-old', vin: 'OLDVIN', daysInStock: 150, isAging: true });
const fresh = vehicle({ id: 'v-new', vin: 'NEWVIN', daysInStock: 5, isAging: false });

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

let calls: { url: string; method: string; body?: string }[];
let actionResponse: () => Promise<Response>;

beforeEach(() => {
  calls = [];
  actionResponse = () => json({ id: 'a1', vehicleId: 'v-old', actionType: 'HOLD', note: null, createdBy: 'Manager', createdAt: '2026-06-30T10:00:00Z' }, 201);
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
      if (url.endsWith('/api/dealerships')) return json([{ id: 'd1', name: 'Dealer One' }]);
      if (url.includes('/inventory/summary')) return json(summary);
      if (url.includes('/actions')) return actionResponse();
      if (url.match(/\/api\/vehicles\/[^/]+$/)) return json({ ...aging, actions: [] });
      if (url.includes('/vehicles?')) {
        return json(list(url.includes('aging=true') ? [aging] : [aging, fresh]));
      }
      return json({}, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const renderApp = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <App />
    </QueryClientProvider>,
  );

describe('App', () => {
  it('shows aging KPIs and the full list', async () => {
    renderApp();
    expect(await screen.findByText('NEWVIN')).toBeInTheDocument();
    const kpis = within(screen.getByRole('region', { name: /inventory summary/i }));
    expect(kpis.getByText(/aging stock \(>90 days\)/i)).toBeInTheDocument();
    expect(kpis.getByText('66.7% of stock · £30k tied up')).toBeInTheDocument();
    expect(kpis.getByText('Needs a manager decision')).toBeInTheDocument();
  });

  it('re-queries with aging=true when "aging only" is ticked', async () => {
    renderApp();
    await screen.findByText('NEWVIN');
    await userEvent.click(screen.getByLabelText(/aging stock only/i));
    await waitFor(() => expect(screen.queryByText('NEWVIN')).not.toBeInTheDocument());
    expect(calls.some((c) => c.url.includes('aging=true'))).toBe(true);
    expect(screen.getByText('OLDVIN')).toBeInTheDocument();
  });

  it('logs an action for an aging vehicle and POSTs it to the API', async () => {
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /manage .*OLDVIN/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Action'), 'HOLD');
    await userEvent.type(within(dialog).getByLabelText(/note/i), 'waiting for spring');
    await userEvent.click(within(dialog).getByRole('button', { name: /save action/i }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('/api/vehicles/v-old/actions');
    expect(JSON.parse(post.body!)).toMatchObject({ actionType: 'HOLD', note: 'waiting for spring' });
  });

  it('surfaces a server-side rule violation in the panel', async () => {
    actionResponse = () => json({ error: 'RULE_VIOLATION', message: 'Vehicle is not aging' }, 422);
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /manage .*OLDVIN/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /save action/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Vehicle is not aging');
  });

  it('closes the panel with Escape', async () => {
    renderApp();
    await userEvent.click(await screen.findByRole('button', { name: /manage .*OLDVIN/i }));
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows an actionable error when the API is down', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Failed to fetch'))));
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load data/i);
  });
});
