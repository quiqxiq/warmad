<?php

namespace App\Jobs;

use App\Models\Tenant;
use App\Services\Reports\DailyOwnerReport;
use App\Services\WhatsApp\WhatsAppGateway;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendDailyOwnerReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public Tenant $tenant,
        public ?CarbonInterface $date = null
    ) {}

    /**
     * Execute the job.
     */
    public function handle(DailyOwnerReport $reportService, WhatsAppGateway $whatsAppGateway): void
    {
        $date = $this->date ?? now()->subDay(); // Default to yesterday's report since it runs daily (or today's, let's see)
        // Wait, plan says "scheduler harian jam 21:00 WIB yang dispatch job per tenant aktif".
        // If it runs at 21:00 WIB, it sends reports for *today* (today's transactions up to 21:00 or the whole day).
        // Let's use today ($date = $this->date ?? now()) so that if it runs at 21:00, it reports today's data.
        $date = $this->date ?? now();

        $message = $reportService->generate($this->tenant, $date);

        if (blank($this->tenant->phone)) {
            return;
        }

        $whatsAppGateway->send($this->tenant->phone, $message);
    }
}
