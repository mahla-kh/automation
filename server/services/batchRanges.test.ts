import test from "node:test";
import assert from "node:assert/strict";
import { buildRanges, resolveStartpoint, resolveQuestionsLength } from "./batchRanges";
import { buildPromptForBatch } from "../workers/noteBook.worker";
import {
  createJob,
  registerPrompt,
  getPromptRecord,
  prepareJobForRetry
} from "./Njob.service";

test("1. startpoint 1, batch 20, qLength 60 -> 1–20, 21–40, 41–60", () => {
  const ranges = buildRanges(60, 20, 1);
  assert.deepStrictEqual(ranges, [
    { start: 1, end: 20 },
    { start: 21, end: 40 },
    { start: 41, end: 60 }
  ]);
});

test("2. startpoint 40, batch 20, qLength 60 -> 40–59, 60–79, 80–99", () => {
  const ranges = buildRanges(60, 20, 40);
  assert.deepStrictEqual(ranges, [
    { start: 40, end: 59 },
    { start: 60, end: 79 },
    { start: 80, end: 99 }
  ]);
});

test("3. startpoint 100, batch 10, qLength 30 -> 100–109, 110–119, 120–129", () => {
  const ranges = buildRanges(30, 10, 100);
  assert.deepStrictEqual(ranges, [
    { start: 100, end: 109 },
    { start: 110, end: 119 },
    { start: 120, end: 129 }
  ]);
});

test("4. batch 1, startpoint 5, qLength 3 -> 5–5, 6–6, 7–7", () => {
  const ranges = buildRanges(3, 1, 5);
  assert.deepStrictEqual(ranges, [
    { start: 5, end: 5 },
    { start: 6, end: 6 },
    { start: 7, end: 7 }
  ]);
});

test("5. startpoint 40, batch 20, qLength 50 -> 40–59, 60–79, 80–89", () => {
  const ranges = buildRanges(50, 20, 40);
  assert.deepStrictEqual(ranges, [
    { start: 40, end: 59 },
    { start: 60, end: 79 },
    { start: 80, end: 89 }
  ]);
});

test("6. resolveStartpoint throws for invalid inputs", () => {
  const invalidValues = [0, -3, 1.5, "abc", "4.5", NaN, true];
  for (const val of invalidValues) {
    assert.throws(
      () => resolveStartpoint(val),
      /startpoint must be a positive integer/
    );
  }
});

test("7. resolveStartpoint returns 1 for defaults and parsed integer for valid inputs", () => {
  assert.strictEqual(resolveStartpoint(undefined), 1);
  assert.strictEqual(resolveStartpoint(null), 1);
  assert.strictEqual(resolveStartpoint(""), 1);
  assert.strictEqual(resolveStartpoint(40), 40);
  assert.strictEqual(resolveStartpoint("40"), 40);
});

test("8. buildPromptForBatch with {start} and {end} produces 60 and 79 for 2nd range of startpoint 40 / batch 20", () => {
  const ranges = buildRanges(60, 20, 40);
  const secondRange = ranges[1]; // { start: 60, end: 79 }
  const template = "Analyze questions from {start} to {end}.";
  const output = buildPromptForBatch(template, {
    start: secondRange.start,
    end: secondRange.end,
    index: 1,
    batch: 20
  });
  assert.ok(output.includes("60"), `Expected output to include 60, got: ${output}`);
  assert.ok(output.includes("79"), `Expected output to include 79, got: ${output}`);
  assert.strictEqual(output, "Analyze questions from 60 to 79.");
});

test("9. Job service startpoint default, prompt registration, retry preservation, and ranges equivalence", () => {
  const defaultJob = createJob({
    noteBookUrl: "https://example.com/notebook/1",
    promptTitle: "Default Job",
    promptType: "question",
    batch: 20,
    qLength: 60
  });
  assert.strictEqual(defaultJob.startpoint, 1);

  const customJob = createJob({
    noteBookUrl: "https://example.com/notebook/2",
    promptTitle: "Custom Job",
    promptType: "question",
    batch: 20,
    qLength: 60,
    startpoint: 40
  });
  assert.strictEqual(customJob.startpoint, 40);

  const rangesBefore = buildRanges(customJob.qLength, customJob.batch, customJob.startpoint);

  registerPrompt(customJob.id, {
    index: 1,
    start: 60,
    end: 79,
    prompt: "Prompt for batch 2"
  });

  const record = getPromptRecord(customJob.id, 1);
  assert.ok(record, "Prompt record should exist");
  assert.strictEqual(record.start, 60);
  assert.strictEqual(record.end, 79);

  prepareJobForRetry(customJob.id);
  assert.strictEqual(customJob.startpoint, 40);

  const rangesAfter = buildRanges(customJob.qLength, customJob.batch, customJob.startpoint);
  assert.deepStrictEqual(rangesAfter, rangesBefore);
});

