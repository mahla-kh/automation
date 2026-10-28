<?php

namespace Tests\Unit;

use App\Services\Support\FolderUrlParser;
use PHPUnit\Framework\TestCase;

class FolderUrlParserTest extends TestCase
{
    public function test_extracts_id_from_standard_folders_url(): void
    {
        $url = 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ';
        $this->assertSame('1aBcDeFgHiJkLmNoPqRsTuVwXyZ', FolderUrlParser::extractFolderId($url));
    }

    public function test_extracts_id_with_query_params(): void
    {
        $url = 'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ?usp=sharing';
        $this->assertSame('1aBcDeFgHiJkLmNoPqRsTuVwXyZ', FolderUrlParser::extractFolderId($url));
    }

    public function test_extracts_raw_id(): void
    {
        $id = '1aBcDeFgHiJkLmNoPqRsTuVwXyZ';
        $this->assertSame('1aBcDeFgHiJkLmNoPqRsTuVwXyZ', FolderUrlParser::extractFolderId($id));
    }

    public function test_returns_null_on_empty(): void
    {
        $this->assertNull(FolderUrlParser::extractFolderId(''));
        $this->assertNull(FolderUrlParser::extractFolderId('   '));
    }
}
