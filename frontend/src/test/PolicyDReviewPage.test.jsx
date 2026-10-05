import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import PolicyDReviewPage from '../pages/admin/PolicyDReviewPage';
import api from '../api/axios';
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const review = (capabilities = {}) => ({ beneficiary: { id: 'b1', full_name: 'Loaded beneficiary' }, policy_version: { version: 'v1' }, evaluation: { id: 'e1', financial_snapshot: { net_income_per_capita: 321 }, income_category: 'b', policy_score: '19.0000', score_category: 'c' }, documents: [], medical_evidence: null, social_assessment: null, approval_blockers: ['REQUIRED_DOCUMENTS_INCOMPLETE'], current_state: 'pending', decision_history: [], capabilities });
const show = () => render(<MemoryRouter initialEntries={['/review/e1']}><Link to="/review/e2">Other evaluation</Link><Routes><Route path="/review/:evaluationId" element={<PolicyDReviewPage />} /></Routes></MemoryRouter>);

describe('POLICY-D review UI contract', () => {
  beforeEach(() => vi.resetAllMocks());
  it('renders loaded facts and omits decision controls for a pending view-only review', async () => {
    api.get.mockResolvedValue({ data: { data: review({ view_documents: true }) } });
    show();
    expect(await screen.findByText('Loaded beneficiary')).toBeInTheDocument();
    expect(screen.getByTestId('financial-result')).toHaveTextContent('321');
    expect(screen.getByTestId('income-category')).toHaveTextContent('b');
    expect(screen.queryByRole('button', { name: 'اعتماد القرار' })).not.toBeInTheDocument();
  });
  it('shows API rejection without inventing a successful business outcome', async () => {
    api.get.mockResolvedValue({ data: { data: review({ decide: true }) } });
    api.post.mockRejectedValue({ response: { data: { errors: { approval: ['REQUIRED_DOCUMENTS_INCOMPLETE'] } } } });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'اعتماد القرار' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('REQUIRED_DOCUMENTS_INCOMPLETE');
    expect(screen.getByTestId('decision-history')).toBeEmptyDOMElement();
    expect(screen.getByTestId('decision-state')).toHaveTextContent('قرار معلق');
  });
  it('reports denied or failed reads', async () => {
    api.get.mockRejectedValue(new Error('403'));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحميل');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('does not expose the previous evaluation actions while a new route loads', async () => {
    api.get.mockResolvedValueOnce({ data: { data: review({ decide: true }) } }).mockImplementation(() => new Promise(() => {}));
    show();
    await screen.findByRole('button', { name: 'اعتماد القرار' });
    fireEvent.click(screen.getByText('Other evaluation'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'اعتماد القرار' })).not.toBeInTheDocument());
    expect(api.post).not.toHaveBeenCalled();
  });
});
