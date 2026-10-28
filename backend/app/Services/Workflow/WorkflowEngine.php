<?php

namespace App\Services\Workflow;

use App\Models\WorkflowProcess;
use Carbon\Carbon;
use Illuminate\Support\Str;
use InvalidArgumentException;

class WorkflowEngine
{
    public const TYPE_DETAILED_ANSWER = 'detailed_answer';
    public const TYPE_SUMMARY = 'summary';

    public const STATUS_PENDING = 'pending';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    public const STEP_STATUS_NOT_STARTED = 'not_started';
    public const STEP_STATUS_AVAILABLE = 'available';
    public const STEP_STATUS_IN_PROGRESS = 'in_progress';
    public const STEP_STATUS_COMPLETED = 'completed';
    public const STEP_STATUS_SKIPPED = 'skipped';
    public const STEP_STATUS_FAILED = 'failed';

    /**
     * Create and initialize a new workflow process.
     */
    public function createProcess(string $name, string $type): WorkflowProcess
    {
        $trimmedName = trim($name);
        if (empty($trimmedName)) {
            throw new InvalidArgumentException('Process name is required.');
        }

        if (!in_array($type, [self::TYPE_DETAILED_ANSWER, self::TYPE_SUMMARY], true)) {
            throw new InvalidArgumentException("Invalid process type: {$type}");
        }

        $steps = $type === self::TYPE_DETAILED_ANSWER
            ? $this->getDetailedAnswerInitialSteps()
            : $this->getSummaryInitialSteps();

        $process = new WorkflowProcess([
            'id' => (string) Str::uuid(),
            'name' => $trimmedName,
            'type' => $type,
            'status' => self::STATUS_IN_PROGRESS,
            'workflow_version' => 1,
            'steps_data' => $steps,
            'started_at' => Carbon::now(),
        ]);

        $this->recalculateState($process);
        $process->save();

        return $process;
    }

    /**
     * Mark a step complete and update progress.
     */
    public function completeStep(WorkflowProcess $process, string $stepId, array $inputs = [], array $outputs = []): WorkflowProcess
    {
        $steps = $process->steps_data;
        $stepIndex = $this->findStepIndex($steps, $stepId);

        if ($stepIndex === -1) {
            throw new InvalidArgumentException("Step not found: {$stepId}");
        }

        $step = $steps[$stepIndex];

        // Ensure dependencies are met
        if (!$this->isStepEligibleForCompletion($process, $stepId)) {
            throw new InvalidArgumentException("Cannot complete step {$stepId}: previous required steps must be completed first.");
        }

        $step['status'] = self::STEP_STATUS_COMPLETED;
        $step['completed_at'] = Carbon::now()->toIso8601String();
        $step['error'] = null;

        if (!empty($inputs)) {
            $step['inputs'] = array_merge($step['inputs'] ?? [], $inputs);
        }

        if (!empty($outputs)) {
            $step['outputs'] = array_merge($step['outputs'] ?? [], $outputs);
        }

        $steps[$stepIndex] = $step;
        $process->steps_data = $steps;

        $this->recalculateState($process);
        $process->save();

        return $process;
    }

    /**
     * Save step inputs without completing the step.
     */
    public function saveStepInputs(WorkflowProcess $process, string $stepId, array $inputs): WorkflowProcess
    {
        $steps = $process->steps_data;
        $stepIndex = $this->findStepIndex($steps, $stepId);

        if ($stepIndex === -1) {
            throw new InvalidArgumentException("Step not found: {$stepId}");
        }

        $step = $steps[$stepIndex];
        $step['inputs'] = array_merge($step['inputs'] ?? [], $inputs);

        if ($step['status'] === self::STEP_STATUS_NOT_STARTED || $step['status'] === self::STEP_STATUS_AVAILABLE) {
            $step['status'] = self::STEP_STATUS_IN_PROGRESS;
            if (empty($step['started_at'])) {
                $step['started_at'] = Carbon::now()->toIso8601String();
            }
        }

        $steps[$stepIndex] = $step;
        $process->steps_data = $steps;

        $this->recalculateState($process);
        $process->save();

        return $process;
    }

