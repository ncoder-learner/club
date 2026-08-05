// Runs Python (via Pyodide/WASM) or JavaScript in this worker thread, with a
// genuinely blocking input() — the worker thread can synchronously pause on
// Atomics.wait without freezing the page, since it's off the main thread.
// This requires the page to be cross-origin-isolated (see coi-serviceworker.js);
// the caller only starts this worker after confirming that.

const PYODIDE_VERSION = 'v0.26.4';
importScripts(`https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/pyodide.js`);

let pyodideReady = null;

function getPyodide() {
  if (!pyodideReady) {
    pyodideReady = loadPyodide({
      indexURL: `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`,
    });
  }
  return pyodideReady;
}

// Blocks this worker thread until the main thread writes a line of input into
// the shared buffer and notifies us — this is what makes input() feel like a
// real terminal instead of a pre-filled stdin box. The prompt is sent as its
// own stdout message *before* blocking, rather than relying on the runtime's
// normal stdout path — Pyodide's stdout batches by line, so a prompt with no
// trailing newline (the usual case, e.g. "Name: ") would otherwise never get
// flushed to the terminal until after the read already unblocks.
function blockingReadLine(sab, prompt) {
  if (prompt) postMessage({ type: 'stdout', text: String(prompt) });
  postMessage({ type: 'input_request' });

  const flag = new Int32Array(sab.flag);
  const len = new Int32Array(sab.len);
  const data = new Uint8Array(sab.data);
  Atomics.wait(flag, 0, 0);

  const n = len[0];
  const bytes = data.slice(0, n);
  Atomics.store(flag, 0, 0);
  return new TextDecoder().decode(bytes);
}

async function runPython(code, sab) {
  const pyodide = await getPyodide();
  pyodide.setStdout({ batched: (text) => postMessage({ type: 'stdout', text: text + '\n' }) });
  pyodide.setStderr({ batched: (text) => postMessage({ type: 'stderr', text: text + '\n' }) });
  pyodide.globals.set('_muffin_read_line', (prompt) => blockingReadLine(sab, prompt));

  await pyodide.runPythonAsync(`
import builtins
def _muffin_input(prompt=''):
    return _muffin_read_line(str(prompt) if prompt else '')
builtins.input = _muffin_input
`);

  await pyodide.runPythonAsync(code);
}

function runJavaScript(code, sab) {
  const stringify = (args) => args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const customConsole = {
    log: (...args) => postMessage({ type: 'stdout', text: stringify(args) + '\n' }),
    error: (...args) => postMessage({ type: 'stderr', text: stringify(args) + '\n' }),
    warn: (...args) => postMessage({ type: 'stderr', text: stringify(args) + '\n' }),
  };
  const input = (prompt) => blockingReadLine(sab, prompt);
  // eslint-disable-next-line no-new-func
  const fn = new Function('console', 'input', code);
  fn(customConsole, input);
}

self.onmessage = async (event) => {
  const { type, language, code, sab } = event.data;
  if (type !== 'run') return;
  try {
    if (language === 'python') {
      await runPython(code, sab);
    } else if (language === 'javascript') {
      runJavaScript(code, sab);
    } else {
      throw new Error(`Interactive mode doesn't support ${language}`);
    }
    postMessage({ type: 'done' });
  } catch (err) {
    postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
