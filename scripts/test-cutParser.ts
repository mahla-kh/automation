import { parseCutSections } from "../server/lib/cutParser";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

console.log("Running CUT Parser Unit Tests...\n");

// 1. Normal consecutive markers
{
  const input = `========================================
CUT 1
========================================

### Question 1
Some question text

========================================
CUT 2
========================================

### Question 2
Another question text`;

  const result = parseCutSections(input);
  assert(result.sections.length === 2, "Test 1: Expected 2 sections");
  assert(result.sections[0].marker === "CUT 1", "Test 1: Marker 1 is CUT 1");
  assert(result.sections[0].content === "### Question 1\nSome question text", "Test 1: Content 1 exact match");
  assert(result.sections[1].marker === "CUT 2", "Test 1: Marker 2 is CUT 2");
  assert(result.sections[1].content === "### Question 2\nAnother question text", "Test 1: Content 2 exact match");
  console.log("✔ Test 1: Normal consecutive markers passed");
}

// 2. Nonconsecutive marker numbers
{
  const input = `CUT 10
Content 10
CUT 2
Content 2
CUT 99
Content 99`;

  const result = parseCutSections(input);
  assert(result.sections.length === 3, "Test 2: Expected 3 sections");
  assert(result.sections[0].marker === "CUT 10" && result.sections[0].markerNumber === 10, "Test 2: First is CUT 10");
  assert(result.sections[1].marker === "CUT 2" && result.sections[1].markerNumber === 2, "Test 2: Second is CUT 2");
  assert(result.sections[2].marker === "CUT 99" && result.sections[2].markerNumber === 99, "Test 2: Third is CUT 99");
  console.log("✔ Test 2: Nonconsecutive marker numbers passed");
}

// 3. Multi-digit marker numbers
{
  const input = `CUT 125
Content 125
CUT 9999
Content 9999`;

  const result = parseCutSections(input);
  assert(result.sections.length === 2, "Test 3: Expected 2 sections");
  assert(result.sections[0].marker === "CUT 125" && result.sections[0].markerNumber === 125, "Test 3: CUT 125");
  assert(result.sections[1].marker === "CUT 9999" && result.sections[1].markerNumber === 9999, "Test 3: CUT 9999");
  console.log("✔ Test 3: Multi-digit marker numbers passed");
}

// 4. Separator lines with varying numbers of `=` characters
{
  const input = `===
CUT 1
===
Content 1
==============
CUT 2
==============
Content 2
CUT 3
Content 3`;

  const result = parseCutSections(input);
  assert(result.sections.length === 3, "Test 4: Expected 3 sections");
  assert(result.sections[0].content === "Content 1", "Test 4: Content 1 match");
  assert(result.sections[1].content === "Content 2", "Test 4: Content 2 match");
  assert(result.sections[2].content === "Content 3", "Test 4: Content 3 match");
  console.log("✔ Test 4: Separator lines with varying numbers of = characters passed");
}

// 5. Markdown tables and horizontal rules inside a section
{
  const input = `========================================
CUT 1
========================================

| Header 1 | Header 2 |
| -------- | -------- |
| Value 1  | Value 2  |

---

More text after horizontal rule
========================================
CUT 2
========================================
Section 2`;

  const result = parseCutSections(input);
  assert(result.sections.length === 2, "Test 5: Expected 2 sections");
  assert(result.sections[0].content.includes("| Header 1 | Header 2 |"), "Test 5: Table preserved");
  assert(result.sections[0].content.includes("---"), "Test 5: Horizontal rule preserved");
  console.log("✔ Test 5: Markdown tables and horizontal rules inside a section passed");
}

// 6. Persian and English mixed content
{
  const input = `========================================
CUT 1
========================================

نوع بیماری | نوع مایع پلور |
| ---------- | ------------- |
| **سندروم نفروتیک** | **ترانسودا (Transudate)** |
| **سل / کانسر ریه / لنفوم** | **اگزودا (Exudate)** |

---

💡 *تمام ۲۰ سؤال (۴۱ تا ۶۰) بر اساس فایل خام سؤالات و منابع و گایدلاینهای آپلودشده ریه، تحلیل و پاسخ داده شدند.*
========================================
CUT 2
========================================

### Question 61`;

  const result = parseCutSections(input);
  assert(result.sections.length === 2, "Test 6: Expected 2 sections");
  assert(result.sections[0].content.includes("سندروم نفروتیک"), "Test 6: Persian text preserved");
  assert(result.sections[0].content.includes("Transudate"), "Test 6: English text preserved");
  assert(result.sections[1].content === "### Question 61", "Test 6: Section 2 content exact match");
  console.log("✔ Test 6: Persian and English mixed content passed");
}

// 7. Content before the first marker (Preamble)
{
  const input = `Header preamble info about exam
Additional introductory note

========================================
CUT 1
========================================
Content 1`;

  const result = parseCutSections(input);
  assert(result.sections.length === 2, "Test 7: Expected 2 sections (Preamble + CUT 1)");
  assert(result.sections[0].marker === "Preamble" && result.sections[0].isPreamble === true, "Test 7: First section is Preamble");
  assert(result.sections[0].content === "Header preamble info about exam\nAdditional introductory note", "Test 7: Preamble text preserved");
  assert(result.hasPreamble === true, "Test 7: hasPreamble flag true");
  assert(result.sections[1].marker === "CUT 1", "Test 7: Second section is CUT 1");
  console.log("✔ Test 7: Content before the first marker passed");
}

// 8. Missing markers
{
  const input = `Just some regular text without any cut markers.
Shortcut 1 is not a marker.
We CUT the paper into pieces.`;

  const result = parseCutSections(input);
  assert(result.sections.length === 0, "Test 8: Expected 0 sections when no valid markers");
  assert(result.warnings.length > 0, "Test 8: Warning emitted for missing markers");
  console.log("✔ Test 8: Missing markers passed");
}

// 9. Empty sections
{
  const input = `CUT 1
========================================
CUT 2
Content for cut 2`;

  const result = parseCutSections(input);
  assert(result.sections.length === 2, "Test 9: Expected 2 sections");
  assert(result.sections[0].marker === "CUT 1" && result.sections[0].content === "", "Test 9: Section 1 is empty string");
  assert(result.sections[1].marker === "CUT 2" && result.sections[1].content === "Content for cut 2", "Test 9: Section 2 has content");
  console.log("✔ Test 9: Empty sections passed");
}

// 10. Correct preservation of original section order
{
  const input = `CUT 5
Five
CUT 1
One
CUT 99
Ninety-nine
CUT 2
Two`;

  const result = parseCutSections(input);
  assert(result.sections.length === 4, "Test 10: Expected 4 sections");
  assert(result.sections[0].markerNumber === 5 && result.sections[0].content === "Five", "Test 10: First is 5");
  assert(result.sections[1].markerNumber === 1 && result.sections[1].content === "One", "Test 10: Second is 1");
  assert(result.sections[2].markerNumber === 99 && result.sections[2].content === "Ninety-nine", "Test 10: Third is 99");
  assert(result.sections[3].markerNumber === 2 && result.sections[3].content === "Two", "Test 10: Fourth is 2");
  console.log("✔ Test 10: Correct preservation of original section order passed");
}

console.log("\nAll 10 parser tests passed successfully! 🎉");