test("10. Two createJob calls with startpoint 1 and 40 produce independent, different range sets", () => {
  const job1 = createJob({
    noteBookUrl: "https://example.com/notebook/job1",
    promptTitle: "Job 1",
    promptType: "question",
    batch: 20,
    qLength: 60,
    startpoint: 1
  });

  const job2 = createJob({
    noteBookUrl: "https://example.com/notebook/job2",
    promptTitle: "Job 2",
    promptType: "question",
    batch: 20,
    qLength: 60,
    startpoint: 40
  });

  const ranges1 = buildRanges(job1.qLength, job1.batch, job1.startpoint);
  const ranges2 = buildRanges(job2.qLength, job2.batch, job2.startpoint);

  assert.notDeepStrictEqual(ranges1, ranges2);
  assert.strictEqual(ranges1[0].start, 1);
  assert.strictEqual(ranges1[0].end, 20);
  assert.strictEqual(ranges2[0].start, 40);
  assert.strictEqual(ranges2[0].end, 59);
});

test("11. resolveQuestionsLength throws for missing or empty inputs", () => {
  const emptyInputs = [undefined, null, "", "   "];
  for (const input of emptyInputs) {
    assert.throws(
      () => resolveQuestionsLength(input),
      (err: Error) => {
        assert.match(err.message, /Questions length is required/i);
        return true;
      },
      `Expected missing/empty input ${JSON.stringify(input)} to throw required error`
    );
  }
});

test("12. resolveQuestionsLength throws for invalid inputs (zero, negative, decimal, non-numeric)", () => {
  const invalidInputs = [0, -1, -50, 10.5, -10.5, "0", "-5", "10.5", "abc", true, false, NaN, Infinity, -Infinity];
  for (const input of invalidInputs) {
    assert.throws(
      () => resolveQuestionsLength(input),
      (err: Error) => {
        assert.match(err.message, /positive whole number/i);
        return true;
      },
      `Expected invalid input ${JSON.stringify(input)} to throw invalid error`
    );
  }
});

test("13. resolveQuestionsLength returns parsed positive integer for valid inputs", () => {
  assert.strictEqual(resolveQuestionsLength(1), 1);
  assert.strictEqual(resolveQuestionsLength(50), 50);
  assert.strictEqual(resolveQuestionsLength(100), 100);
  assert.strictEqual(resolveQuestionsLength("1"), 1);
  assert.strictEqual(resolveQuestionsLength("75"), 75);
  assert.strictEqual(resolveQuestionsLength("  200  "), 200);
});

test("14. createJob throws when qLength is missing, empty, or invalid in Question Mode", () => {
  assert.throws(
    () =>
      createJob({
        noteBookUrl: "https://example.com/notebook/test",
        promptTitle: "Test",
        promptType: "question",
        batch: 20,
      }),
    /Questions length is required/i
  );

  assert.throws(
    () =>
      createJob({
        noteBookUrl: "https://example.com/notebook/test",
        promptTitle: "Test",
        promptType: "question",
        batch: 20,
        qLength: 0,
      }),
    /positive whole number/i
  );

  assert.throws(
    () =>
      createJob({
        noteBookUrl: "https://example.com/notebook/test",
        promptTitle: "Test",
        promptType: "question",
        batch: 20,
        qLength: -10,
      }),
    /positive whole number/i
  );

  assert.throws(
    () =>
      createJob({
        noteBookUrl: "https://example.com/notebook/test",
        promptTitle: "Test",
        promptType: "question",
        batch: 20,
        qLength: 12.5,
      }),
    /positive whole number/i
  );
});

test("15. createJob in Jozve Mode does not require qLength", () => {
  const jozveJob = createJob({
    noteBookUrl: "https://example.com/notebook/jozve",
    promptTitle: "Jozve Job",
    promptType: "jozve",
    topics: ["Topic 1", "Topic 2"],
  });
  assert.strictEqual(jozveJob.promptType, "jozve");
  assert.strictEqual(jozveJob.totalBatches, 2);
});
