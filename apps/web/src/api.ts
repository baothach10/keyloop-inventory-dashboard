import type {
  CreateActionInput,
  Dealership,
  InventorySummary,
  VehicleAction,
  VehicleDetail,
  VehicleList,
} from '@inventory/shared';

export interface Filters {
  make: string;
  model: string;
  q: string;
  minAge: string;
  maxAge: string;
  aging: boolean;
  sort: string;
  order: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export const DEFAULT_FILTERS: Filters = {
  make: '',
  model: '',
  q: '',
  minAge: '',
  maxAge: '',
  aging: false,
  sort: 'daysInStock',
  order: 'desc',
  page: 1,
  pageSize: 25,
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

/** Empty filter values are omitted so the URL (and the server-side query) stays minimal. */
export function toQueryString(f: Filters): string {
  const p = new URLSearchParams();
  (['make', 'model', 'q', 'minAge', 'maxAge'] as const).forEach((k) => f[k] && p.set(k, f[k]));
  if (f.aging) p.set('aging', 'true');
  p.set('sort', f.sort);
  p.set('order', f.order);
  p.set('page', String(f.page));
  p.set('pageSize', String(f.pageSize));
  return p.toString();
}

export const api = {
  dealerships: () => request<Dealership[]>('/api/dealerships'),
  summary: (id: string) => request<InventorySummary>(`/api/dealerships/${id}/inventory/summary`),
  vehicles: (id: string, f: Filters) =>
    request<VehicleList>(`/api/dealerships/${id}/vehicles?${toQueryString(f)}`),
  vehicle: (id: string) => request<VehicleDetail>(`/api/vehicles/${id}`),
  logAction: (vehicleId: string, body: Partial<CreateActionInput>) =>
    request<VehicleAction>(`/api/vehicles/${vehicleId}/actions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
