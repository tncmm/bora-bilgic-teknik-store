import { normalizeRichTextHtml } from '../lib/richText';

interface RichTextContentProps {
  className?: string;
  html?: string | null;
}

export function RichTextContent({ className, html }: RichTextContentProps) {
  const safeHtml = normalizeRichTextHtml(html ?? '');

  if (!safeHtml) return null;

  return <div className={className} dangerouslySetInnerHTML={{ __html: safeHtml }} />;
}
