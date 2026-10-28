<?php

namespace Tests\Unit;

use App\Services\Support\LineSplitter;
use PHPUnit\Framework\TestCase;

class LineSplitterTest extends TestCase
{
    public function test_100_lines_produces_one_chunk(): void
    {
        $lines = array_map(fn($i) => "Line {$i}", range(1, 100));
        $text = implode("\n", $lines);

        $chunks = LineSplitter::split($text, 600);

        $this->assertCount(1, $chunks);
        $this->assertCount(100, explode("\n", $chunks[0]));
    }

    public function test_exactly_600_lines_produces_one_chunk(): void
    {
        $lines = array_map(fn($i) => "Line {$i}", range(1, 600));
        $text = implode("\n", $lines);

        $chunks = LineSplitter::split($text, 600);

        $this->assertCount(1, $chunks);
        $this->assertCount(600, explode("\n", $chunks[0]));
    }

    public function test_601_lines_produces_two_chunks(): void
    {
        $lines = array_map(fn($i) => "Line {$i}", range(1, 601));
        $text = implode("\n", $lines);

        $chunks = LineSplitter::split($text, 600);

        $this->assertCount(2, $chunks);
        $this->assertCount(600, explode("\n", $chunks[0]));
        $this->assertCount(1, explode("\n", $chunks[1]));
        $this->assertSame('Line 601', $chunks[1]);
    }

    public function test_1350_lines_produces_three_chunks(): void
    {
        $lines = array_map(fn($i) => "Line {$i}", range(1, 1350));
        $text = implode("\n", $lines);

        $chunks = LineSplitter::split($text, 600);

        $this->assertCount(3, $chunks);
        $this->assertCount(600, explode("\n", $chunks[0]));
        $this->assertCount(600, explode("\n", $chunks[1]));
        $this->assertCount(150, explode("\n", $chunks[2]));
        $this->assertStringStartsWith("Line 1\n", $chunks[0]);
        $this->assertStringStartsWith("Line 601\n", $chunks[1]);
        $this->assertStringStartsWith("Line 1201\n", $chunks[2]);
        $this->assertStringEndsWith('Line 1350', $chunks[2]);
    }

    public function test_crlf_and_empty_inputs_handled_properly(): void
    {
        $crlfText = "Line A\r\nLine B\r\nLine C\r\nLine D";
        $chunks = LineSplitter::split($crlfText, 2);

        $this->assertCount(2, $chunks);
        $this->assertSame("Line A\nLine B", $chunks[0]);
        $this->assertSame("Line C\nLine D", $chunks[1]);

        $emptyChunks = LineSplitter::split('', 600);
        $this->assertCount(0, $emptyChunks);
    }
}
