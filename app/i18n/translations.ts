export type Language = "fa" | "en";
export type Direction = "rtl" | "ltr";

export interface PromptMetaTranslation {
  title: string;
  preview: string;
}

export const PROMPT_TRANSLATIONS: Record<Language, Record<string, PromptMetaTranslation>> = {
  fa: {
    "question-range": {
      title: "تحلیل سؤالات (مبتنی بر بازه)",
      preview: "تحلیل بازه‌های مشخصی از سؤالات شامل متن سؤال، تحلیل گزینه‌ها و خلاصه مفاهیم.",
    },
    "question-order": {
      title: "تحلیل سؤالات (مبتنی بر ترتیب)",
      preview: "بررسی دسته‌به‌دسته متن سؤالات، تحلیل گزینه‌ها و بررسی گزینه‌های انحرافی.",
    },
    "jozve-condensed": {
      title: "جزوه - نسخه ۲",
      preview: "خلاصه‌سازی بدون افت دانش پزشکی به یادداشت‌های ساختاریافته برای هر مبحث.",
    },
    "jozve-full": {
      title: "جزوه - جامع مبحث‌محور",
      preview: "خلاصه‌سازی عمیق بدون افت بر اساس سرفصل‌های مبحث و اولویت‌های امتحانی.",
    },
    "jozve-physiopath-test": {
      title: "جزوه - آزمون فیزیوپاتولوژی",
      preview: "خلاصه‌سازی عمیق بدون افت سازمان‌یافته بر اساس سرفصل‌ها و اولویت‌های آزمون.",
    },
    "jozve-detailed": {
      title: "جزوه - مبحث‌محور با جزئیات کامل",
      preview: "خلاصه‌سازی عمیق بدون افت سازمان‌یافته بر اساس سرفصل‌های موضوعی و اولویت‌های آزمون.",
    },
    "jozve-night-before": {
      title: "جزوه - خلاصه شب امتحان",
      preview: "خلاصه مرور سریع با تمرکز بر نکات کلیدی آزمون، هشدارهای اشتباهات متداول و تله‌ها.",
    },
  },
  en: {
    "question-range": {
      title: "Question Analysis (Range Based)",
      preview: "Analyze specific question ranges with stem, option breakdown, and concept summaries.",
    },
    "question-order": {
      title: "Question Analysis (Order Based)",
      preview: "Batch-by-batch question stem verification, option analysis, and distractor checks.",
    },
    "jozve-condensed": {
      title: "Jozve - (V2)",
      preview: "Lossless medical knowledge compression into structured study notes for topic.",
    },
    "jozve-full": {
      title: "Jozve - Topic Based full",
      preview: "In-depth lossless compression organized by topic headings and exam priorities.",
    },
    "jozve-physiopath-test": {
      title: "Jozve - PhysioPath Test",
      preview: "In-depth lossless compression organized by topic headings and exam priorities.",
    },
    "jozve-detailed": {
      title: "Jozve - Topic Based Detailed",
      preview: "In-depth lossless compression organized by topic headings and exam priorities.",
    },
    "jozve-night-before": {
      title: "Jozve - Night-Before-Exam Summary",
      preview: "Rapid revision summary focusing on core exam points, confusion alerts, and traps.",
    },
  },
};

// Map original preset titles (case-insensitive) to localized titles
export const PROMPT_TITLE_MAP: Record<string, Record<Language, string>> = {
  "question analysis (range based)": {
    fa: "تحلیل سؤالات (مبتنی بر بازه)",
    en: "Question Analysis (Range Based)",
  },
  "question analysis (order based)": {
    fa: "تحلیل سؤالات (مبتنی بر ترتیب)",
    en: "Question Analysis (Order Based)",
  },
  "jozve - (v2)": {
    fa: "جزوه - نسخه ۲",
    en: "Jozve - (V2)",
  },
  "jozve - topic based full": {
    fa: "جزوه - جامع مبحث‌محور",
    en: "Jozve - Topic Based full",
  },
  "jozve - physiopath test": {
    fa: "جزوه - آزمون فیزیوپاتولوژی",
    en: "Jozve - PhysioPath Test",
  },
  "jozve - topic based detailed": {
    fa: "جزوه - مبحث‌محور با جزئیات کامل",
    en: "Jozve - Topic Based Detailed",
  },
  "jozve - night-before-exam summary": {
    fa: "جزوه - خلاصه شب امتحان",
    en: "Jozve - Night-Before-Exam Summary",
  },
};

