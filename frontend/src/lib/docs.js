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

// Turns a chat message's Markdown-ish text into a real .docx Blob — headings,
// bullet lists, fenced code blocks (monospace), and **bold**/*italic* runs all
// carry over; anything fancier (tables, links) just falls back to a plain paragraph.
export async function markdownToDocxBlob(text) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');

  const HEADING_LEVELS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3];

  function inlineRuns(line) {
    const runs = [];
    const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let last = 0;
    let match;
    while ((match = re.exec(line))) {
      if (match.index > last) runs.push(new TextRun(line.slice(last, match.index)));
      if (match[2] !== undefined) runs.push(new TextRun({ text: match[2], bold: true }));
      else if (match[3] !== undefined) runs.push(new TextRun({ text: match[3], italics: true }));
      else if (match[4] !== undefined) runs.push(new TextRun({ text: match[4], font: 'Consolas' }));
      last = re.lastIndex;
    }
    if (last < line.length) runs.push(new TextRun(line.slice(last)));
    return runs.length ? runs : [new TextRun('')];
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
