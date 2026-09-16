import type { CapabilityState } from '@/content/product-truth';
import { capabilityLabels } from '@/content/product-truth';

export function ProductStatus({ state, children }: { state: CapabilityState; children: React.ReactNode }): React.JSX.Element {
  return <div className={`product-status status-${state}`}><span className="product-status-label">{capabilityLabels[state]}</span><div>{children}</div></div>;
}