    /**
     * Select a conditional branch (e.g. for Step 4 of Detailed Answer).
     */
    public function selectBranch(WorkflowProcess $process, string $stepId, string $branch): WorkflowProcess
    {
        $steps = $process->steps_data;
        $stepIndex = $this->findStepIndex($steps, $stepId);

        if ($stepIndex === -1) {
            throw new InvalidArgumentException("Step not found: {$stepId}");
        }

        $step = $steps[$stepIndex];

        if (!in_array($branch, ['path_a', 'path_b'], true)) {
            throw new InvalidArgumentException("Invalid branch selection: {$branch}");
        }

        $step['selected_branch'] = $branch;
        $process->selected_branch = $branch;

        $steps[$stepIndex] = $step;
        $process->steps_data = $steps;

        $this->recalculateState($process);
        $process->save();

        return $process;
    }

    /**
     * Mark a prerequisite as already satisfied.
     */
    public function markPrerequisiteSatisfied(WorkflowProcess $process, string $stepId, bool $satisfied): WorkflowProcess
    {
        $steps = $process->steps_data;
        $stepIndex = $this->findStepIndex($steps, $stepId);

        if ($stepIndex === -1) {
            throw new InvalidArgumentException("Step not found: {$stepId}");
        }

        $step = $steps[$stepIndex];
        $step['already_satisfied'] = $satisfied;

        if ($satisfied) {
            $step['status'] = self::STEP_STATUS_COMPLETED;
            $step['completed_at'] = Carbon::now()->toIso8601String();
            $step['error'] = null;
        } else {
            $step['status'] = self::STEP_STATUS_AVAILABLE;
            $step['completed_at'] = null;
        }

        $steps[$stepIndex] = $step;
        $process->steps_data = $steps;

        $this->recalculateState($process);
        $process->save();

        return $process;
    }

    /**
     * Retry a failed step.
     */
    public function retryStep(WorkflowProcess $process, string $stepId): WorkflowProcess
    {
        $steps = $process->steps_data;
        $stepIndex = $this->findStepIndex($steps, $stepId);

        if ($stepIndex === -1) {
            throw new InvalidArgumentException("Step not found: {$stepId}");
        }

        $step = $steps[$stepIndex];
        $step['status'] = self::STEP_STATUS_IN_PROGRESS;
        $step['error'] = null;

        $steps[$stepIndex] = $step;
        $process->steps_data = $steps;

        $this->recalculateState($process);
        $process->save();

        return $process;
    }

    /**
     * Recalculate progress, step statuses, current stage, and completion.
     */
    public function recalculateState(WorkflowProcess $process): void
    {
        $steps = $process->steps_data ?? [];
        $type = $process->type;

        if ($type === self::TYPE_DETAILED_ANSWER) {
            $this->recalculateDetailedAnswer($process, $steps);
        } else {
            $this->recalculateSummary($process, $steps);
        }
    }

    private function recalculateDetailedAnswer(WorkflowProcess $process, array &$steps): void
    {
        $totalRequired = 12;
        $completedRequired = 0;
        $currentStepId = null;
        $allPriorCompleted = true;

        foreach ($steps as $idx => &$step) {
            $stepId = $step['id'];
            $isCompleted = ($step['status'] === self::STEP_STATUS_COMPLETED);

            // Step 4 Branch handling
            if ($stepId === 'step_4_topics') {
                $branch = $step['selected_branch'] ?? $process->selected_branch;
                if ($branch) {
                    $process->selected_branch = $branch;
                }
            }

            if ($allPriorCompleted) {
                if ($step['status'] === self::STEP_STATUS_NOT_STARTED) {
                    $step['status'] = self::STEP_STATUS_AVAILABLE;
                }
                if (!$isCompleted && $currentStepId === null) {
                    $currentStepId = $stepId;
                }
            } else {
                if ($step['status'] === self::STEP_STATUS_AVAILABLE) {
                    $step['status'] = self::STEP_STATUS_NOT_STARTED;
                }
            }

            if ($isCompleted) {
                $completedRequired++;
            } else {
                $allPriorCompleted = false;
            }
        }
        unset($step);

        $process->steps_data = $steps;
        $process->total_steps_count = $totalRequired;
        $process->completed_steps_count = min($completedRequired, $totalRequired);
        $process->progress_percentage = (int) round(($process->completed_steps_count / $totalRequired) * 100);

        if ($currentStepId) {
            $process->current_step_id = $currentStepId;
        }

        if ($completedRequired >= $totalRequired) {
            $process->status = self::STATUS_COMPLETED;
            if (!$process->completed_at) {
                $process->completed_at = Carbon::now();
            }
            if (!$process->expires_at) {
                $process->expires_at = Carbon::parse($process->completed_at)->addDays(2);
            }
            $process->current_step_id = 'step_12_image_review';
        } else {
            if ($process->status === self::STATUS_COMPLETED) {
                $process->status = self::STATUS_IN_PROGRESS;
                $process->completed_at = null;
                $process->expires_at = null;
            }
        }
    }

