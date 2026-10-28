<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('automation:process')->everyMinute()->withoutOverlapping();
Schedule::command('automation:cleanup-temp')->hourly();
Schedule::command('automation:cleanup-expired')->hourly();
Schedule::command('queue:prune-failed --hours=168')->daily();
