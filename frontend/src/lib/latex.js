// LLMs commonly emit \( ... \) and \[ ... \] for LaTeX math instead of the
// $ ... $ / $$ ... $$ delimiters remark-math actually recognizes. Normalize them,
// skipping fenced code blocks so real backslash-bracket text in code isn't touched.
export function normalizeLatexDelimiters(text) {
  if (!text) return text;

  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // fenced code block, leave untouched
      return part
        .replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `$$${expr}$$`)
        .replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `$${expr}$`);
    })
    .join('');
}
