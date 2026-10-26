import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_FILTERS } from '../api';
import { summary } from '../test/fixtures';
import { FiltersBar } from './FiltersBar';

const setup = (filters = DEFAULT_FILTERS) => {
  const onChange = vi.fn();
  const onSearch = vi.fn();
  render(<FiltersBar filters={filters} search="" onSearch={onSearch} onChange={onChange} summary={summary} />);
  return { onChange, onSearch };
};

describe('FiltersBar', () => {
  it('disables Model until a make is chosen', () => {
    setup();
    expect(screen.getByLabelText('Model')).toBeDisabled();
  });

  it('lists only the models of the chosen make', () => {
    setup({ ...DEFAULT_FILTERS, make: 'Ford' });
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(expect.arrayContaining(['Focus', 'Puma']));
    expect(options).not.toContain('X1');
  });

  it('clears the model when the make changes', async () => {
    const { onChange } = setup({ ...DEFAULT_FILTERS, make: 'Ford', model: 'Puma' });
    await userEvent.selectOptions(screen.getByLabelText('Make'), 'BMW');
    expect(onChange).toHaveBeenCalledWith({ make: 'BMW', model: '' });
  });

  it('toggles aging-only', async () => {
    const { onChange } = setup();
    await userEvent.click(screen.getByLabelText(/aging stock only/i));
    expect(onChange).toHaveBeenCalledWith({ aging: true });
  });

  it('shows Reset only when a filter is active', () => {
    const { unmount } = render(
      <FiltersBar filters={DEFAULT_FILTERS} search="" onSearch={() => {}} onChange={() => {}} summary={summary} />,
    );
    expect(screen.queryByRole('button', { name: /reset/i })).not.toBeInTheDocument();
    unmount();
    setup({ ...DEFAULT_FILTERS, make: 'Ford' });
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });
});
