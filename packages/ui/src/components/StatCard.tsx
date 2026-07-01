import { Card } from './Card';

interface StatCardProps {
  title: string;
  value: string;
  hint?: string;
}

export function StatCard({ title, value, hint }: StatCardProps) {
  return (
    <Card className="ui-stat-card" style={{ padding: '1.4rem' }}>
      <div style={{ color: 'var(--text-soft)', fontSize: '0.84rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {title}
      </div>
      <h3 style={{ margin: '0.75rem 0 0.45rem', fontSize: '2rem' }}>{value}</h3>
      {hint ? <p style={{ margin: 0, color: 'var(--text-soft)' }}>{hint}</p> : null}
    </Card>
  );
}
