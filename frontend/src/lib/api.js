const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://127.0.0.1:8787';

export class AuthError extends Error {}
export class RateLimitError extends Error {
  constructor(retryAfter) {
    super('Muffin is rate-limited right now.');
    this.retryAfter = retryAfter;
  }
}
export class UpstreamError extends Error {}

function toApiMessage(message) {
  const hasAttachments = (message.images?.length ?? 0) > 0 || (message.files?.length ?? 0) > 0;

  let text = message.text ?? '';
  if (message.files?.length) {
    const fileBlocks = message.files
      .map((f) => `\n\nFile: ${f.name}\n\`\`\`\n${f.text}\n\`\`\``)
      .join('');
    text += fileBlocks;
  }

  if (!hasAttachments || !message.images?.length) {
    return { role: message.role, content: text };
  }

  const content = [{ type: 'text', text }];
  for (const img of message.images) {
    content.push({ type: 'image_url', image_url: { url: img.dataUrl } });
  }
  return { role: message.role, content };
}

export async function verifyPasscode(passcode) {
  const res = await fetch(`${WORKER_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode }),
  });
  return res.ok;
}

export async function runCode({ language, code, stdin, passcode }) {
  const res = await fetch(`${WORKER_URL}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode, language, code, stdin }),
  });
  await raiseForStatus(res);
  return res.json();
}

async function raiseForStatus(res) {
  if (res.status === 401) throw new AuthError('Incorrect passcode.');
  if (res.status === 429) {
    const data = await res.json().catch(() => ({}));
    throw new RateLimitError(data.retryAfter ?? null);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new UpstreamError(data.message || `Request failed with status ${res.status}`);
  }
}

// Streams a chat completion, calling onDelta(textChunk) as tokens arrive.
// Returns the full assembled reply text.
export async function streamChat({ messages, passcode, onDelta, signal }) {
  const res = await fetch(`${WORKER_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      passcode,
      messages: messages.map(toApiMessage),
    }),
    signal,
  });

  await raiseForStatus(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep the last (possibly partial) line for the next chunk

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta?.(delta, full);
        }
      } catch {
        // ignore malformed/partial SSE lines
      }
    }
  }

  return full;
}
