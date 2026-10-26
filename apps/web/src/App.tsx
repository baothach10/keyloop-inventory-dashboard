import type { Vehicle } from '@inventory/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, DEFAULT_FILTERS, type Filters } from './api';
import { ActionPanel } from './components/ActionPanel';
import { AgeChart } from './components/AgeChart';
import { FiltersBar } from './components/FiltersBar';
import { Pagination } from './components/Pagination';
import { SummaryCards } from './components/SummaryCards';
import { VehicleTable } from './components/VehicleTable';

/** "Real-time" = refetch on window focus (default) plus this poll. */
const REFRESH_MS = 30_000;

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function App() {
  const [dealershipId, setDealershipId] = useState<string>('');
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Vehicle | null>(null);

  const debouncedSearch = useDebounced(search);
  useEffect(() => {
    setFilters((f) => (f.q === debouncedSearch ? f : { ...f, q: debouncedSearch, page: 1 }));
  }, [debouncedSearch]);

  const dealerships = useQuery({ queryKey: ['dealerships'], queryFn: api.dealerships });
  useEffect(() => {
    if (!dealershipId && dealerships.data?.[0]) setDealershipId(dealerships.data[0].id);
  }, [dealerships.data, dealershipId]);

  const summary = useQuery({
    queryKey: ['summary', dealershipId],
    queryFn: () => api.summary(dealershipId),
    enabled: !!dealershipId,
    refetchInterval: REFRESH_MS,
  });
  const vehicles = useQuery({
    queryKey: ['vehicles', dealershipId, filters],
    queryFn: () => api.vehicles(dealershipId, filters),
    enabled: !!dealershipId,
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });

  const patch = (p: Partial<Filters>) => setFilters((f) => ({ ...f, ...p, page: 'page' in p ? p.page! : 1 }));
  const toggleSort = (field: string) =>
    setFilters((f) => ({
      ...f,
      sort: field,
      order: f.sort === field && f.order === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));

  const error = (dealerships.error ?? summary.error ?? vehicles.error) as Error | null;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventory Dashboard</h1>
          <p className="text-sm text-slate-500">Live stock overview · aging stock is older than {summary.data?.thresholdDays ?? 90} days</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          Dealership
          <select
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm"
            value={dealershipId}
            onChange={(e) => {
              setDealershipId(e.target.value);
              setSearch('');
              setFilters(DEFAULT_FILTERS);
            }}
          >
            {dealerships.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          Could not load data: {error.message}. Is the API running on port 3001?
        </div>
      )}

      {summary.data && (
        <>
          <SummaryCards
            summary={summary.data}
            agingOnly={filters.aging}
            onToggleAging={() => patch({ aging: !filters.aging })}
          />
          <AgeChart summary={summary.data} />
        </>
      )}

      <FiltersBar filters={filters} search={search} onSearch={setSearch} onChange={patch} summary={summary.data} />

      {vehicles.data ? (
        <div className={vehicles.isPlaceholderData ? 'opacity-60 transition-opacity' : ''}>
          <VehicleTable items={vehicles.data.items} filters={filters} onSort={toggleSort} onManage={setSelected} />
          <div className="mt-3">
            <Pagination
              page={vehicles.data.page}
              totalPages={vehicles.data.totalPages}
              total={vehicles.data.total}
              pageSize={vehicles.data.pageSize}
              onPage={(page) => patch({ page })}
            />
          </div>
        </div>
      ) : (
        !error && <p className="text-slate-500">Loading inventory…</p>
      )}

      {selected && <ActionPanel vehicle={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
