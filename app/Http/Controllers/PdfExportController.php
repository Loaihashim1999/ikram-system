<?php

namespace App\Http\Controllers;

use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\DailyInventoryMovement;
use App\Models\DailyReceivingTransaction;
use App\Models\Distribution;
use App\Models\DriverAssignment;
use App\Models\NeighborhoodRep;
use App\Models\PolicyDecision;
use App\Models\Staff;
use App\Models\SupportDistribution;
use App\Models\SupportReceipt;
use App\Models\User;
use App\Services\GovernanceReportService;
use App\Support\AssociationIdentity;
use App\Support\Pdf\AssociationFrame;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Mpdf\Mpdf;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class PdfExportController extends Controller
{
    private function createMpdf(string $orientation = 'P'): Mpdf
    {
        return AssociationFrame::open($orientation);
    }

    private function writeDocument(Mpdf $mpdf, string $html, string $orientation = 'P'): void
    {
        $mpdf->WriteHTML($html);
    }

    private function pdfResponse(Mpdf $mpdf, string $filename, string $disposition = 'inline')
    {
        $safeFilename = preg_replace('/[^A-Za-z0-9._-]/', '-', $filename) ?: 'ikram-document.pdf';
        if (! str_ends_with(strtolower($safeFilename), '.pdf')) {
            $safeFilename .= '.pdf';
        }

        return response($mpdf->Output('', 'S'), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => $disposition.'; filename="'.$safeFilename.'"',
            'Cache-Control' => 'private, no-store, max-age=0',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function exportSupportProof(string $id)
    {
        $support = SupportDistribution::findOrFail($id);
        abort_unless($support->status === 'completed', 409, 'إثبات الاستلام متاح بعد اكتمال الدعم.');
        $receipt = SupportReceipt::where('support_distribution_id', $id)->firstOrFail();
        $legacy = $receipt->proof_snapshot === null;
        $proof = $receipt->proof_snapshot;
        if ($legacy) {
            // Historical rows have no reliable delivery-time contacts. Never backfill them.
            $support->load(['items.inventoryItem', 'beneficiary', 'staff', 'organization']);
            $assignment = $receipt->driver_assignment_id ? DriverAssignment::with('driver')->findOrFail($receipt->driver_assignment_id) : null;
            $recipient = $support->{$support->recipient_type};
            $proof = ['task_reference' => $support->id, 'fulfillment_method' => $support->fulfillment_method,
                'recipient' => ['display_name' => $support->recipient_name, 'reference' => $support->recipient_reference,
                    'phone' => $support->recipient_type === 'organization' ? $recipient?->contact : $recipient?->phone,
                    'full_address' => implode('، ', array_filter([$recipient?->city, $recipient?->district, $recipient?->street ?? $recipient?->national_address]))],
                'driver' => $assignment ? ['id' => $assignment->driver_id, 'name' => $assignment->driver?->full_name] : null,
                'pickup_location' => $support->pickup_location_name,
                'employee' => ['name' => User::find($receipt->confirmed_by)?->full_name],
                'confirmed_at' => $receipt->confirmed_at->toIso8601String(), 'verification_method' => 'receipt_code',
                'items' => $support->items->map(fn ($item) => ['name' => $item->inventoryItem?->name,
                    'quantity' => $item->fulfilled_quantity, 'unit' => $item->unit_snapshot])->values()->all()];
        }
        $html = view('pdf.support_proof', [
            'receipt' => $receipt, 'proof' => $proof, 'legacy' => $legacy,
            'confirmedAt' => Carbon::parse($proof['confirmed_at']), 'generatedAt' => now(),
        ])->render();
        $mpdf = $this->createMpdf();
        $this->writeDocument($mpdf, $html);

        return $this->pdfResponse($mpdf, ($proof['fulfillment_method'] === 'delivery' ? 'delivery-proof-' : 'handover-receipt-').$receipt->id.'.pdf')
            ->header('X-Proof-Source', $legacy ? 'legacy-current-data' : 'confirmation-snapshot');
    }

    public function exportBeneficiaryCard(string $id)
    {
        $beneficiary = Beneficiary::with(['dependents', 'category'])->findOrFail($id);
        $evaluation = BeneficiaryPolicyEvaluation::with('policyVersion')
            ->where('beneficiary_id', $beneficiary->id)
            ->where('evaluation_status', BeneficiaryPolicyEvaluation::STATUS_COMPLETED)
            ->latest('evaluated_at')
            ->latest('id')
            ->first();
        $decision = $evaluation
            ? PolicyDecision::where('evaluation_id', $evaluation->id)->latest('decided_at')->latest('id')->first()
            : null;
        try {
            $mpdf = $this->createMpdf();
            $this->writeDocument($mpdf, view('pdf.beneficiary_card', compact('beneficiary', 'evaluation', 'decision'))->render());

            return $this->pdfResponse($mpdf, 'beneficiary-card.pdf', 'attachment');
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'تعذر إصدار ملف PDF. يرجى المحاولة مجدداً أو التواصل مع المسؤول.'], 500);
        }
    }

    /**
     * Export Individual Receipt Document (سند استلام فردي)
     */
    public function exportIndividualReceipt($distributionId)
    {
        $distribution = Distribution::with(['beneficiary.dependents', 'basket'])->find($distributionId);

        // Fallback: Check if the ID provided is a beneficiary ID
        if (! $distribution) {
            $distribution = Distribution::with(['beneficiary.dependents', 'basket'])
                ->where('beneficiary_id', $distributionId)
                ->latest()
                ->first();
        }

        if (! $distribution) {
            return response()->json(['error' => 'لا يوجد سند توزيع مسجل لهذا المستفيد حتى الآن'], 404);
        }

        $beneficiary = $distribution->beneficiary;
        if (User::isDriverRole(request()->user()?->role)) {
            abort_unless($distribution->driver_id === request()->user()->id, 403);
        }

        try {
            $html = view('pdf.individual_receipt', [
                'distribution' => $distribution,
                'beneficiary' => $beneficiary,
            ])->render();

            $mpdf = $this->createMpdf();
            $this->writeDocument($mpdf, $html);

            return $this->pdfResponse($mpdf, 'individual-receipt.pdf');
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'تعذر إصدار ملف PDF. يرجى المحاولة مجدداً أو التواصل مع المسؤول.'], 500);
        }
    }

    /**
     * Export Total Delivery Document (سند الاستلام الشامل التاريخي)
     */
    public function exportTotalDelivery($beneficiaryId)
    {
        $beneficiary = Beneficiary::find($beneficiaryId);
        if (! $beneficiary) {
            return response()->json(['error' => 'المستفيد غير موجود'], 404);
        }

        $distributions = Distribution::with('basket')
            ->where('beneficiary_id', $beneficiaryId)
            ->orderByDesc('scheduled_at')
            ->orderByDesc('id')
            ->get();

        try {
            $html = view('pdf.total_delivery', [
                'beneficiary' => $beneficiary,
                'distributions' => $distributions,
            ])->render();

            $mpdf = $this->createMpdf();
            $this->writeDocument($mpdf, $html);

            return $this->pdfResponse($mpdf, 'beneficiary-distribution-history.pdf');
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'تعذر إصدار ملف PDF. يرجى المحاولة مجدداً أو التواصل مع المسؤول.'], 500);
        }
    }

    /**
     * Export Representative Document (سند تسليم مندوب الحي)
     */
    public function exportRepresentativeReceipt($repId)
    {
        $representative = NeighborhoodRep::find($repId);
        if (! $representative) {
            return response()->json(['error' => 'مندوب الحي غير موجود'], 404);
        }

        $linkedBeneficiaries = Beneficiary::where('district', $representative->district_name)
            ->orWhere('city', $representative->district_name)
            ->get();

        try {
            $html = view('pdf.representative_receipt', [
                'representative' => $representative,
                'linkedBeneficiaries' => $linkedBeneficiaries,
            ])->render();

            $mpdf = $this->createMpdf();
            $this->writeDocument($mpdf, $html);

            return $this->pdfResponse($mpdf, 'representative-receipt.pdf');
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'تعذر إصدار ملف PDF. يرجى المحاولة مجدداً أو التواصل مع المسؤول.'], 500);
        }
    }

    /**
     * Export Staff Document (سند استلام موظف الجمعية)
     */
    public function exportStaffReceipt($staffId)
    {
        $staff = Staff::with(['dependents', 'distributions.basket'])->find($staffId);
        if (! $staff) {
            return response()->json(['error' => 'الموظف غير موجود'], 404);
        }

        try {
            $html = view('pdf.staff_receipt', [
                'staff' => $staff,
                'distributions' => $staff->distributions,
            ])->render();

            $mpdf = $this->createMpdf();
            $this->writeDocument($mpdf, $html);

            return $this->pdfResponse($mpdf, 'staff-receipt.pdf');
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'تعذر إصدار ملف PDF. يرجى المحاولة مجدداً أو التواصل مع المسؤول.'], 500);
        }
    }

    /**
     * Export Daily Receiving Voucher (سند استلام مساعدة للمستفيد اليومي)
     */
    public function exportDailyReceivingVoucher($transactionId)
    {
        $transaction = DailyReceivingTransaction::with([
            'beneficiary',
            'inventoryItem',
            'authorizedUser',
        ])->findOrFail($transactionId);

        try {
            $html = view('pdf.daily_receiving_voucher', [
                'transaction' => $transaction,
            ])->render();

            $mpdf = $this->createMpdf('P');
            $this->writeDocument($mpdf, $html, 'P');

            return $this->pdfResponse($mpdf, 'daily-receiving-voucher.pdf');
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'تعذر إصدار ملف PDF. يرجى المحاولة مجدداً أو التواصل مع المسؤول.'], 500);
        }
    }

    /**
     * Export Daily Official Report (التقرير اليومي لعمليات التوزيع والمساعدات)
     */
    public function exportDailyReport(Request $request)
    {
        $validated = $request->validate(['date' => ['nullable', 'date_format:Y-m-d']]);
        $dateStr = $validated['date'] ?? Carbon::today()->toDateString();
        $date = Carbon::parse($dateStr);

        $dailyReceivingList = DailyReceivingTransaction::with(['beneficiary', 'inventoryItem', 'authorizedUser'])
            ->whereDate('receiving_date', $date)
            ->latest('receiving_date')
            ->get();

        $dailyMovements = DailyInventoryMovement::with(['item', 'user'])
            ->whereDate('created_at', $date)
            ->latest()
            ->get();

        $dailyReceivingCount = $dailyReceivingList->count();
        $dailyBasketsCount = $dailyReceivingList->sum('quantity');
        $generalDeliveriesCount = Distribution::whereDate('scheduled_at', $date)->count();

        try {
            $html = view('pdf.daily_report', [
                'date' => $dateStr,
                'dailyReceivingList' => $dailyReceivingList,
                'dailyMovements' => $dailyMovements,
                'dailyReceivingCount' => $dailyReceivingCount,
                'dailyBasketsCount' => $dailyBasketsCount,
                'generalDeliveriesCount' => $generalDeliveriesCount,
            ])->render();

            $mpdf = $this->createMpdf('L');
            $this->writeDocument($mpdf, $html, 'L');

            return $this->pdfResponse($mpdf, 'daily-report-'.$dateStr.'.pdf');
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'تعذر إصدار ملف PDF. يرجى المحاولة مجدداً أو التواصل مع المسؤول.'], 500);
        }
    }

    /**
     * Export Weekly / Custom Range Comprehensive Report (التقرير الإحصائي الشامل)
     */
    public function exportWeeklyComprehensiveReport(Request $request)
    {
        $report = app(GovernanceReportService::class)->build($request);
        $html = view('pdf.weekly_comprehensive_report', compact('report'))->render();
        $mpdf = $this->createMpdf('L');
        $this->writeDocument($mpdf, $html, 'L');

        return $this->pdfResponse($mpdf, 'governance-report.pdf');
    }

    public function exportComprehensiveExcel(Request $request)
    {
        $report = app(GovernanceReportService::class)->build($request);
        $workbook = new Spreadsheet;
        $cover = $workbook->getActiveSheet()->setTitle('Report');
        $cover->fromArray([
            [AssociationIdentity::name()],
            ['تقرير الحوكمة'],
            ['From', $report['analytics']['period']['start_date']],
            ['To', $report['analytics']['period']['end_date']],
            ['Generated', $report['generated_at']],
            ['Scope', 'snapshot = current records; period = selected dates'],
            ['Privacy', 'Credentials, banking and document paths excluded'],
        ]);
        $report['datasets'] = ['analysis_indicators' => $report['indicators'], 'monthly_trend' => $report['timeline']] + $report['datasets'];
        foreach ($report['datasets'] as $name => $rows) {
            $sheet = $workbook->createSheet()->setTitle(substr($name, 0, 31));
            $sheet->setRightToLeft(true);
            if (! $rows) {
                $sheet->setCellValue('A1', 'No matching records');

                continue;
            }
            $headers = array_keys(reset($rows));
            $sheet->fromArray($headers, null, 'A1');
            $rowNumber = 2;
            foreach ($rows as $row) {
                foreach (array_values($row) as $col => $value) {
                    $coordinate = [$col + 1, $rowNumber];
                    $header = $headers[$col];
                    $numericColumns = ['family_members_count', 'monthly_salary', 'total_income', 'monthly_rent', 'net_income', 'policy_score', 'total_received_count', 'quantity', 'current_quantity', 'reserved_quantity', 'min_threshold'];
                    if (is_int($value) || is_float($value) || ($value !== null && is_numeric($value) && in_array($header, $numericColumns, true))) {
                        $sheet->setCellValueExplicit($coordinate, (float) $value, DataType::TYPE_NUMERIC);
                    } elseif (is_bool($value)) {
                        $sheet->setCellValueExplicit($coordinate, $value, DataType::TYPE_BOOL);
                    } else {
                        $text = is_scalar($value) || $value === null ? (string) $value : json_encode($value, JSON_UNESCAPED_UNICODE);
                        // Prevent spreadsheet formula injection while preserving the displayed text.
                        if (preg_match('/^[=+\-@]/u', ltrim($text))) {
                            $text = "'".$text;
                        }
                        $sheet->setCellValueExplicit($coordinate, $text, DataType::TYPE_STRING);
                    }
                }
                $rowNumber++;
            }
            $sheet->freezePane('A2');
            $sheet->setAutoFilter($sheet->calculateWorksheetDimension());
            $sheet->getStyle('1:1')->getFont()->setBold(true);
            foreach (range(1, count($headers)) as $column) {
                $sheet->getColumnDimensionByColumn($column)->setWidth(22);
            }
        }

        return response()->streamDownload(function () use ($workbook) {
            (new Xlsx($workbook))->save('php://output');
        }, 'governance-data.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Cache-Control' => 'private, no-store']);
    }
}
