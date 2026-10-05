import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PolicyApplicationRunsPage from '../pages/admin/PolicyApplicationRunsPage';
import api from '../api/axios';
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const version = (appliesTo = 'all_existing_and_new') => ({ id: 'v1', policy_name: 'سياسة الاختبار', version: '1.0', configuration: { application_scope: { applies_to: appliesTo } } });
const run = (status, id = 'r1') => ({ id, policy_version_id: 'v1', status, scope_mode: 'all_existing_and_new', total_candidates: 3, processed_count: 0, success_count: 0, review_count: 0, not_applicable_count: 0, failed_count: 0, candidate_set_hash: 'hash123', simulation_summary: { simulated_count: 3, failed_count: 0, eligible_count: 2, ineligible_count: 0, not_applicable_count: 1, review_required_count: 0 } });
const itemsPage = { data: [{ id: 'i1', beneficiary_id: 'b1', beneficiary_name: 'مستفيد الاختبار', beneficiary_type: 'citizen', status: 'completed', attempt_count: 1, failure_code: null, failure_details: null, new_evaluation_id: 'eval-new-1', source_evaluation_id: null, processed_at: null }], total: 1, per_page: 10, current_page: 1, last_page: 1 };

const renderPage = () => render(<MemoryRouter initialEntries={['/admin/beneficiary-policy/versions/v1/application-runs']}><Routes><Route path="/admin/beneficiary-policy/versions/:versionId/application-runs" element={<PolicyApplicationRunsPage />} /></Routes></MemoryRouter>);

const mockBackend = ({ appliesTo = 'all_existing_and_new', runsList = [], detail = null, candidates = [] } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/beneficiary-policy/versions/v1') return Promise.resolve({ data: { data: version(appliesTo) } });
    if (url.includes('/versions/v1/application-runs')) return Promise.resolve({ data: { data: runsList } });
    if (url.includes('/items')) return Promise.resolve({ data: { data: itemsPage } });
    if (url.startsWith('/beneficiary-policy/application-runs/')) return Promise.resolve({ data: { data: detail } });
    if (url === '/beneficiaries') return Promise.resolve({ data: { data: { data: candidates } } });
    return Promise.reject(new Error('unexpected url: ' + url));
  });
};

describe('POLICY-E5 application-scope runs UI contract', () => {
  beforeEach(() => vi.resetAllMocks());

  it('lists runs, opens the detail with freshness/counters/summary/items and gates actions by status', async () => {
    mockBackend({ runsList: [run('simulated')], detail: { ...run('simulated'), freshness: { fresh: true, code: 'FRESH' } } });
    renderPage();
    expect(await screen.findByTestId('run-status')).toHaveTextContent('تمت المحاكاة');
    expect(screen.getByRole('button', { name: 'اعتماد للتنفيذ r1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تنفيذ r1' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'تفاصيل r1' }));
    expect(await screen.findByTestId('freshness')).toHaveTextContent('المحاكاة محدثة');
    expect(screen.getByTestId('run-counters')).toHaveTextContent('المرشحون: 3');
    expect(screen.getByTestId('simulation-summary')).toHaveTextContent('محاكى: 3');
    expect(screen.getByTestId('candidate-hash')).toHaveTextContent('hash123');
    expect(screen.getByTestId('items-body')).toHaveTextContent('مستفيد الاختبار');
  });

  it('surfaces the server stable conflict code beside the Arabic message without inventing success', async () => {
    mockBackend({ runsList: [run('approved_for_execution')], detail: { ...run('approved_for_execution'), freshness: { fresh: false, code: 'SIMULATION_STALE' } } });
    api.post.mockRejectedValue({ response: { data: { success: false, code: 'SIMULATION_STALE', message: 'محاكاة قديمة: تغيرت مجموعة المرشحين.' } } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'تفاصيل r1' }));
    expect(await screen.findByTestId('freshness')).toHaveTextContent('قديمة — SIMULATION_STALE');

    fireEvent.click(screen.getByRole('button', { name: 'تنفيذ r1' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('SIMULATION_STALE');
    expect(alert).toHaveTextContent('محاكاة قديمة');
    expect(api.post).toHaveBeenCalledWith('/beneficiary-policy/application-runs/r1/execute');
    expect(screen.getByTestId('detail-status')).toHaveTextContent('معتمد للتنفيذ');
  });

  it('reports denied or failed reads without showing run controls', async () => {
    api.get.mockRejectedValue({ response: { status: 403 } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحميل نطاق التطبيق');
    expect(screen.queryByRole('button', { name: 'تنفيذ' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('runs-empty')).not.toBeInTheDocument();
  });

  it('requires the selected candidate list before simulating a selected-only scope', async () => {
    mockBackend({ appliesTo: 'selected_existing_and_new', runsList: [], candidates: [{ id: 'b1', full_name: 'مستفيد أ', beneficiary_type: 'citizen' }], detail: { ...run('simulated', 'r-new'), freshness: { fresh: true, code: 'FRESH' } } });
    api.post.mockResolvedValue({ data: { data: run('simulated', 'r-new') } });
    renderPage();
    expect(await screen.findByTestId('runs-empty')).toBeInTheDocument();
    expect(screen.getByTestId('candidate-picker')).toBeInTheDocument();
    const create = screen.getByTestId('create-simulate');
    expect(create).toBeDisabled();

    fireEvent.focus(screen.getByLabelText('بحث مستفيد'));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'مستفيد أ' }));
    expect(create).toBeEnabled();
    fireEvent.click(create);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/beneficiary-policy/versions/v1/simulate', { scope_parameters: { beneficiary_ids: ['b1'] } }));
    expect(await screen.findByTestId('policye-message')).toHaveTextContent('تمت المحاكاة');
  });
});
