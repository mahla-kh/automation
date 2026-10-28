import fs from "fs";
import path from "path";

const CONTRACTS_DIR = path.join(process.cwd(), "docs", "migration", "contracts");

if (!fs.existsSync(CONTRACTS_DIR)) {
  fs.mkdirSync(CONTRACTS_DIR, { recursive: true });
}

interface ContractFixture {
  name: string;
  route: string;
  method: "GET" | "POST";
  request: {
    query?: Record<string, string>;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body: any;
  };
}

const fixtures: ContractFixture[] = [
  // 1. Pipeline Start - Success
  {
    name: "pipelines_start_success",
    route: "/api/pipelines/start",
    method: "POST",
    request: {
      body: {
        folderUrl: "https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
      }
    },
    response: {
      status: 200,
      body: {
        success: true,
        jobId: "00000000-0000-0000-0000-000000000001",
        totalFiles: 3
      }
    }
  },

  // 2. Pipeline Start - 400 Missing URL
  {
    name: "pipelines_start_400_missing_url",
    route: "/api/pipelines/start",
    method: "POST",
    request: {
      body: {}
    },
    response: {
      status: 400,
      body: {
        error: "Folder URL is required"
      }
    }
  },

  // 3. Pipeline Status - List Summaries
  {
    name: "pipelines_status_list",
    route: "/api/pipelines/status",
    method: "GET",
    request: {},
    response: {
      status: 200,
      body: {
        jobs: [
          {
            id: "00000000-0000-0000-0000-000000000001",
            status: "processing",
            createdAt: "2026-10-25T12:00:00.000Z",
            totalFiles: 5
          }
        ]
      }
    }
  },

  // 4. Pipeline Status - Details
  {
    name: "pipelines_status_details",
    route: "/api/pipelines/status",
    method: "GET",
    request: {
      query: { id: "00000000-0000-0000-0000-000000000001" }
    },
    response: {
      status: 200,
      body: {
        id: "00000000-0000-0000-0000-000000000001",
        status: "processing",
        createdAt: "2026-10-25T12:00:00.000Z",
        files: [
          {
            fileId: "file-1",
            fileName: "Exam_Chapter_1.pdf",
            download: {
              status: "success",
              startedAt: "2026-10-25T12:00:01.000Z",
              completedAt: "2026-10-25T12:00:03.000Z",
              durationMs: 2000
            },
            upload: {
              status: "in_progress",
              startedAt: "2026-10-25T12:00:15.000Z"
            },
            ocr: {
              status: "success",
              startedAt: "2026-10-25T12:00:03.000Z",
              completedAt: "2026-10-25T12:00:15.000Z",
              durationMs: 12000
            },
            overallStatus: "in_progress",
            startedAt: "2026-10-25T12:00:01.000Z"
          }
        ],
        logs: [
          {
            id: "log-1",
            timestamp: "2026-10-25T12:00:00.000Z",
            level: "INFO",
            message: "Job initialized with 1 file(s).",
            stage: "pipeline"
          }
        ],
        summary: {
          total: 1,
          completed: 0,
          processing: 1,
          failed: 0,
          pending: 0,
          ocrSuccessRate: 100,
          ocrErrorRate: 0,
          avgOcrDurationMs: 12000
        }
      }
    }
  },

  // 5. Pipeline Status - 404 Not Found
  {
    name: "pipelines_status_404",
    route: "/api/pipelines/status",
    method: "GET",
    request: {
      query: { id: "non-existent-id" }
    },
    response: {
      status: 404,
      body: {
        error: "Job not found"
      }
    }
  },

  // 6. Pipeline Download - 400 Not Ready
  {
    name: "pipelines_download_not_ready_400",
    route: "/api/pipelines/download",
    method: "GET",
    request: {
      query: { jobId: "job-1", fileId: "file-1" }
    },
    response: {
      status: 400,
      body: {
        error: "OCR output is not ready yet for file: Exam_Chapter_1.pdf"
      }
    }
  },

  // 7. Pipeline Merge - 400 No Completed Files
  {
    name: "pipelines_merge_400_no_files",
    route: "/api/pipelines/merge",
    method: "GET",
    request: {
      query: { jobId: "job-1" }
    },
    response: {
      status: 400,
      body: {
        error: "No completed files to merge yet"
      }
    }
  },

  // 8. ToHTML Start - Success
  {
    name: "tohtml_start_success",
    route: "/api/tohtml/start",
    method: "POST",
    request: {
      body: {
        fileName: "Cardiology_Test.txt",
        prompt: "You are an expert HTML booklet designer...",
        maxLinesPerChunk: 600,
        sections: [
          {
            marker: "CUT 1",
            markerNumber: 1,
            content: "Question 1 content...",
            charCount: 50
          }
        ]
      }
    },
    response: {
      status: 200,
      body: {
        success: true,
        jobId: "00000000-0000-0000-0000-000000000002",
        totalChunks: 1,
        totalSections: 1,
        fileName: "Cardiology_Test.txt"
      }
    }
  },

  // 9. ToHTML Start - 400 Validation Error
  {
    name: "tohtml_start_400_invalid",
    route: "/api/tohtml/start",
    method: "POST",
    request: {
      body: {
        fileName: "",
        prompt: "test",
        sections: []
      }
    },
    response: {
      status: 400,
      body: {
        error: "fileName is required and must be a string"
      }
    }
  },

  // 10. ToHTML Status - List Summaries
  {
    name: "tohtml_status_list",
    route: "/api/tohtml/status",
    method: "GET",
    request: {},
    response: {
      status: 200,
      body: {
        jobs: [
          {
            id: "00000000-0000-0000-0000-000000000002",
            fileName: "Cardiology_Test.txt",
            status: "processing",
            createdAt: "2026-10-25T12:00:00.000Z",
            totalSections: 2,
            completedSections: 1,
            failedSections: 0
          }
        ]
      }
    }
  },

  // 11. ToHTML Status - Details
  {
    name: "tohtml_status_details",
    route: "/api/tohtml/status",
    method: "GET",
    request: {
      query: { id: "00000000-0000-0000-0000-000000000002" }
    },
    response: {
      status: 200,
      body: {
        id: "00000000-0000-0000-0000-000000000002",
        fileName: "Cardiology_Test.txt",
        folderName: "tohtml-Cardiology_Test",
        prompt: "You are an expert HTML booklet designer...",
        status: "processing",
        createdAt: "2026-10-25T12:00:00.000Z",
        sections: [
          {
            id: "sec-1",
            index: 0,
            sectionIndex: 0,
            marker: "CUT 1",
            markerNumber: 1,
            chunkIndex: 0,
            chunkNumber: 1,
            totalChunks: 1,
            label: "CUT 1 — Chunk 1/1",
            content: "Question 1 content...",
            charCount: 22,
            lineCount: 1,
            status: "completed",
            outputFilename: "0001-CUT-1-chunk-1.txt",
            durationMs: 4500,
            completedAt: "2026-10-25T12:00:05.000Z"
          }
        ],
        logs: [
          {
            id: "log-1",
            timestamp: "2026-10-25T12:00:00.000Z",
            level: "INFO",
            message: "Job created with 1 section(s) split into 1 chunk(s) from \"Cardiology_Test.txt\"."
          }
        ],
        summary: {
          total: 1,
          completed: 1,
          processing: 0,
          failed: 0,
          pending: 0,
          avgDurationMs: 4500
        }
      }
    }
  },

  // 12. ToHTML Retry - Single Chunk
  {
    name: "tohtml_retry_single_chunk",
    route: "/api/tohtml/retry",
    method: "POST",
    request: {
      body: {
        jobId: "00000000-0000-0000-0000-000000000002",
        sectionIndex: 0
      }
    },
    response: {
      status: 200,
      body: {
        success: true,
        jobId: "00000000-0000-0000-0000-000000000002",
        sectionIndex: 0
      }
    }
  },

  // 13. ToHTML Retry - All Failed
  {
    name: "tohtml_retry_all_failed",
    route: "/api/tohtml/retry",
    method: "POST",
    request: {
      body: {
        jobId: "00000000-0000-0000-0000-000000000002"
      }
    },
    response: {
      status: 200,
      body: {
        success: true,
        jobId: "00000000-0000-0000-0000-000000000002",
        sectionIndex: "all_failed"
      }
    }
  },

  // 14. ToHTML Download - Merged 400 None Ready
  {
    name: "tohtml_download_merged_400_none",
    route: "/api/tohtml/download",
    method: "GET",
    request: {
      query: {
        jobId: "00000000-0000-0000-0000-000000000002",
        merged: "true"
      }
    },
    response: {
      status: 400,
      body: {
        error: "No completed section output files available to merge"
      }
    }
  }
];

for (const fix of fixtures) {
  const filePath = path.join(CONTRACTS_DIR, `${fix.name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(fix, null, 2), "utf8");
  console.log(`Saved contract fixture: ${fix.name}.json`);
}

console.log(`\nSuccessfully recorded ${fixtures.length} contract fixtures to ${CONTRACTS_DIR}`);