export function getLocalizedPromptTitle(presetIdOrTitle: string, lang: Language): string {
  if (!presetIdOrTitle) return "";
  // Check by preset id
  const byId = PROMPT_TRANSLATIONS[lang]?.[presetIdOrTitle]?.title;
  if (byId) return byId;

  // Check by English title
  const byTitle = PROMPT_TITLE_MAP[presetIdOrTitle.toLowerCase()]?.[lang];
  if (byTitle) return byTitle;

  // Fallback safely to original title string
  return presetIdOrTitle;
}

export function getLocalizedPromptPreview(presetId: string, lang: Language, fallbackPreview = ""): string {
  if (!presetId) return fallbackPreview;
  const byId = PROMPT_TRANSLATIONS[lang]?.[presetId]?.preview;
  return byId || fallbackPreview;
}

export const translations = {
  fa: {
    // Common & UI Elements
    common: {
      persian: "فارسی",
      english: "English",
      selectLanguage: "انتخاب زبان",
      lightMode: "☀️ حالت روشن",
      darkMode: "🌙 حالت تاریک",
      toggleTheme: "تغییر حالت تیره / روشن",
      refresh: "تازه‌سازی داده‌ها",
      copy: "کپی",
      copied: "✓ کپی شد",
      resend: "ارسال مجدد",
      retry: "تلاش مجدد",
      cancel: "انصراف",
      close: "بستن",
      viewDetails: "مشاهده جزئیات",
      actions: "عملیات",
      status: "وضعیت",
      createdAt: "زمان ایجاد",
      download: "دانلود",
      loading: "در حال بارگذاری...",
      submitting: "در حال ارسال...",
      starting: "در حال شروع...",
      all: "همه",
      total: "کل",
      completed: "تکمیل‌شده",
      processing: "در حال پردازش",
      queued: "در صف انتظار",
      failed: "ناموفق",
      pending: "در انتظار",
      success: "موفق",
      error: "خطا",
      unknownError: "خطای ناشناخته رخ داده است.",
      noData: "داده‌ای یافت نشد.",
    },

    // NotebookLM Dashboard
    notebookLM: {
      pageTitle: "داشبورد WePass NotebookLM",
      pageDescription: "مدیریت اجرای پرامپت، تحلیل سؤالات و خلاصه‌سازی یادداشت‌ها با NotebookLM",
      totalJobs: "کل وظایف",
      processingJobs: "در حال پردازش",
      completedJobs: "تکمیل‌شده",
      failedJobs: "ناموفق",

      // Mode Selection
      selectMode: "انتخاب حالت اجرا",
      questionMode: "❓ حالت سؤالات",
      questionModeTag: "سؤالات",
      jozveMode: "📚 حالت جزوه",
      jozveModeTag: "یادداشت‌ها",

      // Form Labels & Placeholders
      notebookUrl: "آدرس نوت‌بوک *",
      notebookUrlPlaceholder: "https://notebooklm.google.com/notebook/...",
      subject: "مبحث / درس *",
      subjectPlaceholder: "مثلاً آناتومی، پاتولوژی، فیزیولوژی",
      responseFolder: "نام پوشه ذخیره پاسخ‌ها *",
      responseFolderPlaceholder: "مثلاً آناتومی - قفسه سینه، آناتومی - فصل ۱",
      selectPromptPreset: "انتخاب پرامپت پیش‌فرض *",
      customizePrompt: "سفارشی‌سازی متن پرامپت برای این اجرا",
      resetPrompt: "بازگردانی به قالب اولیه",

      // Question Mode Parameters
      questionModeParams: "تنظیمات حالت سؤالات",
      totalQuestionsLength: "تعداد کل سؤالات",
      batchSize: "تعداد در هر دسته",
      startPoint: "نقطه شروع (شماره اولین سؤال)",
      totalBatches: "تعداد کل دسته‌ها:",
      batchesUnit: "دسته",
      questionsRange: "سؤالات {start} تا {end}",

      // Jozve Mode Parameters
      jozveModeParams: "مباحث و سرفصل‌ها (حالت جزوه) *",
      topicsCount: "تعداد:",
      newTopicPlaceholder: "عنوان مبحث جدید را وارد کرده و Enter را بزنید...",
      addTopic: "افزودن",
      noTopics: "هنوز مبحثی اضافه نشده است.",

      // Validations
      errNotebookUrlRequired: "آدرس نوت‌بوک الزامی است",
      errSubjectRequired: "عنوان مبحث / درس الزامی است",
      errFolderRequired: "نام پوشه ذخیره پاسخ‌ها الزامی است",
      errPromptRequired: "انتخاب پرامپت الزامی است",
      errTopicsRequired: "برای حالت جزوه حداقل یک مبحث لازم است",
      errQuestionsLengthRequired: "تعداد کل سؤالات الزامی است",
      errQuestionsLengthPositive: "تعداد کل سؤالات باید یک عدد صحیح مثبت (۱ یا بیشتر) باشد",
      errStartpointPositive: "نقطه شروع باید یک عدد صحیح مثبت (۱ یا بیشتر) باشد",
      errSubmitFailed: "شروع درخواست با خطا مواجه شد",

      // Submit Button
      startExecution: "🚀 شروع اجرای NotebookLM",
      submittingRequest: "در حال ارسال درخواست...",

      // Standalone Answer Extraction Card
      extractCardTitle: "استخراج پاسخ‌های NotebookLM",
      extractCardDescription: "استخراج تمام پاسخ‌های موجود از نوت‌بوک NotebookLM و ادغام در فایل متنی txt.",
      extractUrlPlaceholder: "https://notebooklm.google.com/notebook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      extractBtn: "📑 استخراج و ادغام پاسخ‌ها",
      extractingBtn: "در حال استخراج و ادغام پاسخ‌ها...",
      extractStatusCompleted: "تکمیل شد",
      responsesExtracted: "پاسخ‌های استخراج‌شده:",
      downloadAnswersTxt: "⬇ دانلود فایل ادغام‌شده answers.txt",
      noResponsesFound: "هیچ پاسخی در این نوت‌بوک NotebookLM یافت نشد.",

      // Right Column: Output Viewer
      activeOutputTitle: "📄 خروجی فعال و نمایش پاسخ",
      copyResponse: "📋 کپی متن پاسخ",
      batchProgress: "پیشرفت دسته‌ها:",
      metadataSubject: "مبحث:",
      metadataFolder: "پوشه:",
      metadataMode: "حالت:",
      metadataCreatedAt: "زمان ایجاد:",
      executionError: "❌ خطای اجرا:",
      retryJob: "🔄 تلاش مجدد",
      promptsList: "📋 پرامپت‌ها",
      promptsCompleted: "تکمیل‌شده",
      promptsFailed: "ناموفق",
      promptQuestion: "سؤال:",
      promptBatch: "دسته:",
      promptIndex: "اندیس:",
      promptStart: "شروع:",
      promptEnd: "پایان:",
      promptResend: "ارسال مجدد",
      receivingResponse: "در حال دریافت پاسخ از NotebookLM...",
      noResponseRecorded: "هنوز پاسخی ثبت نشده است.",
      noExecutionSelected: "هیچ اجرایی انتخاب نشده است",
      selectPromptOrHistory: "یک پرامپت جدید ارسال کنید یا یکی از سوابق را انتخاب نمایید.",

      // History Table
      executionHistory: "سوابق اجرا",
      executionHistorySubtitle: "سوابق اجرا، وضعیت وظایف و پاسخ‌های دریافت‌شده",
      searchHistoryPlaceholder: "جستجو در عنوان، آدرس یا متن پاسخ...",
      filterAllModes: "همه حالت‌ها",
      filterQuestionMode: "حالت سؤالات",
      filterJozveMode: "حالت جزوه",
      filterAllStatuses: "همه وضعیت‌ها",
      thPromptAndFolder: "عنوان پرامپت و پوشه",
      thMode: "حالت",
      thBatches: "دسته‌ها",
      thStatus: "وضعیت",
      thCreatedAt: "زمان ایجاد",
      thActions: "عملیات",
      noPromptsSent: "هنوز پرامپتی ارسال نشده است",
      noMatchingExecutions: "هیچ اجرایی با فیلترهای انتخابی مطابقت ندارد.",
      mergeResponses: "📄 ادغام پاسخ‌ها",
      mergingResponses: "در حال ادغام...",
      retryMerge: "⚠ تلاش مجدد ادغام",
      downloadMerged: "⬇ دانلود فایل ادغام‌شده",
    },

    // Pipeline / OCR Dashboard (app/page.tsx)
    pipeline: {
      pageTitle: "WePass",
      engineBadge: "موتور پردازش",
      pageDescription: "موتور استخراج متن (OCR) و پردازش اسناد",
      jobPrefix: "وظیفه:",
      filesCount: "فایل",
      folderUrlLabel: "آدرس یا شناسه پوشه گوگل درایو",
      folderUrlPlaceholder: "https://drive.google.com/drive/folders/...",
      runPipeline: "اجرای فرآیند",
      startingPipeline: "در حال شروع...",
      totalFiles: "کل فایل‌ها",
      completedFiles: "تکمیل‌شده",
      processingFiles: "در حال پردازش",
      failedFiles: "ناموفق",
      ocrSuccessRate: "موفقیت OCR",
      avgOcrTime: "میانگین زمان OCR",
      tabDashboard: "داشبورد فایل‌ها",
      tabLogs: "گزارش‌های سیستمی فرآیند",
      searchFiles: "جستجوی فایل‌ها...",
      mergeAndDownload: "ادغام و دانلود",
      mergeConfirmation: "{failedCount} فایل ناموفق بود و نادیده گرفته می‌شود. آیا {successCount} فایل موفق ادغام شوند؟",
      mergeDisabledTooltip: "پس از پایان فرآیند و موفقیت حداقل یک فایل فعال می‌شود",
      downloadTooltip: "دانلود همه نتایج OCR به صورت یک فایل txt ادغام‌شده",
      filterAllStatuses: "همه وضعیت‌ها",
      filterSuccess: "موفق",
      filterProcessing: "در حال پردازش",
      filterFailed: "ناموفق",
      filterPending: "در انتظار",
      filterAllStages: "همه مراحل",
      filterDownload: "دانلود",
      filterUpload: "آپلود",
      filterOcr: "OCR",
      thFileName: "نام فایل",
      thDownload: "دانلود",
      thUpload: "آپلود",
      thOcr: "استخراج OCR",
      thOverallStatus: "وضعیت کلی",
      thAction: "عملیات",
      noActiveJob: "هیچ فرآیند فعالی انتخاب نشده است.",
      noMatchingFiles: "هیچ فایلی با معیارهای فیلتر مطابقت ندارد.",
      downloadOcrTxt: "دانلود",
      searchLogs: "جستجوی پیام‌های گزارش...",
      filterAllLevels: "همه سطوح",
      noLogs: "گزارشی ثبت نشده است.",
    },

    // ToHtml Dashboard (app/tohtml/page.tsx)
    tohtml: {
      pageTitle: "WePass ToHtml Engine",
      pageDescription: "خط پردازش بخش‌بندی متن و تبدیل به HTML با DeepSeek",
      uploadTitle: "بارگذاری سند متنی",
      uploadSubtitle: "یک فایل متنی حاوی نشانگرهای برش (Cut Markers) را بارگذاری کنید",
      dropzoneText: "برای بارگذاری کلیک کنید یا فایل txt. را به اینجا بکشید",
      fileLoaded: "فایل بارگذاری شد:",
      sectionsFound: "بخش شناسایی شد",
      chunksEstimated: "قطعه تخمین‌زده شد",
      deepseekPromptTitle: "قالب پرامپت استخراج DeepSeek",
      deepseekPromptDesc: "دستورالعمل سیستمی ساختاردهی HTML که به DeepSeek ارسال می‌شود",
      resetPrompt: "بازگردانی به پرامپت پیش‌فرض",
      startProcessing: "شروع پردازش ToHtml",
      submitting: "در حال ارسال وظیفه...",
      totalSections: "کل بخش‌ها",
      completedSections: "تکمیل‌شده",
      processingSections: "در حال پردازش",
      failedSections: "ناموفق",
      avgDuration: "میانگین زمان",
      tabSections: "داشبورد بخش‌ها",
      tabPreview: "پیش‌نمایش بخش‌ها",
      tabLogs: "گزارش‌های سیستم",
      searchSections: "جستجوی بخش‌ها...",
      thSectionIndex: "شماره",
      thMarker: "نشانگر",
      thContentPreview: "پیش‌نمایش محتوا",
      thLength: "حجم (کاراکتر)",
      thStatus: "وضعیت",
      thOutput: "خروجی",
      thActions: "عملیات",
      inspectSection: "مشاهده",
      retryFailed: "تلاش مجدد بخش‌های ناموفق",
      downloadMergedHtml: "دانلود فایل HTML ادغام‌شده",
      noSectionsMatch: "هیچ بخشی با این فیلتر یافت نشد.",
    },

    // CRUDnoteBook simple page
    crud: {
      notebookUrlPlaceholder: "آدرس نوت‌بوک را وارد کنید",
      submit: "ارسال",
      responsePrefix: "پاسخ بک‌اند: ",
    },
  },

  en: {
    // Common & UI Elements
    common: {
      persian: "فارسی",
      english: "English",
      selectLanguage: "Select Language",
      lightMode: "☀️ Light Mode",
      darkMode: "🌙 Dark Mode",
      toggleTheme: "Toggle Light/Dark Theme",
      refresh: "Refresh Data",
      copy: "Copy",
      copied: "✓ Copied",
      resend: "Resend",
      retry: "Retry",
      cancel: "Cancel",
      close: "Close",
      viewDetails: "View Details",
      actions: "Actions",
      status: "Status",
      createdAt: "Created At",
      download: "Download",
      loading: "Loading...",
      submitting: "Submitting...",
      starting: "Starting...",
      all: "All",
      total: "Total",
      completed: "Completed",
      processing: "Processing",
      queued: "Queued",
      failed: "Failed",
      pending: "Pending",
      success: "Success",
      error: "Error",
      unknownError: "An unknown error occurred.",
      noData: "No data found.",
    },

    // NotebookLM Dashboard
    notebookLM: {
      pageTitle: "WePass NotebookLM Dashboard",
      pageDescription: "Prompt execution management, question analysis, and note synthesis with NotebookLM",
      totalJobs: "Total Jobs",
      processingJobs: "Processing",
      completedJobs: "Completed",
      failedJobs: "Failed",

      // Mode Selection
      selectMode: "Select Execution Mode",
      questionMode: "❓ Question Mode",
      questionModeTag: "Questions",
      jozveMode: "📚 Jozve Mode",
      jozveModeTag: "Notes",

      // Form Labels & Placeholders
      notebookUrl: "Notebook URL *",
      notebookUrlPlaceholder: "https://notebooklm.google.com/notebook/...",
      subject: "Subject *",
      subjectPlaceholder: "e.g. Anatomy, Pathology, Physiology",
      responseFolder: "Response Folder Name *",
      responseFolderPlaceholder: "e.g. Anatomy - Thorax, Anatomy - Chapter 1",
      selectPromptPreset: "Select Prompt Preset *",
      customizePrompt: "Customize Prompt Text for this Run",
      resetPrompt: "Reset to Original Template",

      // Question Mode Parameters
      questionModeParams: "Question Mode Parameters",
      totalQuestionsLength: "Total Questions Length",
      batchSize: "Batch Size",
      startPoint: "Start Point (first question number)",
      totalBatches: "Total Batches:",
      batchesUnit: "batches",
      questionsRange: "Questions {start}–{end}",

      // Jozve Mode Parameters
      jozveModeParams: "Topics & Headings (Jozve Mode) *",
      topicsCount: "Count:",
      newTopicPlaceholder: "Enter new topic title and press Enter...",
      addTopic: "Add",
      noTopics: "No topics added yet.",

      // Validations
      errNotebookUrlRequired: "Notebook URL is required",
      errSubjectRequired: "Subject is required",
      errFolderRequired: "Response folder name is required",
      errPromptRequired: "Prompt selection is required",
      errTopicsRequired: "At least one topic is required for Jozve Mode",
      errQuestionsLengthRequired: "Total questions length is required",
      errQuestionsLengthPositive: "Total questions length must be a positive whole number (1 or greater)",
      errStartpointPositive: "Start point must be a positive whole number (1 or greater)",
      errSubmitFailed: "Failed to start request",

      // Submit Button
      startExecution: "🚀 Start NotebookLM Execution",
      submittingRequest: "Submitting request...",

      // Standalone Answer Extraction Card
      extractCardTitle: "Extract NotebookLM Answers",
      extractCardDescription: "Extract all available answers from an existing NotebookLM notebook and merge into a downloadable .txt file",
      extractUrlPlaceholder: "https://notebooklm.google.com/notebook/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      extractBtn: "📑 Extract & Merge Answers",
      extractingBtn: "Extracting & Merging Answers...",
      extractStatusCompleted: "Completed",
      responsesExtracted: "Responses extracted:",
      downloadAnswersTxt: "⬇ Download merged answers.txt",
      noResponsesFound: "No NotebookLM responses were found in this notebook.",

      // Right Column: Output Viewer
      activeOutputTitle: "📄 Active Output & Response Viewer",
      copyResponse: "📋 Copy Response Text",
      batchProgress: "Batch Progress:",
      metadataSubject: "Subject:",
      metadataFolder: "Folder:",
      metadataMode: "Mode:",
      metadataCreatedAt: "Created At:",
      executionError: "❌ Execution Error:",
      retryJob: "🔄 Retry Job",
      promptsList: "📋 Prompts",
      promptsCompleted: "completed",
      promptsFailed: "failed",
      promptQuestion: "Question:",
      promptBatch: "Batch:",
      promptIndex: "Index:",
      promptStart: "Start:",
      promptEnd: "End:",
      promptResend: "Resend",
      receivingResponse: "Receiving response from NotebookLM...",
      noResponseRecorded: "No response recorded yet.",
      noExecutionSelected: "No Execution Selected",
      selectPromptOrHistory: "Submit a new prompt or select an execution record from history.",

      // History Table
      executionHistory: "Execution History",
      executionHistorySubtitle: "Execution history, job status, and retrieved responses",
      searchHistoryPlaceholder: "Search title, URL, or response text...",
      filterAllModes: "All Modes",
      filterQuestionMode: "Question Mode",
      filterJozveMode: "Jozve Mode",
      filterAllStatuses: "All Statuses",
      thPromptAndFolder: "Prompt Title & Folder",
      thMode: "Mode",
      thBatches: "Batches",
      thStatus: "Status",
      thCreatedAt: "Created At",
      thActions: "Actions",
      noPromptsSent: "No prompts sent yet",
      noMatchingExecutions: "No executions match your filters.",
      mergeResponses: "📄 Merge Responses",
      mergingResponses: "Merging...",
      retryMerge: "⚠ Retry Merge",
      downloadMerged: "⬇ Download Merged",
    },

    // Pipeline / OCR Dashboard (app/page.tsx)
    pipeline: {
      pageTitle: "WePass",
      engineBadge: "Engine",
      pageDescription: "OCR & Document Processing Engine",
      jobPrefix: "Job:",
      filesCount: "files",
      folderUrlLabel: "Google Drive Folder URL / ID",
      folderUrlPlaceholder: "https://drive.google.com/drive/folders/...",
      runPipeline: "Run Pipeline",
      startingPipeline: "Starting...",
      totalFiles: "Total Files",
      completedFiles: "Completed",
      processingFiles: "Processing",
      failedFiles: "Failed",
      ocrSuccessRate: "OCR Success",
      avgOcrTime: "Avg OCR Time",
      tabDashboard: "Files Dashboard",
      tabLogs: "Pipeline System Logs",
      searchFiles: "Search files...",
      mergeAndDownload: "Merge & Download",
      mergeConfirmation: "{failedCount} file(s) failed and will be skipped. Merge the {successCount} successful file(s)?",
      mergeDisabledTooltip: "Available once the job has finished and at least one file succeeded",
      downloadTooltip: "Download all OCR results as one merged .txt file",
      filterAllStatuses: "All Statuses",
      filterSuccess: "Success",
      filterProcessing: "Processing",
      filterFailed: "Failed",
      filterPending: "Pending",
      filterAllStages: "All Stages",
      filterDownload: "Download",
      filterUpload: "Upload",
      filterOcr: "OCR",
      thFileName: "File Name",
      thDownload: "Download",
      thUpload: "Upload",
      thOcr: "OCR Extraction",
      thOverallStatus: "Overall Status",
      thAction: "Action",
      noActiveJob: "No active pipeline job selected.",
      noMatchingFiles: "No files match the selected filter criteria.",
      downloadOcrTxt: "Download",
      searchLogs: "Search log messages...",
      filterAllLevels: "All Levels",
      noLogs: "No logs recorded.",
    },

    // ToHtml Dashboard (app/tohtml/page.tsx)
    tohtml: {
      pageTitle: "WePass ToHtml Engine",
      pageDescription: "Text Sectioning & DeepSeek HTML Processing Pipeline",
      uploadTitle: "Upload Text Document",
      uploadSubtitle: "Upload a structured text file containing Cut Markers",
      dropzoneText: "Click to upload or drag and drop .txt file",
      fileLoaded: "File loaded:",
      sectionsFound: "sections found",
      chunksEstimated: "estimated chunks",
      deepseekPromptTitle: "DeepSeek Extraction Prompt Template",
      deepseekPromptDesc: "System prompt defining the HTML formatting instructions sent to DeepSeek",
      resetPrompt: "Reset to Original Template",
      startProcessing: "Start ToHtml Processing",
      submitting: "Submitting job...",
      totalSections: "Total Sections",
      completedSections: "Completed",
      processingSections: "Processing",
      failedSections: "Failed",
      avgDuration: "Avg Duration",
      tabSections: "Sections Dashboard",
      tabPreview: "Parsed Preview",
      tabLogs: "System Logs",
      searchSections: "Search sections...",
      thSectionIndex: "Index",
      thMarker: "Marker",
      thContentPreview: "Content Preview",
      thLength: "Length (chars)",
      thStatus: "Status",
      thOutput: "Output",
      thActions: "Actions",
      inspectSection: "Inspect",
      retryFailed: "Retry Failed Sections",
      downloadMergedHtml: "Download Merged HTML",
      noSectionsMatch: "No sections match your filter criteria.",
    },

    // CRUDnoteBook simple page
    crud: {
      notebookUrlPlaceholder: "Enter notebook URL",
      submit: "Submit",
      responsePrefix: "Backend response: ",
    },
  },
};

export type TranslationDictionary = typeof translations.fa;
