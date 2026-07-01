interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="ui-section-heading">
      {eyebrow ? <span className="ui-badge">{eyebrow}</span> : null}
      <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', margin: '1rem 0 0.75rem' }}>{title}</h2>
      {description ? (
        <p style={{ margin: 0, maxWidth: '62ch', color: 'var(--text-soft)', lineHeight: 1.65 }}>{description}</p>
      ) : null}
    </div>
  );
}
