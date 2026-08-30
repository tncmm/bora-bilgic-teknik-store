import { formatCurrency } from '../../shared/lib/format';

interface PriceTagProps {
  price: number;
  discountPercent?: number;
  effectivePrice?: number;
}

/** Old price (strikethrough) + effective price + % badge when discounted. */
export function PriceTag({ price, discountPercent = 0, effectivePrice }: PriceTagProps) {
  const effective = effectivePrice ?? price;

  if (discountPercent <= 0 || effective >= price) {
    return <strong>{formatCurrency(price, 'tr')}</strong>;
  }

  return (
    <span className="price-tag">
      <span className="price-tag__old">{formatCurrency(price, 'tr')}</span>
      <strong className="price-tag__now">{formatCurrency(effective, 'tr')}</strong>
      <span className="price-tag__badge">%{discountPercent}</span>
    </span>
  );
}
