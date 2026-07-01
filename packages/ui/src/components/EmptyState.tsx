import { Card } from './Card';

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Card style={{ padding: '2rem', textAlign: 'center' }}>
      <h3 style={{ marginTop: 0, fontFamily: 'var(--font-heading)' }}>{title}</h3>
      <p style={{ margin: 0, color: 'var(--text-soft)', lineHeight: 1.7 }}>{description}</p>
    </Card>
  );
}
