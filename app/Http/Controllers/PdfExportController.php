<?php

namespace App\Http\Controllers;

use App\Models\Beneficiary;
use App\Models\DailyInventoryMovement;
use App\Models\DailyReceivingTransaction;
use App\Models\Distribution;
use App\Models\NeighborhoodRep;
use App\Models\Staff;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Mpdf\Mpdf;

class PdfExportController extends Controller
{
    private function createMpdf(string $orientation = 'P'): Mpdf
    {
        $tempDir = storage_path('app/mpdf');
        if (!file_exists($tempDir)) {
            @mkdir($tempDir, 0777, true);
        }

        return new Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'orientation' => $orientation,
            'margin_top' => $orientation === 'L' ? 18 : 58,
            'margin_bottom' => $orientation === 'L' ? 18 : 32,
            'margin_left' => 12,
            'margin_right' => 12,
            'autoScriptToLang' => true,
            'autoLangToFont' => true,
            'tempDir' => $tempDir,
        ]);
    }

    /**
     * Export Individual Receipt Document (سند استلام فردي)
     */
    public function exportIndividualReceipt($distributionId)
    {
        $distribution = Distribution::with(['beneficiary.dependents', 'basket'])->find($distributionId);
        
        // Fallback: Check if the ID provided is a beneficiary ID
        if (!$distribution) {
            $distribution = Distribution::with(['beneficiary.dependents', 'basket'])
                ->where('beneficiary_id', $distributionId)
                ->latest()
                ->first();
        }

        if (!$distribution) {
            return response()->json(['error' => 'لا يوجد سند توزيع مسجل لهذا المستفيد حتى الآن'], 404);
        }

        $beneficiary = $distribution->beneficiary;

        try {
            $html = view('pdf.individual_receipt', [
                'distribution' => $distribution,
                'beneficiary' => $beneficiary,
            ])->render();

            $mpdf = $this->createMpdf();
            $mpdf->WriteHTML($html);

            return response($mpdf->Output('', 'S'), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"سند_استلام_فردي_{$distribution->barcode_code}.pdf\"",
            ]);
        } catch (\Throwable $e) {
            $html = view('pdf.individual_receipt', [
                'distribution' => $distribution,
                'beneficiary' => $beneficiary,
            ])->render();

            return response($html . '<script>window.onload = function() { window.print(); };</script>', 200, [
                'Content-Type' => 'text/html; charset=utf-8',
            ]);
        }
    }

    /**
     * Export Total Delivery Document (سند الاستلام الشامل التاريخي)
     */
    public function exportTotalDelivery($beneficiaryId)
    {
        $beneficiary = Beneficiary::find($beneficiaryId);
        if (!$beneficiary) {
            return response()->json(['error' => 'المستفيد غير موجود'], 404);
        }

        $distributions = Distribution::with('basket')
            ->where('beneficiary_id', $beneficiaryId)
            ->latest()
            ->get();

        try {
            $html = view('pdf.total_delivery', [
                'beneficiary' => $beneficiary,
                'distributions' => $distributions,
            ])->render();

            $mpdf = $this->createMpdf();
            $mpdf->WriteHTML($html);

            return response($mpdf->Output('', 'S'), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"سند_استلام_شامل_{$beneficiary->national_id}.pdf\"",
            ]);
        } catch (\Throwable $e) {
            $html = view('pdf.total_delivery', [
                'beneficiary' => $beneficiary,
                'distributions' => $distributions,
            ])->render();

            return response($html . '<script>window.onload = function() { window.print(); };</script>', 200, [
                'Content-Type' => 'text/html; charset=utf-8',
            ]);
        }
    }

    /**
     * Export Representative Document (سند تسليم مندوب الحي)
     */
    public function exportRepresentativeReceipt($repId)
    {
        $representative = NeighborhoodRep::find($repId);
        if (!$representative) {
            return response()->json(['error' => 'مندوب الحي غير موجود'], 404);
        }

        $linkedBeneficiaries = Beneficiary::where('district', 'like', "%{$representative->district_name}%")
            ->orWhere('city', 'like', "%{$representative->district_name}%")
            ->get();

        try {
            $html = view('pdf.representative_receipt', [
                'representative' => $representative,
                'linkedBeneficiaries' => $linkedBeneficiaries,
            ])->render();

            $mpdf = $this->createMpdf();
            $mpdf->WriteHTML($html);

            return response($mpdf->Output('', 'S'), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"سند_تسليم_مندوب_{$representative->district_name}.pdf\"",
            ]);
        } catch (\Throwable $e) {
            $html = view('pdf.representative_receipt', [
                'representative' => $representative,
                'linkedBeneficiaries' => $linkedBeneficiaries,
            ])->render();

            return response($html . '<script>window.onload = function() { window.print(); };</script>', 200, [
                'Content-Type' => 'text/html; charset=utf-8',
            ]);
        }
    }

    /**
     * Export Staff Document (سند استلام موظف الجمعية)
     */
    public function exportStaffReceipt($staffId)
    {
        $staff = Staff::with(['dependents', 'distributions.basket'])->find($staffId);
        if (!$staff) {
            return response()->json(['error' => 'الموظف غير موجود'], 404);
        }

        try {
            $html = view('pdf.staff_receipt', [
                'staff' => $staff,
                'distributions' => $staff->distributions,
            ])->render();

            $mpdf = $this->createMpdf();
            $mpdf->WriteHTML($html);

            return response($mpdf->Output('', 'S'), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"سند_استلام_موظف_{$staff->national_id}.pdf\"",
            ]);
        } catch (\Throwable $e) {
            $html = view('pdf.staff_receipt', [
                'staff' => $staff,
                'distributions' => $staff->distributions,
            ])->render();

            return response($html . '<script>window.onload = function() { window.print(); };</script>', 200, [
                'Content-Type' => 'text/html; charset=utf-8',
            ]);
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
            $mpdf->WriteHTML($html);

            return response($mpdf->Output('', 'S'), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"سند_استلام_يومي_{$transaction->document_number}.pdf\"",
            ]);
        } catch (\Throwable $e) {
            $html = view('pdf.daily_receiving_voucher', [
                'transaction' => $transaction,
            ])->render();

            return response($html . '<script>window.onload = function() { window.print(); };</script>', 200, [
                'Content-Type' => 'text/html; charset=utf-8',
            ]);
        }
    }

    /**
     * Export Daily Official Report (التقرير اليومي لعمليات التوزيع والمساعدات)
     */
    public function exportDailyReport(Request $request)
    {
        $dateStr = $request->get('date', Carbon::today()->toDateString());
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
            $mpdf->WriteHTML($html);

            return response($mpdf->Output('', 'S'), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"التقرير_اليومي_{$dateStr}.pdf\"",
            ]);
        } catch (\Throwable $e) {
            $html = view('pdf.daily_report', [
                'date' => $dateStr,
                'dailyReceivingList' => $dailyReceivingList,
                'dailyMovements' => $dailyMovements,
                'dailyReceivingCount' => $dailyReceivingCount,
                'dailyBasketsCount' => $dailyBasketsCount,
                'generalDeliveriesCount' => $generalDeliveriesCount,
            ])->render();

            return response($html . '<script>window.onload = function() { window.print(); };</script>', 200, [
                'Content-Type' => 'text/html; charset=utf-8',
            ]);
        }
    }

    /**
     * Export Weekly / Custom Range Comprehensive Report (التقرير الإحصائي الشامل)
     */
    public function exportWeeklyComprehensiveReport(Request $request)
    {
        // Use AnalyticsController logic to get complete aggregated metrics
        $analyticsCtrl = app(AnalyticsController::class);
        $analyticsResponse = $analyticsCtrl->index($request);
        $analytics = $analyticsResponse->getData(true);

        try {
            $html = view('pdf.weekly_comprehensive_report', [
                'analytics' => $analytics,
            ])->render();

            $mpdf = $this->createMpdf('L');
            $mpdf->WriteHTML($html);

            $periodLabel = $analytics['period']['start_date'] . '_to_' . $analytics['period']['end_date'];

            return response($mpdf->Output('', 'S'), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"التقرير_الشامل_{$periodLabel}.pdf\"",
            ]);
        } catch (\Throwable $e) {
            $html = view('pdf.weekly_comprehensive_report', [
                'analytics' => $analytics,
            ])->render();

            return response($html . '<script>window.onload = function() { window.print(); };</script>', 200, [
                'Content-Type' => 'text/html; charset=utf-8',
            ]);
        }
    }
}
