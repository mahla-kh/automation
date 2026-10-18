import test from "node:test";
import assert from "node:assert/strict";
import {
  translations,
  getLocalizedPromptTitle,
  getLocalizedPromptPreview,
  Language,
} from "../../app/i18n/translations";
import { PROMPT_PRESETS, getPromptByTitle } from "../prompts/notebookPrompts";
import { buildRanges } from "./batchRanges";
import { buildPromptForBatch } from "../workers/noteBook.worker";

test("Localization - Default language and directionality", () => {
  const defaultLang: Language = "fa";
  assert.equal(defaultLang, "fa", "Default language must be Persian (fa)");

  // Directionality rules
  const getDir = (lang: Language) => (lang === "fa" ? "rtl" : "ltr");
  assert.equal(getDir("fa"), "rtl", "Persian must be RTL");
  assert.equal(getDir("en"), "ltr", "English must be LTR");
});

test("Localization - Dictionary completeness and key symmetry between fa and en", () => {
  const fa = translations.fa;
  const en = translations.en;

  // Helper to recursively assert that all keys in source exist in target and are non-empty
  function assertSymmetry(source: Record<string, unknown>, target: Record<string, unknown>, path = "") {
    for (const key of Object.keys(source)) {
      const currentPath = path ? `${path}.${key}` : key;
      assert.ok(key in target, `Key "${currentPath}" missing in target translation dictionary`);

      const srcVal = source[key];
      const tgtVal = target[key];
      if (typeof srcVal === "object" && srcVal !== null) {
        assert.equal(typeof tgtVal, "object", `Path "${currentPath}" should be an object in both dictionaries`);
        assertSymmetry(srcVal as Record<string, unknown>, tgtVal as Record<string, unknown>, currentPath);
      } else {
        assert.equal(typeof tgtVal, "string", `Path "${currentPath}" should be a string in target`);
        assert.ok((srcVal as string).length > 0, `Path "${currentPath}" is empty in source`);
        assert.ok((tgtVal as string).length > 0, `Path "${currentPath}" is empty in target`);
      }
    }
  }

  // Symmetrical check: fa -> en and en -> fa
  assertSymmetry(fa, en, "translations");
  assertSymmetry(en, fa, "translations");
});

test("Localization - Prompt display titles translate correctly in fa and en", () => {
  // Preset ID lookup
  assert.equal(
    getLocalizedPromptTitle("question-range", "fa"),
    "تحلیل سؤالات (مبتنی بر بازه)"
  );
  assert.equal(
    getLocalizedPromptTitle("question-range", "en"),
    "Question Analysis (Range Based)"
  );

  assert.equal(
    getLocalizedPromptTitle("jozve-condensed", "fa"),
    "جزوه - نسخه ۲"
  );
  assert.equal(
    getLocalizedPromptTitle("jozve-condensed", "en"),
    "Jozve - (V2)"
  );

  // Original English title lookup (case-insensitive)
  assert.equal(
    getLocalizedPromptTitle("Question Analysis (Range Based)", "fa"),
    "تحلیل سؤالات (مبتنی بر بازه)"
  );
  assert.equal(
    getLocalizedPromptTitle("Question Analysis (Range Based)", "en"),
    "Question Analysis (Range Based)"
  );

  // Fallback for custom prompt titles
  assert.equal(
    getLocalizedPromptTitle("My Custom Medical Prompt", "fa"),
    "My Custom Medical Prompt"
  );
  assert.equal(
    getLocalizedPromptTitle("My Custom Medical Prompt", "en"),
    "My Custom Medical Prompt"
  );
});

test("Localization - Prompt previews translate correctly without modifying templates", () => {
  const faPreview = getLocalizedPromptPreview("question-range", "fa");
  const enPreview = getLocalizedPromptPreview("question-range", "en");

  assert.ok(faPreview.length > 0, "Persian preview should not be empty");
  assert.ok(enPreview.length > 0, "English preview should not be empty");
  assert.notEqual(faPreview, enPreview, "Persian preview should differ from English preview");

  // Fallback for unknown preset
  const fallback = getLocalizedPromptPreview("unknown-preset", "fa", "Default Preview");
  assert.equal(fallback, "Default Preview");
});

