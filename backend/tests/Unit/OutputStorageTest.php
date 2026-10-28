<?php

namespace Tests\Unit;

use App\Services\Storage\OutputStorage;
use PHPUnit\Framework\TestCase;

class OutputStorageTest extends TestCase
{
    public function test_sanitizes_folder_names_while_preserving_persian_text(): void
    {
        $input = 'جزوه آزمون جامع قلب و عروق / بخش اول';
        $sanitized = OutputStorage::sanitizeFolderName($input);

        $this->assertSame('جزوه-آزمون-جامع-قلب-و-عروق-بخش-اول', $sanitized);
    }

    public function test_strips_path_traversal_characters(): void
    {
        $input = '../../etc/passwd..';
        $sanitized = OutputStorage::sanitizeFolderName($input);

        $this->assertSame('etc-passwd', $sanitized);
    }

    public function test_falls_back_to_responses_on_empty(): void
    {
        $this->assertSame('responses', OutputStorage::sanitizeFolderName(''));
        $this->assertSame('responses', OutputStorage::sanitizeFolderName('   '));
        $this->assertSame('responses', OutputStorage::sanitizeFolderName('...///'));
    }

    public function test_builds_deterministic_chunk_filename(): void
    {
        $filename = OutputStorage::buildToHtmlFilename(0, 'CUT 1', 1);
        $this->assertSame('0001-CUT-1-chunk-1.txt', $filename);

        $filenameMulti = OutputStorage::buildToHtmlFilename(14, 'CUT 99', 3);
        $this->assertSame('0015-CUT-99-chunk-3.txt', $filenameMulti);
    }
}
