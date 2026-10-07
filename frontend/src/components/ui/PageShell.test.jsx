import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import PageShell from './PageShell';
import { PrimaryButton } from './Button';

it('renders the operational page hierarchy in Arabic', () => {
  render(
    <MemoryRouter>
      <PageShell
        breadcrumbs={[{ label: 'التوصيل', to: '/delivery' }, { label: 'دليل السائقين' }]}
        title="دليل السائقين"
        description="السائق ليس حساب دخول."
        primaryAction={<PrimaryButton>إضافة سائق</PrimaryButton>}
        kpis={<span>مؤشر</span>}
        filters={<span>مرشح</span>}
      >
        <p>المحتوى</p>
      </PageShell>
    </MemoryRouter>,
  );

  expect(screen.getByRole('navigation', { name: 'مسار الصفحة' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'دليل السائقين' })).toBeInTheDocument();
  expect(screen.getByText('السائق ليس حساب دخول.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'إضافة سائق' })).toBeInTheDocument();
  expect(screen.getByText('مؤشر')).toBeInTheDocument();
  expect(screen.getByText('مرشح')).toBeInTheDocument();
  expect(screen.getByText('المحتوى')).toBeInTheDocument();
});