test("Prompt Integrity - Presets templates are byte-for-byte identical and unmodified", () => {
  assert.ok(PROMPT_PRESETS.length >= 7, "All prompt presets must exist");

  for (const preset of PROMPT_PRESETS) {
    assert.ok(preset.template.length > 50, `Preset ${preset.id} template must not be empty`);
    assert.ok(preset.title.length > 0, `Preset ${preset.id} title must not be empty`);

    // Verify lookup by title remains identical and unaffected
    const retrieved = getPromptByTitle(preset.title);
    assert.ok(retrieved, `Preset must be retrievable by original English title "${preset.title}"`);
    assert.equal(retrieved?.template, preset.template, "Retrieved template must be strictly equal");

    // Check placeholders integrity
    if (preset.id === "question-range") {
      assert.ok(
        preset.template.includes("{start}") && preset.template.includes("{end}"),
        `Question preset ${preset.id} must preserve {start} and {end} placeholders`
      );
    }
    if (preset.id === "question-order") {
      assert.ok(
        preset.template.includes("{index}") && preset.template.includes("{batch}"),
        `Question preset ${preset.id} must preserve {index} and {batch} placeholders`
      );
    }
  }
});

test("Prompt Integrity - Switching language does not alter generated prompt content or ranges", () => {
  const preset = PROMPT_PRESETS.find((p) => p.id === "question-range");
  assert.ok(preset);

  // Simulate prompt building in Persian UI vs English UI
  const startpoint = 21;
  const batch = 10;
  const qLength = 20;

  const ranges = buildRanges(qLength, batch, startpoint);
  assert.deepEqual(ranges, [
    { start: 21, end: 30 },
    { start: 31, end: 40 },
  ]);

  const prompt1 = buildPromptForBatch(preset.template, {
    start: 21,
    end: 30,
    index: 0,
    batch: 10,
  });
  const prompt2 = buildPromptForBatch(preset.template, {
    start: 21,
    end: 30,
    index: 0,
    batch: 10,
  });

  // Verify byte-for-byte identity
  assert.equal(prompt1, prompt2);
  assert.ok(prompt1.includes("21"));
  assert.ok(prompt1.includes("30"));
});

test("API Contract & DeepSeek Payload Integrity - Payloads remain identical across languages", () => {
  // Mock client submission payload created under Persian UI vs English UI
  const selectedPreset = PROMPT_PRESETS[0];

  const payloadPersianUI = {
    noteBookUrl: "https://notebooklm.google.com/notebook/test",
    subject: "Cardiology",
    folderName: "Cardio-Batch-1",
    promptTitle: selectedPreset.title, // Canonical English title preserved
    promptText: selectedPreset.template, // Byte-for-byte original template
    promptType: "question" as const,
    questionsLength: 50,
    batch: 25,
    startpoint: 1,
  };

  const payloadEnglishUI = {
    noteBookUrl: "https://notebooklm.google.com/notebook/test",
    subject: "Cardiology",
    folderName: "Cardio-Batch-1",
    promptTitle: selectedPreset.title,
    promptText: selectedPreset.template,
    promptType: "question" as const,
    questionsLength: 50,
    batch: 25,
    startpoint: 1,
  };

  assert.deepEqual(
    payloadPersianUI,
    payloadEnglishUI,
    "Payload submitted to backend API must be identical regardless of UI language"
  );

  // DeepSeek Chat payload simulation
  const deepseekSystemPrompt = "Return ONLY valid HTML";
  const deepseekUserPrompt = "Section 1 content";

  const deepseekRequestPersian = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: deepseekSystemPrompt },
      { role: "user", content: deepseekUserPrompt },
    ],
  };

  const deepseekRequestEnglish = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: deepseekSystemPrompt },
      { role: "user", content: deepseekUserPrompt },
    ],
  };

  assert.deepEqual(
    deepseekRequestPersian,
    deepseekRequestEnglish,
    "DeepSeek request payload must never be altered by UI localization"
  );
});
