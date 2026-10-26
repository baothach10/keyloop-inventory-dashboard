import type { InventorySummary } from '@inventory/shared';
import { compactMoney, count } from '../format';

interface Props {
  summary: InventorySummary;
  agingOnly: boolean;
  onToggleAging: () => void;
}

function Card({ label, value, sub, tone = 'default', children }: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'danger' | 'warn';
  children?: React.ReactNode;
}) {
  const tones = {
    default: 'border-slate-200 bg-white',
    danger: 'border-red-300 bg-red-50',
    warn: 'border-amber-300 bg-amber-50',
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-3xl font-semibold ${tone === 'danger' ? 'text-red-700' : ''}`}>{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-600">{sub}</div>}
      {children}
    </div>
  );
}

export function SummaryCards({ summary: s, agingOnly, onToggleAging }: Props) {
  return (
    <section aria-label="Inventory summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card label="Total stock" value={count(s.totalVehicles)} sub={`${compactMoney(s.totalValue)} inventory value`} />
      <Card
        label={`Aging stock (>${s.thresholdDays} days)`}
        value={count(s.agingCount)}
        sub={`${s.agingPercent}% of stock · ${compactMoney(s.agingValue)} tied up`}
        tone="danger"
      >
        <button
          onClick={onToggleAging}
          className="mt-3 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
        >
          {agingOnly ? 'Show all stock' : 'Show aging only'}
        </button>
      </Card>
      <Card
        label="Aging, no action logged"
        value={count(s.agingWithoutAction)}
        sub="Needs a manager decision"
        tone={s.agingWithoutAction > 0 ? 'warn' : 'default'}
      />
      <Card label="Average age" value={`${s.averageDaysInStock} days`} sub="Across all stock" />
    </section>
  );
}
