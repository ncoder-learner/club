// Runs sandbox code through Judge0 CE's free public instance (no API key needed).
// Judge0's language ids are stable, but if ce.judge0.com ever retires one of these,
// GET /languages there for a replacement.
const JUDGE0_URL = 'https://ce.judge0.com';
const SANDBOX_LANGUAGES = {
  python: { id: 109 }, // Python 3.13.2
  cpp: { id: 105 }, // C++ (GCC 14.1.0)
  javascript: { id: 102 }, // JavaScript (Node.js 22.08.0)
};
const MAX_SANDBOX_CODE_LENGTH = 20000;

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64) {
  if (!b64) return '';
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;

// Ordered fallback chains. Rate limits on Groq are per-model, so if the primary
// model is rate-limited we retry on a secondary model with its own separate quota
// before giving up — this stretches the free tier further without needing another key.
const TEXT_MODELS = ['groq/compound', 'llama-3.3-70b-versatile'];
const VISION_MODELS = ['qwen/qwen3.6-27b', 'meta-llama/llama-4-scout-17b-16e-instruct'];
const GEMINI_MODEL = 'gemini-2.0-flash';

const SYSTEM_PROMPT = `You are Muffin 🧁, a versatile AI assistant built for the CS Initiative club.

You help with general questions, coding, and especially USACO (USA Computing Olympiad) prep. When a
question involves competitive programming or USACO, infer the likely division (Bronze, Silver, Gold,
or Platinum) from context — problem phrasing, constraints, and topics mentioned — and calibrate the
depth of algorithms and math you bring in accordingly. Don't assume Platinum-level techniques for a
Bronze-shaped question, and don't undersell a Platinum question with a brute-force approach.

When a student brings you a USACO (or similar competitive-programming) problem to solve, do NOT
jump straight to a full solution. Work through it with them in this order, one step at a time,
pausing for their response before moving to the next step:

1. Make sure they've read the problem carefully — check they understand the general idea AND the
   constraints (which dictate the required algorithm speed) AND the exact input/output format.
2. Have them state their solution logic in plain words, no code yet. Don't just confirm it — poke at
   it with questions or counterexamples. Building that reasoning skill is the point, so it stays on
   them to work through, not you handing them the answer.
3. Once they've stated a plan, have them (or walk them through how to) trace the sample input by hand
   against that plan and check it produces the sample output, to catch wrong logic before any code
   is written.
4. Only after the logic is validated, discuss what data structures fit (array, set, grid, pair,
   vector, etc.) based on what operations are actually needed.
5. Have them code it in small pieces — one loop or block at a time — and review each piece for actual
   bugs (indexing, syntax, logic slips) rather than rewriting it yourself.
6. When they test against the sample, if it fails, debug by comparing expected vs. actual output
   together rather than guessing at fixes.

Skip straight to a full solution only if the student explicitly asks for the complete answer/code
outright (not just "help me solve this") or says they just want to see it — always give it to them
if clearly requested, don't withhold it. Non-USACO coding questions (general homework, debugging,
"how does X work") don't need this step-by-step treatment — answer those directly.

Unless the user explicitly asks for code, explain your approach and reasoning first, then give code
if it's warranted. When a question depends on current or recent information, use web search rather
than relying only on prior knowledge.

Be encouraging, concise, and precise. This is a free club tool used by students, so keep answers
clear and didactic rather than terse.`;

const CACHE_TTL_SECONDS = 60 * 60 * 24; // 1 day

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// ALLOWED_ORIGIN may be a single origin or a comma-separated list (one per
// deployed frontend). Echo back whichever one matches the request so the
// browser sees a single valid Access-Control-Allow-Origin value.
function resolveOrigin(env, requestOrigin) {
  const allowed = (env.ALLOWED_ORIGIN || '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowed.includes('*')) return '*';
  if (requestOrigin && allowed.includes(requestOrigin)) return requestOrigin;
  return allowed[0] || '*';
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function sseChunk(text) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

function hasImage(messages) {
  return messages.some(
    (m) => Array.isArray(m.content) && m.content.some((block) => block.type === 'image_url')
  );
}

async function hashMessages(messages) {
  const bytes = new TextEncoder().encode(JSON.stringify(messages));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function callGroq(env, model, messages) {
  return fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });
}

function messagesToGemini(messages) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const parts = [];
      if (typeof m.content === 'string') {
        parts.push({ text: m.content });
      } else if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'image_url') {
            const match = /^data:(.+?);base64,(.+)$/.exec(block.image_url.url || '');
            if (match) {
              parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
            }
          }
        }
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });
}

