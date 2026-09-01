import { useEffect, useRef, useState } from 'react';

import { escapeHtmlAttribute, normalizeRichTextHtml } from '../lib/richText';

interface RichTextEditorProps {
  label: string;
  value: string;
  helperText?: string;
  onChange: (value: string) => void;
}

function insertHtmlAtSelection(html: string) {
  document.execCommand('insertHTML', false, html);
}

function isImageUrl(value: string) {
  return /^https?:\/\/.+\.(?:avif|jpe?g|png|webp)(?:[?#].*)?$/i.test(value.trim());
}

export function RichTextEditor({ helperText, label, onChange, value }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastValueRef = useRef('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (document.activeElement !== editor && value !== lastValueRef.current) {
      const normalized = normalizeRichTextHtml(value);
      editor.innerHTML = normalized;
      lastValueRef.current = normalized;
    }
  }, [value]);

  function emitChange() {
    const nextValue = normalizeRichTextHtml(editorRef.current?.innerHTML ?? '');
    lastValueRef.current = nextValue;
    onChange(nextValue);
  }

  function runCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emitChange();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    setPasteError(null);
    const imageFiles = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');

    if (imageFiles.length > 0) {
      event.preventDefault();
      setPasteError('Dosya görseli açıklamaya doğrudan yapıştırılamaz. Lütfen görsel URL’si yapıştırın; base64 dosya içeriği DB’ye kaydedilmez.');
      return;
    }

    if (html || text) {
      event.preventDefault();
      if (!html && isImageUrl(text)) {
        insertHtmlAtSelection(`<img src="${escapeHtmlAttribute(text.trim())}" alt="Ürün açıklama görseli">`);
        emitChange();
        return;
      }
      insertHtmlAtSelection(normalizeRichTextHtml(html || text));
      emitChange();
    }
  }

  return (
    <div className="rich-text-editor">
      <div className="rich-text-editor__label">{label}</div>
      <div className="rich-text-editor__toolbar" aria-label={`${label} biçimlendirme araçları`}>
        <button onClick={() => runCommand('bold')} type="button">
          Kalın
        </button>
        <button onClick={() => runCommand('italic')} type="button">
          İtalik
        </button>
        <button onClick={() => runCommand('formatBlock', 'h3')} type="button">
          Başlık
        </button>
        <button onClick={() => runCommand('insertUnorderedList')} type="button">
          Liste
        </button>
        <button onClick={() => runCommand('insertOrderedList')} type="button">
          Numaralı
        </button>
        <button onClick={() => runCommand('removeFormat')} type="button">
          Temizle
        </button>
      </div>
      <div
        className="rich-text-editor__surface"
        contentEditable
        onBlur={emitChange}
        onInput={emitChange}
        onPaste={handlePaste}
        ref={editorRef}
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        suppressContentEditableWarning
      />
      {pasteError ? <p className="admin-field-error">{pasteError}</p> : null}
      {helperText ? <p className="admin-field-hint">{helperText}</p> : null}
    </div>
  );
}
