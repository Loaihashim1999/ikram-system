<?php

namespace App\Http\Controllers;

use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\Distribution;
use App\Models\InventoryItem;
use App\Models\NeighborhoodRep;
use App\Models\RepDistribution;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class NeighborhoodRepController extends Controller
{
    public function index(?Request $request = null): JsonResponse
    {
        $query = NeighborhoodRep::withCount('repDistributions');

        if ($request && $request->filled('search')) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('full_name', 'like', "%{$s}%")
                    ->orWhere('district_name', 'like', "%{$s}%")
                    ->orWhere('city', 'like', "%{$s}%")
                    ->orWhere('national_id', 'like', "%{$s}%")
                    ->orWhere('phone', 'like', "%{$s}%");
            });
        }

        if ($request && $request->filled('city') && $request->city !== 'all') {
            $query->where('city', $request->city);
        }

        if ($request && $request->filled('district') && $request->district !== 'all') {
            $query->where('district_name', $request->district);
        }

        $reps = $query->latest()->get();

        // Calculate actual linked families and receipt count for each representative
        foreach ($reps as $r) {
            $linkedBeneficiariesIds = Beneficiary::where('district', 'like', "%{$r->district_name}%")
                ->orWhere('city', 'like', "%{$r->district_name}%")
                ->pluck('id');

            $linkedCount = $linkedBeneficiariesIds->count();
            $r->linked_beneficiaries_count = $linkedCount > 0 ? $linkedCount : ($r->beneficiaries_count ?? 0);

            $repDistCount = RepDistribution::where('rep_id', $r->id)->count();
            $benDistCount = Distribution::whereIn('beneficiary_id', $linkedBeneficiariesIds)->count();

            $r->rep_distributions_count = max($repDistCount, $benDistCount);
        }

        return response()->json(['data' => $reps]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => 'required|string|max:150',
            'phone' => 'required|string|max:20',
            'national_id' => 'nullable|string|max:20',
            'date_of_birth' => 'nullable|date',
            'city' => 'nullable|string|max:100',
            'district_name' => 'required|string|max:100',
            'national_address' => 'nullable|string|max:255',
            'beneficiaries_count' => 'nullable|integer|min:0',
            'status' => 'nullable|string|in:active,suspended',
            'id_document_image' => 'nullable|file|image|max:5120',
            'support_letter' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'national_address_doc' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'dependents_ids_zip' => 'nullable|file|mimes:zip,rar,7z,pdf|max:20480',
        ]);

        if ($request->hasFile('id_document_image')) {
            $validated['id_document_image_url'] = $request->file('id_document_image')->store('reps', 'public');
        }
        if ($request->hasFile('support_letter')) {
            $validated['support_letter_url'] = $request->file('support_letter')->store('reps', 'public');
        }
        if ($request->hasFile('national_address_doc')) {
            $validated['national_address_doc_url'] = $request->file('national_address_doc')->store('reps', 'public');
        }
        if ($request->hasFile('dependents_ids_zip')) {
            $validated['dependents_ids_zip_url'] = $request->file('dependents_ids_zip')->store('reps', 'public');
        }

        $validated['id'] = Str::uuid();
        $validated['city'] = $validated['city'] ?? 'مكة المكرمة';
        $validated['status'] = $validated['status'] ?? 'active';

        // Save linked beneficiaries if provided
        if ($request->has('linked_beneficiaries')) {
            $raw = $request->input('linked_beneficiaries');
            $linked = is_string($raw) ? json_decode($raw, true) : $raw;
            if (is_array($linked)) {
                foreach ($linked as $item) {
                    if (is_array($item) && (! empty($item['name']) || ! empty($item['full_name']))) {
                        $fullName = $item['full_name'] ?? $item['name'];
                        $dob = ! empty($item['date_of_birth']) ? $item['date_of_birth'] : (! empty($item['birth_date']) ? $item['birth_date'] : null);

                        Beneficiary::create([
                            'id' => (string) Str::uuid(),
                            'full_name' => $fullName,
                            'phone' => $item['phone'] ?? null,
                            'national_id' => $item['national_id'] ?? null,
                            'date_of_birth' => $dob,
                            'city' => $validated['city'],
                            'district' => $validated['district_name'],
                            'beneficiary_type' => $item['beneficiary_type'] ?? $item['type'] ?? 'citizen',
                            'family_members_count' => intval($item['family_members_count'] ?? 1),
                            'status' => 'active',
                        ]);
                    }
                }
            }
        }

        // Calculate actual count
        $linkedCount = Beneficiary::where('district', 'like', "%{$validated['district_name']}%")->count();
        $validated['beneficiaries_count'] = $linkedCount > 0 ? $linkedCount : intval($validated['beneficiaries_count'] ?? 0);

        $rep = NeighborhoodRep::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل مندوب الحي وإدراج الأسر بنجاح.',
            'data' => $rep,
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        $rep = NeighborhoodRep::with('repDistributions')->findOrFail($id);
        $linkedBeneficiaries = Beneficiary::with(['dependents'])
            ->where('district', 'like', "%{$rep->district_name}%")
            ->orWhere('city', 'like', "%{$rep->district_name}%")
            ->get();

        return response()->json([
            'data' => [
                'representative' => $rep,
                'linked_beneficiaries' => $linkedBeneficiaries,
                'linked_count' => $linkedBeneficiaries->count(),
                'distributions_count' => $rep->repDistributions->count(),
            ],
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $rep = NeighborhoodRep::findOrFail($id);

        $validated = $request->validate([
            'full_name' => 'sometimes|required|string|max:150',
            'phone' => 'sometimes|required|string|max:20',
            'national_id' => 'nullable|string|max:20',
            'date_of_birth' => 'nullable|date',
            'city' => 'nullable|string|max:100',
            'district_name' => 'sometimes|required|string|max:100',
            'national_address' => 'nullable|string|max:255',
            'beneficiaries_count' => 'nullable|integer|min:0',
            'status' => 'nullable|string|in:active,suspended',
            'id_document_image' => 'nullable|file|image|max:5120',
            'support_letter' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'national_address_doc' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'dependents_ids_zip' => 'nullable|file|mimes:zip,rar,7z,pdf|max:20480',
        ]);

        if ($request->hasFile('id_document_image')) {
            $validated['id_document_image_url'] = $request->file('id_document_image')->store('reps', 'public');
        }
        if ($request->hasFile('support_letter')) {
            $validated['support_letter_url'] = $request->file('support_letter')->store('reps', 'public');
        }
        if ($request->hasFile('national_address_doc')) {
            $validated['national_address_doc_url'] = $request->file('national_address_doc')->store('reps', 'public');
        }
        if ($request->hasFile('dependents_ids_zip')) {
            $validated['dependents_ids_zip_url'] = $request->file('dependents_ids_zip')->store('reps', 'public');
        }

        // Save linked beneficiaries if provided
        if ($request->has('linked_beneficiaries')) {
            $raw = $request->input('linked_beneficiaries');
            $linked = is_string($raw) ? json_decode($raw, true) : $raw;
            if (is_array($linked)) {
                foreach ($linked as $item) {
                    if (is_array($item) && (! empty($item['name']) || ! empty($item['full_name']))) {
                        $fullName = $item['full_name'] ?? $item['name'];
                        $dob = ! empty($item['date_of_birth']) ? $item['date_of_birth'] : (! empty($item['birth_date']) ? $item['birth_date'] : null);
                        $benId = $item['id'] ?? null;

                        if ($benId) {
                            Beneficiary::where('id', $benId)->update([
                                'full_name' => $fullName,
                                'phone' => $item['phone'] ?? null,
                                'national_id' => $item['national_id'] ?? null,
                                'date_of_birth' => $dob,
                                'beneficiary_type' => $item['beneficiary_type'] ?? $item['type'] ?? 'citizen',
                                'family_members_count' => intval($item['family_members_count'] ?? 1),
                            ]);
                        } else {
                            Beneficiary::create([
                                'id' => (string) Str::uuid(),
                                'full_name' => $fullName,
                                'phone' => $item['phone'] ?? null,
                                'national_id' => $item['national_id'] ?? null,
                                'date_of_birth' => $dob,
                                'city' => $validated['city'] ?? $rep->city,
                                'district' => $validated['district_name'] ?? $rep->district_name,
                                'beneficiary_type' => $item['beneficiary_type'] ?? $item['type'] ?? 'citizen',
                                'family_members_count' => intval($item['family_members_count'] ?? 1),
                                'status' => 'active',
                            ]);
                        }
                    }
                }
            }
        }

        $rep->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات مندوب الحي بنجاح.',
            'data' => $rep,
        ]);
    }

    public function toggleStatus(string $id): JsonResponse
    {
        $rep = NeighborhoodRep::findOrFail($id);
        $newStatus = ($rep->status === 'suspended') ? 'active' : 'suspended';
        $rep->update(['status' => $newStatus]);

        return response()->json([
            'success' => true,
            'message' => 'تم تغيير حالة المندوب بنجاح.',
            'status' => $newStatus,
        ]);
    }

    public function exportLinkedBeneficiariesExcel(string $id)
    {
        $rep = NeighborhoodRep::findOrFail($id);
        $linked = Beneficiary::with('dependents')
            ->where('district', 'like', "%{$rep->district_name}%")
            ->orWhere('city', 'like', "%{$rep->district_name}%")
            ->get();

        $filename = 'الأسر_التابعة_لمندوب_'.str_replace(' ', '_', $rep->full_name).'.csv';

        $output = "\u{FEFF}";
        $output .= "اسم المستفيد,رقم الهاتف,رقم الهوية,تاريخ الميلاد,المدينة والحي,النوع,عدد التابعين\n";

        foreach ($linked as $b) {
            $name = str_replace(',', ' ', $b->full_name ?? $b->name);
            $phone = $b->phone;
            $natId = $b->national_id;
            $dob = $b->date_of_birth ? substr($b->date_of_birth, 0, 10) : ($b->birth_date ? substr($b->birth_date, 0, 10) : '');
            $cityDistrict = ($b->city ?? 'مكة').' - '.($b->district ?? '');
            $type = ($b->beneficiary_type ?? $b->type) === 'citizen' ? 'مواطن' : 'مقيم';
            $depsCount = is_countable($b->dependents) ? count($b->dependents) : ($b->family_members_count ?? 1);

            $output .= "{$name},{$phone},{$natId},{$dob},{$cityDistrict},{$type},{$depsCount}\n";
        }

        return response($output, 200, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    public function dispatchSupport(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'basket_id' => 'required|uuid',
            'scheduled_date' => 'required|date',
            'driver_id' => 'nullable|string',
        ]);

        $rep = NeighborhoodRep::findOrFail($id);
        $count = max(1, $rep->beneficiaries_count);

        $basket = Basket::find($validated['basket_id']) ?? InventoryItem::find($validated['basket_id']);
        if (! $basket) {
            return response()->json(['success' => false, 'message' => 'السلة أو الصنف غير موجود.'], 422);
        }

        $code = 'REP-'.strtoupper(Str::random(6));

        $repDist = RepDistribution::create([
            'id' => Str::uuid(),
            'rep_id' => $rep->id,
            'basket_id' => $basket->id,
            'barcode_code' => $code,
            'quantity' => $count,
            'scheduled_date' => $validated['scheduled_date'],
            'driver_id' => $validated['driver_id'] ?? null,
            'status' => 'pending',
        ]);

        if ($basket instanceof Basket) {
            $basket->decrement('stock_quantity', $count);
        } elseif ($basket instanceof InventoryItem) {
            $basket->decrement('current_quantity', $count);
        }

        return response()->json([
            'success' => true,
            'message' => "تم تخصيص وتوجيه الدعم لمندوب الحي ({$count} سلة) وتمرير المهمة للسائق.",
            'data' => $repDist,
            'qr_code' => $code,
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $rep = NeighborhoodRep::findOrFail($id);
        $rep->delete();

        return response()->json(['success' => true, 'message' => 'تم حذف مندوب الحي.']);
    }
}
