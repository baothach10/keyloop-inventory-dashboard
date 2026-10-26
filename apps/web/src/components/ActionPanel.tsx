import { ACTION_LABELS, ACTION_TYPES, type ActionType, type Vehicle } from '@inventory/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { dateTime, money } from '../format';

const NAME_KEY = 'inventory.managerName';
const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? 'Manager';
  } catch {
    return 'Manager';
  }
};

export function ActionPanel({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const qc = useQueryClient();
  const [actionType, setActionType] = useState<ActionType>('PRICE_REDUCTION_PLANNED');
  const [note, setNote] = useState('');
  const [name, setName] = useState(readName);

  const detail = useQuery({ queryKey: ['vehicle', vehicle.id], queryFn: () => api.vehicle(vehicle.id) });

  const save = useMutation({
    mutationFn: () => api.logAction(vehicle.id, { actionType, note: note || undefined, createdBy: name || 'Manager' }),
    onSuccess: async () => {
      try {
        localStorage.setItem(NAME_KEY, name);
      } catch {
        /* storage unavailable: the name just won't be remembered */
      }
      setNote('');
      // Refresh the open panel, the list (status column) and the KPI cards.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['vehicle', vehicle.id] }),
        qc.invalidateQueries({ queryKey: ['vehicles'] }),
        qc.invalidateQueries({ queryKey: ['summary'] }),
      ]);
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const input = 'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none';

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-slate-900/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Manage ${vehicle.make} ${vehicle.model}`}
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{vehicle.make} {vehicle.model} ({vehicle.year})</h2>
            <p className="font-mono text-xs text-slate-500">{vehicle.vin}</p>
            <p className="mt-1 text-sm text-slate-600">
              {money(vehicle.price)} ·{' '}
              <span className="font-semibold text-red-700">{vehicle.daysInStock} days in stock</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>

        <form
          className="mt-5 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <h3 className="text-sm font-semibold">Log status / proposed action</h3>
          <label className="block text-xs font-medium text-slate-600">
            Action
            <select className={input} value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)}>
              {ACTION_TYPES.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Note (optional)
            <textarea className={input} rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Logged by
            <input className={input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          {save.isError && (
            <p role="alert" className="text-sm text-red-700">{(save.error as Error).message}</p>
          )}
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save action'}
          </button>
        </form>

        <h3 className="mt-6 text-sm font-semibold">History</h3>
        {detail.isLoading && <p className="mt-2 text-sm text-slate-500">Loading…</p>}
        {detail.data && detail.data.actions.length === 0 && (
          <p className="mt-2 text-sm text-slate-500">No actions logged yet.</p>
        )}
        <ol className="mt-2 space-y-3">
          {detail.data?.actions.map((a, i) => (
            <li key={a.id} className="border-l-2 border-sky-300 pl-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {ACTION_LABELS[a.actionType]}
                {i === 0 && <span className="rounded bg-sky-100 px-1.5 text-[10px] font-semibold uppercase text-sky-800">Current</span>}
              </div>
              {a.note && <p className="text-sm text-slate-600">{a.note}</p>}
              <p className="text-xs text-slate-400">{a.createdBy} · {dateTime(a.createdAt)}</p>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
