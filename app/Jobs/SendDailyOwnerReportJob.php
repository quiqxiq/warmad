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
     *
     * Runs from the 21:00 daily schedule, so it reports on today's data
     * (PRD §6.6). A specific date can be passed for backfills.
     */
    public function handle(DailyOwnerReport $reportService, WhatsAppGateway $whatsAppGateway): void
    {
        if (blank($this->tenant->phone)) {
            return;
        }

        $message = $reportService->generate($this->tenant, $this->date ?? now());

        $whatsAppGateway->send($this->tenant->phone, $message);
    }
}
