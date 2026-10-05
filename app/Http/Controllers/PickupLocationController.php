<?php

namespace App\Http\Controllers;

use App\Models\PickupLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PickupLocationController extends Controller
{
    public function index()
    {
        return response()->json(['data' => PickupLocation::orderBy('name')->get()]);
    }

    private function rules(bool $creating): array
    {
        return ['name' => ($creating ? 'required' : 'sometimes').'|string|max:150', 'location_url' => 'nullable|url:http,https|max:2048', 'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100', 'district' => 'nullable|string|max:100', 'is_active' => 'sometimes|boolean'];
    }

    public function store(Request $request)
    {
        return response()->json(['data' => PickupLocation::create($request->validate($this->rules(true)))], 201);
    }

    public function update(Request $request, string $id)
    {
        $data = $request->validate($this->rules(false));
        $location = DB::transaction(function () use ($id, $data) {
            $location = PickupLocation::whereKey($id)->lockForUpdate()->firstOrFail();
            $location->update($data);

            return $location;
        });

        return response()->json(['data' => $location]);
    }

    public function destroy(string $id)
    {
        DB::transaction(function () use ($id) {
            $location = PickupLocation::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($location->distributions()->exists()) {
                throw ValidationException::withMessages(['location' => 'الموقع مرتبط بسجل دعم؛ يمكن تعطيله فقط.']);
            }
            $location->delete();
        });

        return response()->json(['success' => true]);
    }
}
