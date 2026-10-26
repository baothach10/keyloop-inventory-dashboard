import { ACTION_LABELS, type Vehicle } from '@inventory/shared';
import type { Filters } from '../api';
import { dateShort, money } from '../format';

interface Props {
  items: Vehicle[];
  filters: Filters;
  onSort: (field: string) => void;
  onManage: (v: Vehicle) => void;
}

const COLUMNS: { key: string; label: string; sortable?: boolean; align?: 'right' }[] = [
  { key: 'make', label: 'Vehicle', sortable: true },
  { key: 'vin', label: 'VIN' },
  { key: 'year', label: 'Year', sortable: true },
  { key: 'mileage', label: 'Mileage', sortable: true, align: 'right' },
  { key: 'price', label: 'Price', sortable: true, align: 'right' },
  { key: 'daysInStock', label: 'Days in stock', sortable: true, align: 'right' },
  { key: 'status', label: 'Status / action' },
];

export function VehicleTable({ items, filters, onSort, onManage }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        No vehicles match these filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
          <tr>
            {COLUMNS.map((c) => {
              const active = filters.sort === c.key;
              return (
                <th
                  key={c.key}
                  scope="col"
                  className={`px-3 py-2 ${c.align === 'right' ? 'text-right' : ''}`}
                  aria-sort={active ? (filters.order === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sortable ? (
                    <button className="font-semibold uppercase hover:text-sky-700" onClick={() => onSort(c.key)}>
                      {c.label} {active ? (filters.order === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
            <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((v) => (
            <tr
              key={v.id}
              data-aging={v.isAging}
              className={v.isAging ? 'bg-red-50/60 hover:bg-red-50' : 'hover:bg-slate-50'}
            >
              <td className="px-3 py-2">
                <div className="font-medium">{v.make} {v.model}</div>
                <div className="text-xs text-slate-500">{v.trim} · stocked {dateShort(v.stockedAt)}</div>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{v.vin}</td>
              <td className="px-3 py-2">{v.year}</td>
              <td className="px-3 py-2 text-right tabular-nums">{v.mileage.toLocaleString('en-GB')}</td>
              <td className="px-3 py-2 text-right tabular-nums">{money(v.price)}</td>
              <td className="px-3 py-2 text-right">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                    v.isAging ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {v.isAging && <span aria-hidden>⚠</span>}
                  {v.daysInStock}
                  {v.isAging && <span className="sr-only"> days, aging stock</span>}
                </span>
              </td>
              <td className="px-3 py-2">
                {v.latestAction ? (
                  <span className="rounded-md bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800">
                    {ACTION_LABELS[v.latestAction.actionType]}
                  </span>
                ) : v.isAging ? (
                  <span className="text-xs font-medium text-amber-700">No action yet</span>
                ) : (
                  <span className="text-xs text-slate-400">–</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                {v.isAging && (
                  <button
                    onClick={() => onManage(v)}
                    className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-700"
                    aria-label={`Manage ${v.make} ${v.model} ${v.vin}`}
                  >
                    Manage
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