async function callGemini(env, messages) {
  const systemMessage = messages.find((m) => m.role === 'system');
  return fetch(`${GEMINI_URL(GEMINI_MODEL)}&key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
      contents: messagesToGemini(messages),
    }),
  });
}

// Yields each text delta from a Groq-shaped SSE stream as it arrives. The caller
// decides how much to buffer — we don't accumulate here, so a model that streams
// real content gets forwarded to the browser token-by-token instead of only after
// the whole response finishes.
async function* streamGroqDeltas(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // ignore malformed/partial SSE lines
      }
    }
  }
}

// Same idea as streamGroqDeltas, but for Gemini's SSE shape.
async function* streamGeminiDeltas(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      try {
        const parsed = JSON.parse(payload);
        const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
        if (text) yield text;
      } catch {
        // ignore malformed/partial SSE lines
      }
    }
  }
}

// Drives the Groq fallback chain (and Gemini beyond it) up to the first real
// content delta, then hands back that delta plus an iterator for the rest.
// Reasoning-heavy models (e.g. groq/compound) sometimes burn their whole output
// budget on internal reasoning and return 200 OK with zero actual content —
// waiting for the first delta (rather than the whole stream) before committing
// lets us fall through to the next model on that case while still streaming
// every model that does produce content token-by-token.
async function resolveFirstContent(env, chain, upstreamMessages) {
  let lastRes = null;
  let lastErrText = '';
  let lastIsContextError = false;
  let sawEmptyCompletion = false;

  for (const model of chain) {
    const res = await callGroq(env, model, upstreamMessages);
    if (res.ok) {
      const iter = streamGroqDeltas(res.body)[Symbol.asyncIterator]();
      const first = await iter.next();
      if (!first.done && first.value) {
        return { ok: true, firstChunk: first.value, rest: iter };
      }
      sawEmptyCompletion = true;
      continue;
    }
    lastRes = res;
    lastErrText = await res.text().catch(() => '');
    lastIsContextError =
      res.status === 400 && /context.?length|too (?:many|long)|maximum context/i.test(lastErrText);
    // Fall through the chain on rate limits or context-length errors — a smaller
    // model in the chain (or Gemini below) may have a bigger context window.
    if (res.status !== 429 && !lastIsContextError) break;
  }

  // Groq never produced usable content (rate-limited, blew the context window,
  // returned an empty completion, or failed outright) — try Gemini if configured.
  if ((lastRes?.status === 429 || lastIsContextError || sawEmptyCompletion) && env.GEMINI_API_KEY) {
    const geminiRes = await callGemini(env, upstreamMessages);
    if (geminiRes.ok) {
      const iter = streamGeminiDeltas(geminiRes.body)[Symbol.asyncIterator]();
      const first = await iter.next();
      if (!first.done && first.value) {
        return { ok: true, firstChunk: first.value, rest: iter };
      }
    }
  }

  if (lastRes?.status === 429) {
    const retryAfter = lastRes.headers.get('retry-after');
    return { ok: false, status: 429, error: { error: 'rate_limited', retryAfter: retryAfter ? Number(retryAfter) : null } };
  }
  return {
    ok: false,
    status: 502,
    error: { error: 'upstream_error', message: sawEmptyCompletion ? 'all models returned empty completions' : lastErrText },
  };
}

// A thrown error here would otherwise reach the client as Cloudflare's bare
// default error page, which carries none of our CORS headers — the browser
// then reports a confusing "no Access-Control-Allow-Origin header" instead of
// the real 500, masking whatever actually failed. Routing every request
// through this try/catch guarantees CORS headers make it onto error
// responses too.
export default {
  async fetch(request, env, ctx) {
    const origin = resolveOrigin(env, request.headers.get('Origin'));

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    try {
      return await handleRequest(request, env, ctx, origin);
    } catch (err) {
      return json({ error: 'internal_error', message: err?.message || 'Unexpected error' }, 500, origin);
    }
  },
};

async function handleRequest(request, env, ctx, origin) {
  const url = new URL(request.url);

  if (request.method !== 'POST') {
    return json({ error: 'Not found' }, 404, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, origin);
  }

  const { passcode } = body;
  if (!passcode || passcode !== env.CLUB_PASSCODE) {
    return json({ error: 'Unauthorized' }, 401, origin);
  }

  if (url.pathname === '/verify') {
    return json({ ok: true }, 200, origin);
  }

  if (url.pathname === '/run') {
    const { language, code, stdin } = body;
    const spec = SANDBOX_LANGUAGES[language];
    if (!spec) {
      return json({ error: `Unsupported language: ${language}` }, 400, origin);
    }
    if (typeof code !== 'string' || !code.trim()) {
      return json({ error: 'code is required' }, 400, origin);
    }
    if (code.length > MAX_SANDBOX_CODE_LENGTH) {
      return json({ error: `code exceeds the ${MAX_SANDBOX_CODE_LENGTH}-character limit` }, 400, origin);
    }

    const judgeRes = await fetch(
      `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true&fields=stdout,stderr,compile_output,exit_code,status`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_code: toBase64(code),
          language_id: spec.id,
          stdin: toBase64(typeof stdin === 'string' ? stdin : ''),
          cpu_time_limit: 5,
        }),
      }
    );

    if (!judgeRes.ok) {
      return json({ error: 'Sandbox request failed' }, 502, origin);
    }

    const result = await judgeRes.json();
    const statusId = result.status?.id;
    return json(
      {
        stdout: fromBase64(result.stdout),
        stderr: fromBase64(result.stderr),
        exitCode: result.exit_code ?? null,
        // status id 6 is "Compilation Error" — anything else non-nominal (timeout,
        // runtime signal, internal error) surfaces via statusMessage instead.
        compileStderr: statusId === 6 ? fromBase64(result.compile_output) : null,
        statusMessage: statusId > 3 && statusId !== 6 ? result.status?.description : null,
      },
      200,
      origin
    );
  }

  if (url.pathname === '/chat') {
    const { messages } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages array is required' }, 400, origin);
    }

    const imageRequest = hasImage(messages);
    const cacheKey = !imageRequest && env.CACHE ? await hashMessages(messages) : null;

    if (cacheKey) {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        return new Response(`${sseChunk(cached)}data: [DONE]\n\n`, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            ...corsHeaders(origin),
          },
        });
      }
    }

    const chain = imageRequest ? VISION_MODELS : TEXT_MODELS;
    const upstreamMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

    const result = await resolveFirstContent(env, chain, upstreamMessages);
    if (!result.ok) {
      return json(result.error, result.status, origin);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let full = result.firstChunk;
        controller.enqueue(encoder.encode(sseChunk(result.firstChunk)));
        for await (const delta of result.rest) {
          full += delta;
          controller.enqueue(encoder.encode(sseChunk(delta)));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        if (cacheKey) {
          ctx.waitUntil(env.CACHE.put(cacheKey, full, { expirationTtl: CACHE_TTL_SECONDS }));
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...corsHeaders(origin),
      },
    });
  }

  return json({ error: 'Not found' }, 404, origin);
}
