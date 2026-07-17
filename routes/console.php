<?php

use App\Enums\SubscriptionStatus;
use App\Jobs\SendDailyOwnerReportJob;
use App\Models\Tenant;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(function () {
    Tenant::query()->whereHas('subscription', function ($query) {
        $query->where('status', SubscriptionStatus::Active);
    })->each(function (Tenant $tenant) {
        SendDailyOwnerReportJob::dispatch($tenant);
    });
})->dailyAt('21:00');
