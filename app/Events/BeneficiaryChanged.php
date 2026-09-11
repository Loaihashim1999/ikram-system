<?php

namespace App\Events;

use App\Models\Beneficiary;
use Illuminate\Queue\SerializesModels;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Broadcasting\InteractsWithSockets;

class BeneficiaryChanged
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Beneficiary $beneficiary;

    /**
     * Create a new event instance.
     */
    public function __construct(Beneficiary $beneficiary)
    {
        $this->beneficiary = $beneficiary;
    }
}
?>
