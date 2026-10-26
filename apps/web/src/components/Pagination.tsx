interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, onPage }: Props) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn = 'rounded-md border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-40';
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between text-sm text-slate-600">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </nav>
  );
}
