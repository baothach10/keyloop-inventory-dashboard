const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const num = new Intl.NumberFormat('en-GB');

export const money = (n: number) => gbp.format(n);
export const compactMoney = (n: number) =>
  n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}m` : n >= 10_000 ? `£${Math.round(n / 1000)}k` : money(n);
export const count = (n: number) => num.format(n);
export const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
