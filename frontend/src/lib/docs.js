// Both mammoth (docx -> text) and docx (text -> .docx) are sizeable libraries only
// needed occasionally — callers should only invoke these from user-triggered actions
// (a file upload, an export click), never at module load, so the dynamic imports
// here actually defer the cost instead of it happening anyway on first render.

export async function extractDocxText(file) {
  const mammoth = await import('mammoth/mammoth.browser');
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}

const NAMED_COLORS = {
  red: 'FF0000',
  blue: '0000FF',
  green: '008000',
  orange: 'FFA500',
  purple: '800080',
  black: '000000',
  gray: '808080',
  grey: '808080',
  yellow: 'FFD700',
};

function resolveColor(raw) {
  const v = raw.trim().toLowerCase();
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  const hexMatch = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(v);
  if (!hexMatch) return undefined;
  let hex = hexMatch[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return hex.toUpperCase();
}

// Turns a chat message's Markdown-ish text into a real .docx Blob — headings,
// bullet lists, fenced code blocks (monospace), **bold**/*italic* runs, and a
// small amount of inline HTML (<span style="color:...">, <br>) all carry over —
// the model sometimes answers worksheet-style questions with colored spans
// (e.g. "answer in red"), and those need to actually render as colored text in
// the doc, not literal tag text. Anything fancier (tables, links) just falls
// back to a plain paragraph.
export async function markdownToDocxBlob(text) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');

  const HEADING_LEVELS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

  // Recursively parses inline markdown + a small safe subset of HTML into
  // TextRuns, threading `base` (bold/italics/color so far) down through nested
  // spans — e.g. a <span style="color:red"> wrapping **bold** text needs both.
  function inlineRuns(str, base = {}) {
    const runs = [];
    let i = 0;
    while (i < str.length) {
      const rest = str.slice(i);

      const br = /^<br\s*\/?>/i.exec(rest);
      if (br) {
        runs.push(new TextRun({ text: '', break: 1 }));
        i += br[0].length;
        continue;
      }

      const spanOpen = /^<span\s+style="[^"]*color:\s*([^;"]+?)\s*(?:;[^"]*)?">/i.exec(rest);
      if (spanOpen) {
        const openLen = spanOpen[0].length;
        const closeIdx = rest.slice(openLen).search(/<\/span>/i);
        if (closeIdx !== -1) {
          const inner = rest.slice(openLen, openLen + closeIdx);
          const color = resolveColor(spanOpen[1]);
          runs.push(...inlineRuns(inner, color ? { ...base, color } : base));
          i += openLen + closeIdx + '</span>'.length;
          continue;
        }
      }

      const bold = /^\*\*(.+?)\*\*/.exec(rest);
      if (bold) {
        runs.push(...inlineRuns(bold[1], { ...base, bold: true }));
        i += bold[0].length;
        continue;
      }

      const italic = /^\*(.+?)\*/.exec(rest);
      if (italic) {
        runs.push(...inlineRuns(italic[1], { ...base, italics: true }));
        i += italic[0].length;
        continue;
      }

      const code = /^`(.+?)`/.exec(rest);
      if (code) {
        runs.push(new TextRun({ text: code[1], font: 'Consolas', ...base }));
        i += code[0].length;
        continue;
      }

      const nextMarkerOffset = rest.slice(1).search(/<br\s*\/?>|<span\s|\*\*|\*|`/i);
      const end = nextMarkerOffset === -1 ? str.length : i + 1 + nextMarkerOffset;
      runs.push(new TextRun({ text: str.slice(i, end), ...base }));
      i = end;
    }
    return runs.length ? runs : [new TextRun({ text: '', ...base })];
  }

  const paragraphs = [];
  const lines = text.split('\n');
  let inCode = false;
  let codeLines = [];

  const flushCode = () => {
    for (const codeLine of codeLines) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: codeLine || ' ', font: 'Consolas', size: 20 })],
          shading: { fill: 'F0F0F0' },
        })
      );
    }
    codeLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)/.exec(line);
    const bullet = /^[-*]\s+(.*)/.exec(line);

    if (heading) {
      paragraphs.push(
        new Paragraph({ heading: HEADING_LEVELS[heading[1].length - 1], children: inlineRuns(heading[2]) })
      );
    } else if (bullet) {
      paragraphs.push(new Paragraph({ bullet: { level: 0 }, children: inlineRuns(bullet[1]) }));
    } else if (line.trim()) {
      paragraphs.push(new Paragraph({ children: inlineRuns(line) }));
    } else {
      paragraphs.push(new Paragraph({ children: [] }));
    }
  }
  if (inCode) flushCode();

  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(doc);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
