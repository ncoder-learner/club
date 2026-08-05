import { useEffect, useRef, useState } from 'react';
import { Paperclip, SendHorizonal, Square, X } from 'lucide-react';
import { extractDocxText } from '../../lib/docs';

const TEXT_EXTENSIONS = /\.(txt|md|py|cpp|cc|c|h|hpp|java|js|jsx|ts|tsx|json|csv|log|sh|rb|go|rs|cs|swift|kt|html|css|yml|yaml)$/i;
const DOCX_EXTENSION = /\.docx$/i;

export default function Composer({ value, onChange, onSend, disabled, isGenerating, onStop, autoFocusRef }) {
  const localRef = useRef(null);
  const textareaRef = autoFocusRef || localRef;
  const fileInputRef = useRef(null);
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleFiles = async (fileList) => {
    for (const file of Array.from(fileList)) {
      if (file.type.startsWith('image/')) {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        setImages((prev) => [...prev, { name: file.name, dataUrl }]);
      } else if (DOCX_EXTENSION.test(file.name)) {
        try {
          const text = await extractDocxText(file);
          setFiles((prev) => [...prev, { name: file.name, text }]);
        } catch {
          setFiles((prev) => [...prev, { name: file.name, text: '[Could not read this .docx file]' }]);
        }
      } else if (TEXT_EXTENSIONS.test(file.name) || file.type.startsWith('text/')) {
        const text = await file.text();
        setFiles((prev) => [...prev, { name: file.name, text }]);
      }
    }
  };

  const removeImage = (i) => setImages((prev) => prev.filter((_, idx) => idx !== i));
  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const submit = () => {
    if (disabled) return;
    if (!value.trim() && images.length === 0 && files.length === 0) return;
    onSend({ text: value.trim(), images, files });
    setImages([]);
    setFiles([]);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const onPaste = (e) => {
    const pastedFiles = Array.from(e.clipboardData?.files ?? []);
    if (pastedFiles.length === 0) return;
    e.preventDefault();
    handleFiles(pastedFiles);
  };

  return (
    <div className="glass rounded-muffin-lg p-3">
      {(images.length > 0 || files.length > 0) && (
        <div className="mb-2 flex flex-wrap gap-2 px-1">
          {images.map((img, i) => (
            <div key={i} className="group relative">
              <img src={img.dataUrl} alt={img.name} className="h-14 w-14 rounded-lg object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 hover:bg-red-500 hover:text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300"
            >
              📄 {f.name}
              <button onClick={() => removeFile(i)} className="text-zinc-400 hover:text-red-400">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
          title="Attach files or images"
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,text/*,.py,.cpp,.cc,.c,.h,.hpp,.java,.js,.jsx,.ts,.tsx,.json,.md,.csv,.log,.sh,.rb,.go,.rs,.cs,.swift,.kt,.docx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="What can I help with?"
          rows={1}
          className="max-h-[200px] flex-1 resize-none bg-transparent py-2 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
        />
        {isGenerating ? (
          <button
            onClick={onStop}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:-translate-y-0.5 hover:bg-white/20"
            title="Stop generating"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={disabled}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/30 disabled:opacity-40 disabled:hover:translate-y-0"
            title="Send"
          >
            <SendHorizonal size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