    private function recalculateSummary(WorkflowProcess $process, array &$steps): void
    {
        // Prerequisites: step_0a_notes, step_0b_drive
        // Ordered steps: step_1_upload_answers through step_7_pdf_export
        $totalRequired = 7;
        $completedRequired = 0;
        $currentStepId = null;

        // Check prerequisites
        $step0a = $this->findStep($steps, 'step_0a_notes');
        $step0b = $this->findStep($steps, 'step_0b_drive');

        $p0aDone = ($step0a['status'] === self::STEP_STATUS_COMPLETED || !empty($step0a['already_satisfied']));
        $p0bDone = ($step0b['status'] === self::STEP_STATUS_COMPLETED || !empty($step0b['already_satisfied']));

        $prerequisitesSatisfied = ($p0aDone && $p0bDone);

        // Update prerequisite availability
        foreach ($steps as &$step) {
            if (in_array($step['id'], ['step_0a_notes', 'step_0b_drive'], true)) {
                if ($step['status'] === self::STEP_STATUS_NOT_STARTED) {
                    $step['status'] = self::STEP_STATUS_AVAILABLE;
                }
            }
        }
        unset($step);

        $allPriorCompleted = $prerequisitesSatisfied;

        foreach ($steps as &$step) {
            $stepId = $step['id'];
            if (in_array($stepId, ['step_0a_notes', 'step_0b_drive'], true)) {
                if (!$prerequisitesSatisfied && $currentStepId === null) {
                    if ($step['status'] !== self::STEP_STATUS_COMPLETED) {
                        $currentStepId = $stepId;
                    }
                }
                continue;
            }

            $isCompleted = ($step['status'] === self::STEP_STATUS_COMPLETED);

            if ($allPriorCompleted) {
                if ($step['status'] === self::STEP_STATUS_NOT_STARTED) {
                    $step['status'] = self::STEP_STATUS_AVAILABLE;
                }
                if (!$isCompleted && $currentStepId === null) {
                    $currentStepId = $stepId;
                }
            } else {
                if ($step['status'] === self::STEP_STATUS_AVAILABLE) {
                    $step['status'] = self::STEP_STATUS_NOT_STARTED;
                }
            }

            if ($isCompleted) {
                $completedRequired++;
            } else {
                $allPriorCompleted = false;
            }
        }
        unset($step);

        $process->steps_data = $steps;
        $process->total_steps_count = $totalRequired;
        $process->completed_steps_count = min($completedRequired, $totalRequired);
        $process->progress_percentage = (int) round(($process->completed_steps_count / $totalRequired) * 100);

        if ($currentStepId) {
            $process->current_step_id = $currentStepId;
        }

        if ($completedRequired >= $totalRequired) {
            $process->status = self::STATUS_COMPLETED;
            if (!$process->completed_at) {
                $process->completed_at = Carbon::now();
            }
            if (!$process->expires_at) {
                $process->expires_at = Carbon::parse($process->completed_at)->addDays(2);
            }
            $process->current_step_id = 'step_7_pdf_export';
        } else {
            if ($process->status === self::STATUS_COMPLETED) {
                $process->status = self::STATUS_IN_PROGRESS;
                $process->completed_at = null;
                $process->expires_at = null;
            }
        }
    }

