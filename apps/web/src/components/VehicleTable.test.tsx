import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS } from '../api';
import { vehicle } from '../test/fixtures';
import { VehicleTable } from './VehicleTable';

const young = vehicle({ id: 'y', vin: 'YOUNG', daysInStock: 10, isAging: false });
const old = vehicle({ id: 'o', vin: 'OLD', daysInStock: 120, isAging: true });
const handled = vehicle({
  id: 'h',
  vin: 'HANDLED',
  daysInStock: 200,
  isAging: true,
  latestAction: {
    id: 'a', vehicleId: 'h', actionType: 'PRICE_REDUCTION_PLANNED', note: null, createdBy: 'x', createdAt: '2026-06-01T00:00:00Z',
  },
});

const setup = (items = [young, old, handled]) => {
  const onManage = vi.fn();
  const onSort = vi.fn();
  render(<VehicleTable items={items} filters={DEFAULT_FILTERS} onSort={onSort} onManage={onManage} />);
  return { onManage, onSort };
};

const row = (vin: string) => screen.getByText(vin).closest('tr')!;

describe('VehicleTable', () => {
  it('flags only aging rows', () => {
    setup();
    expect(row('YOUNG')).toHaveAttribute('data-aging', 'false');
    expect(row('OLD')).toHaveAttribute('data-aging', 'true');
    expect(within(row('OLD')).getByText(/aging stock/i)).toBeInTheDocument();
    expect(within(row('YOUNG')).queryByText(/aging stock/i)).not.toBeInTheDocument();
  });

  it('offers Manage only for aging vehicles', () => {
    setup();
    expect(within(row('YOUNG')).queryByRole('button', { name: /manage/i })).not.toBeInTheDocument();
    expect(within(row('OLD')).getByRole('button', { name: /manage/i })).toBeInTheDocument();
  });

  it('shows the latest action, or a prompt when none is logged', () => {
    setup();
    expect(within(row('HANDLED')).getByText('Price Reduction Planned')).toBeInTheDocument();
    expect(within(row('OLD')).getByText('No action yet')).toBeInTheDocument();
  });

  it('calls onManage with the vehicle', async () => {
    const { onManage } = setup();
    await userEvent.click(within(row('OLD')).getByRole('button', { name: /manage/i }));
    expect(onManage).toHaveBeenCalledWith(old);
  });

  it('marks the active sort column for assistive tech and sorts on click', async () => {
    const { onSort } = setup();
    expect(screen.getByRole('columnheader', { name: /days in stock/i })).toHaveAttribute('aria-sort', 'descending');
    await userEvent.click(screen.getByRole('button', { name: /price/i }));
    expect(onSort).toHaveBeenCalledWith('price');
  });

  it('renders an empty state', () => {
    setup([]);
    expect(screen.getByText(/no vehicles match/i)).toBeInTheDocument();
  });
});
