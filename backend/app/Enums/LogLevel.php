<?php

namespace App\Enums;

enum LogLevel: string
{
    case Info = 'INFO';
    case Warn = 'WARN';
    case Error = 'ERROR';
    case Debug = 'DEBUG';
}
