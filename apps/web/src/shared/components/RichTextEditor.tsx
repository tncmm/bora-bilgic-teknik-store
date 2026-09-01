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

function getTextLength(html: string) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return (container.textContent ?? '').trim().length;
}

const toolbarGroups = [
  [
    { command: 'bold', icon: 'format_bold', label: 'Kalın' },
    { command: 'italic', icon: 'format_italic', label: 'İtalik' },
    { command: 'underline', icon: 'format_underlined', label: 'Altı çizili' },
  ],
  [
    { command: 'insertUnorderedList', icon: 'format_list_bulleted', label: 'Madde listesi' },
    { command: 'insertOrderedList', icon: 'format_list_numbered', label: 'Numaralı liste' },
    { command: 'formatBlock', value: 'blockquote', icon: 'format_quote', label: 'Alıntı' },
  ],
  [
    { command: 'justifyLeft', icon: 'format_align_left', label: 'Sola hizala' },
    { command: 'justifyCenter', icon: 'format_align_center', label: 'Ortala' },
    { command: 'justifyRight', icon: 'format_align_right', label: 'Sağa hizala' },
  ],
  [
    { command: 'undo', icon: 'undo', label: 'Geri al' },
    { command: 'redo', icon: 'redo', label: 'İleri al' },
    { command: 'removeFormat', icon: 'format_clear', label: 'Biçimi temizle' },
  ],
];

export function RichTextEditor({ helperText, label, onChange, value }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastValueRef = useRef('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    if (document.activeElement !== editor && value !== lastValueRef.current) {
      const normalized = normalizeRichTextHtml(value);
      editor.innerHTML = normalized;
      lastValueRef.current = normalized;
      setCharacterCount(getTextLength(normalized));
    }
  }, [value]);

  function emitChange() {
    const nextValue = normalizeRichTextHtml(editorRef.current?.innerHTML ?? '');
    lastValueRef.current = nextValue;
    setCharacterCount(getTextLength(nextValue));
    onChange(nextValue);
  }

  function runCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    emitChange();
  }

  function setBlock(value: string) {
    runCommand('formatBlock', value);
  }

  function insertLink() {
    const url = window.prompt('Bağlantı adresi');
    if (!url) return;

    editorRef.current?.focus();
    document.execCommand('createLink', false, url.trim());
    emitChange();
  }

  function insertImageByUrl() {
    const url = window.prompt('Görsel URL’si');
    if (!url) return;

    if (!isImageUrl(url)) {
      setPasteError('Lütfen JPG, PNG, WEBP veya AVIF uzantılı geçerli bir görsel URL’si girin.');
      return;
    }

    editorRef.current?.focus();
    insertHtmlAtSelection(`<img src="${escapeHtmlAttribute(url.trim())}" alt="Ürün açıklama görseli">`);
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
      <div className="rich-text-editor__header">
        <div>
          <div className="rich-text-editor__label">{label}</div>
          <p>Ürün hikayesini, teknik notları ve görsel destekli açıklamaları düzenleyin.</p>
        </div>
        <button className="rich-text-editor__preview-toggle" onClick={() => setIsPreviewing((nextValue) => !nextValue)} type="button">
          <span className="material-symbols-outlined">{isPreviewing ? 'edit' : 'visibility'}</span>
          {isPreviewing ? 'Düzenle' : 'Önizle'}
        </button>
      </div>
      <div className="rich-text-editor__toolbar" aria-label={`${label} biçimlendirme araçları`}>
        <select aria-label="Metin tipi" onChange={(event) => setBlock(event.target.value)} defaultValue="p">
          <option value="p">Paragraf</option>
          <option value="h2">Büyük başlık</option>
          <option value="h3">Başlık</option>
          <option value="h4">Alt başlık</option>
        </select>
        {toolbarGroups.map((group, groupIndex) => (
          <div className="rich-text-editor__toolbar-group" key={groupIndex}>
            {group.map((item) => (
              <button
                aria-label={item.label}
                key={`${item.command}-${item.value ?? ''}`}
                onClick={() => runCommand(item.command, item.value)}
                title={item.label}
                type="button"
              >
                <span className="material-symbols-outlined">{item.icon}</span>
              </button>
            ))}
          </div>
        ))}
        <div className="rich-text-editor__toolbar-group">
          <button aria-label="Bağlantı ekle" onClick={insertLink} title="Bağlantı ekle" type="button">
            <span className="material-symbols-outlined">add_link</span>
          </button>
          <button aria-label="Görsel URL’si ekle" onClick={insertImageByUrl} title="Görsel URL’si ekle" type="button">
            <span className="material-symbols-outlined">add_photo_alternate</span>
          </button>
        </div>
      </div>
      <div className="rich-text-editor__canvas">
        <div
          className={['rich-text-editor__surface', isPreviewing ? 'is-hidden' : ''].filter(Boolean).join(' ')}
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
        {isPreviewing ? (
          <div className="rich-text-editor__preview dji-detail-description" dangerouslySetInnerHTML={{ __html: normalizeRichTextHtml(value) || '<p>Önizlenecek açıklama yok.</p>' }} />
        ) : null}
      </div>
      <div className="rich-text-editor__footer">
        <span>{characterCount} karakter</span>
        <span>Görseller açıklama alanında otomatik küçültülür.</span>
      </div>
      {pasteError ? <p className="admin-field-error">{pasteError}</p> : null}
      {helperText ? <p className="admin-field-hint">{helperText}</p> : null}
    </div>
  );
}
