<?php

namespace App\Enums;

enum StageStatus: string
{
    case NotStarted = 'not_started';
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Success = 'success';
    case Error = 'error';
    case Skipped = 'skipped';
}
