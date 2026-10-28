/**
 * CUT Section Parser
 * Deterministically splits text into sections based on explicit `CUT n` markers.
 */

export interface ParsedSection {
  index: number;
  marker: string;
  markerNumber: number | null;
  content: string;
  charCount: number;
  isPreamble?: boolean;
}

export interface ParseResult {
  sections: ParsedSection[];
  totalChars: number;
  hasPreamble: boolean;
  warnings: string[];
}

interface DelimiterMatch {
  start: number;
  end: number;
  markerNumber: number;
  markerText: string;
}

export function parseCutSections(rawText: string): ParseResult {
  if (!rawText || typeof rawText !== "string") {
    return {
      sections: [],
      totalChars: 0,
      hasPreamble: false,
      warnings: ["File content is empty or invalid."]
    };
  }

  const warnings: string[] = [];
  const totalChars = rawText.length;

  // Regex to match CUT markers:
  // Optional preceding line of ===
  // CUT <number> on its own line
  // Optional following line of ===
  const cutDelimiterRegex = /(?:^|\r?\n)(?:[ \t]*={3,}[ \t]*\r?\n)?[ \t]*CUT[ \t]+(\d+)[ \t]*(?:\r?\n[ \t]*={3,}[ \t]*)?(?=\r?\n|$)/gi;

  const matches: DelimiterMatch[] = [];
  let match: RegExpExecArray | null;

  while ((match = cutDelimiterRegex.exec(rawText)) !== null) {
    const fullMatch = match[0];
    const markerNumStr = match[1];
    const markerNumber = parseInt(markerNumStr, 10);
    
    // Calculate the start position:
    // If the match starts with a newline (\r?\n), adjust start index so preceding content is not cut short
    let matchStart = match.index;
    if (fullMatch.startsWith("\r\n")) {
      matchStart += 2;
    } else if (fullMatch.startsWith("\n") || fullMatch.startsWith("\r")) {
      matchStart += 1;
    }

    const matchEnd = match.index + fullMatch.length;

    matches.push({
      start: matchStart,
      end: matchEnd,
      markerNumber,
      markerText: `CUT ${markerNumber}`
    });
  }

  if (matches.length === 0) {
    warnings.push("No valid 'CUT n' markers found in the file.");
    return {
      sections: [],
      totalChars,
      hasPreamble: false,
      warnings
    };
  }

  const sections: ParsedSection[] = [];
  let currentIndex = 0;

  // 1. Check for preamble before the first CUT marker
  const firstMatch = matches[0];
  const preambleRaw = rawText.slice(0, firstMatch.start);
  const preambleTrimmed = preambleRaw.trim();

  let hasPreamble = false;
  if (preambleTrimmed.length > 0) {
    hasPreamble = true;
    sections.push({
      index: currentIndex++,
      marker: "Preamble",
      markerNumber: null,
      content: preambleTrimmed,
      charCount: preambleTrimmed.length,
      isPreamble: true
    });
    warnings.push("Non-empty content detected before the first CUT marker and preserved as 'Preamble'.");
  }

  // 2. Extract sections between delimiters
  for (let i = 0; i < matches.length; i++) {
    const currentDelimiter = matches[i];
    const nextDelimiter = matches[i + 1];

    const contentStart = currentDelimiter.end;
    const contentEnd = nextDelimiter ? nextDelimiter.start : rawText.length;

    const rawContent = rawText.slice(contentStart, contentEnd);
    const trimmedContent = rawContent.trim();

    sections.push({
      index: currentIndex++,
      marker: currentDelimiter.markerText,
      markerNumber: currentDelimiter.markerNumber,
      content: trimmedContent,
      charCount: trimmedContent.length,
      isPreamble: false
    });
  }

  return {
    sections,
    totalChars,
    hasPreamble,
    warnings
  };
}
