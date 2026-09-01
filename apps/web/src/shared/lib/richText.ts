const allowedTags = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'A', 'IMG']);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function escapeHtmlAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function isLikelyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function plainTextToHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function isSafeUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol);
  } catch {
    return value.startsWith('/');
  }
}

function normalizeTagName(tagName: string) {
  if (tagName === 'B') return 'strong';
  if (tagName === 'I') return 'em';
  return tagName.toLowerCase();
}

export function normalizeRichTextHtml(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const parser = new DOMParser();
  const source = isLikelyHtml(trimmed) ? trimmed : plainTextToHtml(trimmed);
  const parsed = parser.parseFromString(source, 'text/html');
  const cleanDocument = document.implementation.createHTMLDocument('');
  const fragment = cleanDocument.createDocumentFragment();

  function cleanNode(node: Node, parent: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(cleanDocument.createTextNode(node.textContent ?? ''));
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    if (!allowedTags.has(element.tagName)) {
      element.childNodes.forEach((child) => cleanNode(child, parent));
      return;
    }

    const cleanElement = cleanDocument.createElement(normalizeTagName(element.tagName));

    if (element.tagName === 'A') {
      const href = element.getAttribute('href')?.trim();
      if (!href || !isSafeUrl(href)) {
        element.childNodes.forEach((child) => cleanNode(child, parent));
        return;
      }
      cleanElement.setAttribute('href', href);
      cleanElement.setAttribute('target', '_blank');
      cleanElement.setAttribute('rel', 'noreferrer');
    }

    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src')?.trim();
      if (!src || src.startsWith('data:') || !isSafeUrl(src)) return;
      cleanElement.setAttribute('src', src);
      cleanElement.setAttribute('alt', element.getAttribute('alt')?.trim() || 'Ürün açıklama görseli');
      cleanElement.setAttribute('loading', 'lazy');
      cleanElement.setAttribute('decoding', 'async');
    }

    element.childNodes.forEach((child) => cleanNode(child, cleanElement));
    parent.appendChild(cleanElement);
  }

  parsed.body.childNodes.forEach((node) => cleanNode(node, fragment));

  const container = cleanDocument.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}