    private function isStepEligibleForCompletion(WorkflowProcess $process, string $stepId): bool
    {
        $steps = $process->steps_data ?? [];
        $stepIndex = $this->findStepIndex($steps, $stepId);

        if ($stepIndex === -1) {
            return false;
        }

        if ($process->type === self::TYPE_DETAILED_ANSWER) {
            // All prior steps must be completed
            for ($i = 0; $i < $stepIndex; $i++) {
                if ($steps[$i]['status'] !== self::STEP_STATUS_COMPLETED) {
                    return false;
                }
            }
            return true;
        }

        // Summary
        if (in_array($stepId, ['step_0a_notes', 'step_0b_drive'], true)) {
            return true;
        }

        // For steps 1..7, prerequisites 0A and 0B must be satisfied
        $step0a = $this->findStep($steps, 'step_0a_notes');
        $step0b = $this->findStep($steps, 'step_0b_drive');
        if ($step0a['status'] !== self::STEP_STATUS_COMPLETED && empty($step0a['already_satisfied'])) {
            return false;
        }
        if ($step0b['status'] !== self::STEP_STATUS_COMPLETED && empty($step0b['already_satisfied'])) {
            return false;
        }

        // And all previous numbered steps must be completed
        for ($i = 2; $i < $stepIndex; $i++) {
            if ($steps[$i]['status'] !== self::STEP_STATUS_COMPLETED) {
                return false;
            }
        }

        return true;
    }

    private function findStepIndex(array $steps, string $stepId): int
    {
        foreach ($steps as $idx => $step) {
            if ($step['id'] === $stepId) {
                return $idx;
            }
        }
        return -1;
    }

    private function findStep(array $steps, string $stepId): ?array
    {
        foreach ($steps as $step) {
            if ($step['id'] === $stepId) {
                return $step;
            }
        }
        return null;
    }

