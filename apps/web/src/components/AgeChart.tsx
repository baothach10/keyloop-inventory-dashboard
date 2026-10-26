import type { InventorySummary } from '@inventory/shared';

/** Plain CSS bars: no chart dependency for five buckets. Buckets past the threshold are red. */
export function AgeChart({ summary }: { summary: InventorySummary }) {
  const max = Math.max(1, ...summary.ageBuckets.map((b) => b.count));
  return (
    <section aria-label="Age distribution" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">Days in stock</h2>
      <ul className="space-y-2">
        {summary.ageBuckets.map((b) => {
          const aging = b.label.startsWith('91') || b.label.startsWith('180');
          return (
            <li key={b.label} className="flex items-center gap-3 text-sm">
              <span className="w-14 shrink-0 text-slate-500">{b.label}</span>
              <div className="h-4 flex-1 rounded bg-slate-100">
                <div
                  className={`h-4 rounded ${aging ? 'bg-red-500' : 'bg-sky-500'}`}
                  style={{ width: `${(b.count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right tabular-nums">{b.count}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
