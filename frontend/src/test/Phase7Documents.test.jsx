import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReceiptHistoryTimeline from '../components/common/ReceiptHistoryTimeline';
import StatisticsPage from '../pages/statistics/StatisticsPage';
import { exportApiDataToExcel } from '../utils/excelExport';
import { downloadDocument } from '../utils/documentUrl';

vi.mock('../utils/excelExport', () => ({ exportApiDataToExcel: vi.fn(() => Promise.resolve(2)) }));
vi.mock('../utils/documentUrl', () => ({
  downloadDocument: vi.fn(() => Promise.resolve()),
  getDocumentPdfUrl: (path) => `http://localhost/api${path}`,
}));
vi.mock('../api/beneficiaries', () => ({ default: { list: vi.fn(() => Promise.resolve({ data: { data: [] } })) } }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

beforeEach(() => vi.clearAllMocks());

describe('official document actions', () => {
  it('exports the full receipt history from the server instead of printing the page', () => {
    render(<ReceiptHistoryTimeline records={[{ id: 'visible-row' }]} beneficiaryId="beneficiary-1" recipientName="مستفيد" />);
    expect(screen.queryByText(/طباعة|window.print/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'تصدير Excel' }));
    expect(exportApiDataToExcel).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: '/support/distributions',
      params: { beneficiary_id: 'beneficiary-1' },
    }));
  });

  it('sends statistics exports to the official server documents', async () => {
    render(<StatisticsPage />);
    expect(screen.queryByText(/طباعة/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'تصدير Excel' }));
    fireEvent.click(screen.getByRole('button', { name: 'التقرير الرسمي' }));
    expect(downloadDocument).toHaveBeenCalledWith('http://localhost/api/beneficiaries/unified/export', 'ikram-beneficiaries.xlsx');
    expect(downloadDocument).toHaveBeenCalledWith('http://localhost/api/reports/comprehensive/pdf', 'governance-report.pdf');
  });
});