    /**
     * Initial step specifications for Detailed Answer Generation.
     */
    private function getDetailedAnswerInitialSteps(): array
    {
        return [
            [
                'id' => 'step_1_ocr',
                'number' => 1,
                'title' => 'Mistral: استخراج متن جزوات (OCR)',
                'description' => 'استخراج متن و تبدیل اسناد و جزوات مرجع به فرمت Markdown با Mistral',
                'type' => 'automated_or_prerequisite',
                'status' => self::STEP_STATUS_AVAILABLE,
                'instructions' => 'اسناد و جزوات منبع را برای استخراج به Markdown ارائه دهید. در صورتی که فایل‌ها از قبل به فرمت Markdown هستند یا OCR انجام شده، می‌توانید این پیش‌نیاز را تأیید کنید.',
                'inputs' => ['drive_folder_url' => '', 'already_satisfied' => false],
                'outputs' => ['markdown_files_count' => 0, 'output_ref' => ''],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_2_drive_upload',
                'number' => 2,
                'title' => 'Google Drive: آپلود فایل‌های مبدا',
                'description' => 'آپلود جزوات Markdown و نمونه‌سوالات PDF در پوشه‌های مجزا در گوگل درایو',
                'instructions' => 'جزوات Markdown و PDFهای نمونه‌سوالات را در دو پوشه مجزا در Google Drive آپلود کنید و پیوند پوشه‌ها را ثبت نمایید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['notes_folder_url' => '', 'questions_folder_url' => ''],
                'outputs' => ['confirmed' => false],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_3_engin_questions',
                'number' => 3,
                'title' => 'Engin: استخراج سوالات',
                'description' => 'استخراج سوالات امتحانی با استفاده از پوشه نمونه‌سوالات در Engin',
                'instructions' => 'پیوند پوشه نمونه‌سوالات را وارد کنید و سوالات استخراج‌شده را برای مراحل بعد آماده نمایید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['questions_folder_url' => ''],
                'outputs' => ['extracted_questions_ref' => ''],
                'prompt_template' => "لطفاً تمام سوالات موجود در فایل‌های PDF پوشه نمونه‌سوالات را استخراج کرده و به همراه گزینه‌ها و پاسخ در قالب Markdown ذخیره کنید.",
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_4_topics',
                'number' => 4,
                'title' => 'آماده‌سازی مباحث (شاخه شرطی)',
                'description' => 'انتخاب روش آماده‌سازی مباحث: سرفصل‌های از پیش تعیین‌شده یا استخراج با Engin',
                'instructions' => 'یکی از دو مسیر زیر را انتخاب کنید: مسیر الف (مباحث از قبل مشخص است) یا مسیر ب (استخراج مباحث با Engin از جزوات). فقط شاخه انتخاب‌شده برای تکمیل پروسه الزامی خواهد بود.',
                'type' => 'conditional_branch',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'selected_branch' => null,
                'branch_options' => [
                    [
                        'id' => 'path_a',
                        'title' => 'مسیر الف: مباحث از قبل مشخص است',
                        'description' => 'استفاده از سرفصل‌های آماده (مانند فیزیوپاتولوژی و علوم پایه)',
                    ],
                    [
                        'id' => 'path_b',
                        'title' => 'مسیر ب: استخراج مباحث با Engin',
                        'description' => 'استخراج سرفصل‌ها و مباحث از متن جزوات Markdown با ابزار Engin',
                    ],
                ],
                'inputs' => ['notes_input' => '', 'topics_list' => ''],
                'outputs' => ['confirmed_topics' => ''],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_5_claude_organize',
                'number' => 5,
                'title' => 'Claude: دسته‌بندی سوالات',
                'description' => 'ارسال سوالات استخراج‌شده همراه با پرامپت تهیه شده به Claude برای تفکیک موضوعی',
                'instructions' => 'سوالات استخراج‌شده را همراه با پرامپت زیر به Claude بدهید تا هر سوال بر اساس سرفصل‌های مشخص‌شده مرحله ۴ دسته‌بندی و شماره‌گذاری شود.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'prompt_template' => "شما یک دستیار تخصصی پزشکی هستید. با توجه به سرفصل‌های ارائه شده، تمام سوالات زیر را تفکیک موضوعی کرده و با شماره استاندارد مرتب کنید:\n\n[لیست مباحث مرحله ۴]\n\n[سوالات استخراج شده]",
                'inputs' => ['organized_output_ref' => '', 'notes' => ''],
                'outputs' => ['organized_file' => ''],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_6_drive_organized',
                'number' => 6,
                'title' => 'Google Drive: آپلود سوالات دسته‌بندی‌شده',
                'description' => 'بارگذاری فایل سوالات دسته‌بندی‌شده در پوشه مربوطه در Google Drive',
                'instructions' => 'فایل‌های نهایی سوالات مرتب‌شده را در Google Drive آپلود کنید و پیوند فایل یا پوشه را ثبت کنید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['organized_folder_url' => ''],
                'outputs' => ['confirmed' => false],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_7_notebook_create',
                'number' => 7,
                'title' => 'NotebookLM: ایجاد نوت‌بوک',
                'description' => 'ساخت نوت‌بوک جدید در NotebookLM با افزودن جزوات منبع و سوالات دسته‌بندی‌شده',
                'instructions' => 'وارد سرویس Google NotebookLM شوید، یک نوت‌بوک جدید بسازید و جزوات Markdown منبع به همراه سوالات دسته‌بندی‌شده را به عنوان Sources اضافه کنید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['notebook_url' => ''],
                'outputs' => ['sources_count' => 0],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_8_notebook_start',
                'number' => 8,
                'title' => 'NotebookLM: اجرای نوت‌بوک',
                'description' => 'اجرای فرآیند پاسخ‌دهی در نوت‌بوک با پرامپت‌های تنظیم‌شده',
                'instructions' => 'پرامپت استخراج پاسخ تشریحی را در چت نوت‌بوک ارسال کنید تا به ترتیب برای هر سوال بر مبنای جزوات، پاسخ تشریحی جامع تولید شود.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'prompt_template' => "بر مبنای دقیق منابع ضمیمه شده، برای سوالات ضمیمه شده پاسخ تشریحی کامل، شامل چرایی درستی گزینه صحیح و رد گزینه‌های غلط تهیه نمایید.",
                'inputs' => ['execution_notes' => ''],
                'outputs' => ['confirmed' => false],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_9_notebook_answers',
                'number' => 9,
                'title' => 'استخراج پاسخ‌های NotebookLM',
                'description' => 'دریافت فایل خروجی متنی (TXT) حاوی پاسخ‌های تولید شده توسط NotebookLM',
                'instructions' => 'پاسخ‌های خروجی از نوت‌بوک را دانلود کرده یا متن آن را در قالب یک فایل TXT منسجم ذخیره و آپلود کنید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['answers_file_ref' => '', 'content' => ''],
                'outputs' => ['download_url' => ''],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_10_claude_final',
                'number' => 10,
                'title' => 'Claude: پردازش نهایی پاسخ تشریحی',
                'description' => 'تلفیق فایل پاسخ‌های NotebookLM با سوالات دسته‌بندی‌شده اولیه در Claude بر اساس پرامپت استاندارد',
                'instructions' => 'فایل پاسخ‌های TXT مرحله ۹ را به همراه سوالات مرتب‌شده مرحله ۵ به Claude بدهید تا ویرایش نهایی، ساختار نگارشی و قالب‌بندی انجام شود.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'prompt_template' => "لطفاً فایل سوالات اصلی و پاسخ‌های تولید شده را ادغام کرده و یک سند نهایی یکپارچه به صورت Markdown با عنوان، سوال، گزینه‌ها و پاسخ تشریحی مرتب تهیه کنید.",
                'inputs' => ['final_answers_ref' => ''],
                'outputs' => ['result_file' => ''],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_11_website_upload',
                'number' => 11,
                'title' => 'آپلود در وب‌سایت',
                'description' => 'انتشار محتوای پاسخ‌های تشریحی نهایی در وب‌سایت WePass',
                'instructions' => 'محتوای پردازش‌شده نهایی را در بخش مدیریت آزمون‌های وب‌سایت WePass آپلود کنید و پیوند انتشار را ثبت نمایید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['website_post_url' => '', 'upload_reference' => ''],
                'outputs' => ['published' => false],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_12_image_review',
                'number' => 12,
                'title' => 'بازبینی سوالات دارای تصویر',
                'description' => 'بررسی نهایی سوالات تصویردار و تصحیح شکل‌ها و نمودارها',
                'instructions' => 'تمام سوالاتی که دارای تصویر، نمودار یا عکس‌های پاتولوژی/رادیولوژی بوده‌اند را بازبینی کرده و از صحت تطابق تصویر با پاسخ تشریحی اطمینان حاصل کنید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['review_notes' => '', 'reviewed_images_count' => 0],
                'outputs' => ['review_completed' => false],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
        ];
    }

    /**
     * Initial step specifications for Summary Generation.
     */
    private function getSummaryInitialSteps(): array
    {
        return [
            [
                'id' => 'step_0a_notes',
                'number' => '0A',
                'title' => 'پیش‌نیاز: آماده‌سازی جزوات با Mistral',
                'description' => 'تبدیل جزوات به Markdown در صورت نیاز (اگر از قبل آماده است، رد شود)',
                'instructions' => 'اگر جزوات از قبل به فرمت Markdown تبدیل نشده‌اند، آن‌ها را استخراج کنید. در غیر این صورت گزینه «از قبل آماده است» را علامت بزنید.',
                'type' => 'prerequisite',
                'status' => self::STEP_STATUS_AVAILABLE,
                'already_satisfied' => false,
                'inputs' => ['drive_folder_url' => ''],
                'outputs' => [],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_0b_drive',
                'number' => '0B',
                'title' => 'پیش‌نیاز: آماده‌سازی پوشه فایل‌ها در گوگل درایو',
                'description' => 'بارگذاری جزوات منبع در Google Drive (اگر موجود است، پیوند ثبت شود)',
                'instructions' => 'اطمینان حاصل کنید که فایل‌های جزوه در Google Drive در دسترس هستند. در صورت وجود، پیوند پوشه را درج نمایید.',
                'type' => 'prerequisite',
                'status' => self::STEP_STATUS_AVAILABLE,
                'already_satisfied' => false,
                'inputs' => ['notes_drive_url' => ''],
                'outputs' => [],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_1_upload_answers',
                'number' => 1,
                'title' => 'Google Drive: آپلود پاسخ‌های تشریحی',
                'description' => 'بارگذاری فایل پاسخ‌های تشریحی مورد نیاز برای ساخت خلاصه در گوگل درایو',
                'instructions' => 'فایل‌های پاسخ تشریحی جامع تهیه شده را در پوشه مربوطه در Google Drive آپلود کنید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['answers_drive_url' => ''],
                'outputs' => ['confirmed' => false],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_2_notebook_prompts',
                'number' => 2,
                'title' => 'NotebookLM: تنظیم پرامپت‌ها و مباحث',
                'description' => 'تطبیق کامل ساختار مباحث با سوالات نمونه و تنظیم دقیق پرامپت‌های خلاصه',
                'instructions' => 'این مرحله الزامی است: پرامپت‌های نوت‌بوک را دقیقاً مطابق با سرفصل‌ها و ساختار موضوعی سوالات نمونه تنظیم کنید. ساختار مباحث نباید تفاوت داشته باشد.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'prompt_template' => "با توجه به سرفصل‌های [نام سرفصل‌ها]، از فایل پاسخ‌های تشریحی و جزوات ضمیمه، یک خلاصه فشرده، نموداری و دارای نکات کلیدی امتحانی تولید کنید.",
                'inputs' => ['topic_structure_verified' => false, 'prompts_config' => ''],
                'outputs' => ['confirmed' => false],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_3_merge_answers',
                'number' => 3,
                'title' => 'استخراج و تجمیع پاسخ‌های NotebookLM',
                'description' => 'استخراج خروجی‌های بخش‌های مختلف نوت‌بوک و ادغام آن‌ها در یک سند منسجم',
                'instructions' => 'پاسخ‌های تولیدی NotebookLM برای هر سرفصل را استخراج کرده و به صورت یک فایل واحد Markdown ترکیب کنید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['merged_content_ref' => ''],
                'outputs' => ['merged_file' => ''],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_4_tohtml',
                'number' => 4,
                'title' => 'Engin ToHTML: تولید جزوه نهایی',
                'description' => 'تبدیل فایل متنی خلاصه به HTML ساختاریافته استاندارد با ابزار Engin ToHTML',
                'instructions' => 'فایل تجمیع‌شده را در ابزار Engin ToHTML قرار داده و تبدیل آن به HTML استایل‌دهی شده را آغاز کنید.',
                'type' => 'automated_or_manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['tohtml_job_id' => '', 'html_content_ref' => ''],
                'outputs' => ['html_download_url' => ''],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_5_html_cleanup',
                'number' => 5,
                'title' => 'پاک‌سازی و اصلاح HTML',
                'description' => 'بازبینی برچسب‌ها، فاصله‌ها و فرمت‌بندی کد HTML خلاصه',
                'instructions' => 'کد HTML تولید شده را بازبینی کرده و تگ‌های اضافی، خطاهای فاصله‌گذاری و استایل جدول‌ها و باکس‌های نکته را اصلاح کنید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['clean_html_ref' => ''],
                'outputs' => ['cleaned' => false],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_6_website_upload',
                'number' => 6,
                'title' => 'آپلود در وب‌سایت',
                'description' => 'ثبت و بارگذاری خلاصه نهایی در سایت WePass',
                'instructions' => 'فایل HTML نهایی خلاصه را در سامانه بارگذاری وب‌سایت WePass آپلود کرده و از نمایش صحیح آن اطمینان حاصل کنید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['website_summary_url' => ''],
                'outputs' => ['published' => false],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
            [
                'id' => 'step_7_pdf_export',
                'number' => 7,
                'title' => 'تولید و آپلود نسخه PDF',
                'description' => 'ساخت خروجی PDF بهینه از جزوه خلاصه و بارگذاری نهایی',
                'instructions' => 'از جزوه خلاصه یک فایل PDF باکیفیت و با فهرست تعاملی تولید کرده و در سایت WePass بارگذاری نمایید.',
                'type' => 'manual',
                'status' => self::STEP_STATUS_NOT_STARTED,
                'inputs' => ['pdf_url' => '', 'file_ref' => ''],
                'outputs' => ['pdf_completed' => false],
                'started_at' => null,
                'completed_at' => null,
                'error' => null,
            ],
        ];
    }
}
