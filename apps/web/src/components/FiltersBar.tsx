import type { InventorySummary } from '@inventory/shared';
import { DEFAULT_FILTERS, type Filters } from '../api';

interface Props {
  filters: Filters;
  search: string;
  onSearch: (v: string) => void;
  onChange: (patch: Partial<Filters>) => void;
  summary?: InventorySummary;
}

const field = 'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none';

export function FiltersBar({ filters, search, onSearch, onChange, summary }: Props) {
  const models = filters.make ? (summary?.modelsByMake[filters.make] ?? []) : [];
  const dirty = JSON.stringify({ ...filters, page: 1 }) !== JSON.stringify(DEFAULT_FILTERS) || search !== '';

  return (
    <form
      role="search"
      aria-label="Inventory filters"
      className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Search
        <input
          className={`${field} w-48`}
          placeholder="VIN, make or model"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Make
        <select
          className={field}
          value={filters.make}
          onChange={(e) => onChange({ make: e.target.value, model: '' })}
        >
          <option value="">All makes</option>
          {summary?.makes.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Model
        <select
          className={field}
          value={filters.model}
          disabled={!filters.make}
          onChange={(e) => onChange({ model: e.target.value })}
        >
          <option value="">{filters.make ? 'All models' : 'Select a make'}</option>
          {models.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Min age (days)
        <input
          type="number"
          min={0}
          className={`${field} w-24`}
          value={filters.minAge}
          onChange={(e) => onChange({ minAge: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
        Max age (days)
        <input
          type="number"
          min={0}
          className={`${field} w-24`}
          value={filters.maxAge}
          onChange={(e) => onChange({ maxAge: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 pb-1.5 text-sm font-medium text-red-700">
        <input
          type="checkbox"
          checked={filters.aging}
          onChange={(e) => onChange({ aging: e.target.checked })}
        />
        Aging stock only
      </label>
      {dirty && (
        <button
          type="button"
          className="pb-1.5 text-sm text-sky-700 underline"
          onClick={() => {
            onSearch('');
            onChange({ ...DEFAULT_FILTERS });
          }}
        >
          Reset
        </button>
      )}
    </form>
  );
}
