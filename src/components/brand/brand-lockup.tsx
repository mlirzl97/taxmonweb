import Link from "next/link";

import { AntMark } from "./ant-mark";

type BrandLockupProps = {
  compact?: boolean;
  inverted?: boolean;
};

export function BrandLockup({ compact = false, inverted = false }: BrandLockupProps) {
  return (
    <Link aria-label="TaxMonWeb Control Tower" className="brand-lockup" href="/app/control-tower">
      <AntMark inverted={inverted} size={compact ? 32 : 42} />
      {!compact && (
        <span className="brand-lockup__type">
          <span className={inverted ? "brand-lockup__name brand-lockup__name--inverted" : "brand-lockup__name"}>
            TaxMon<span>Web</span>
          </span>
          <span className={inverted ? "brand-lockup__descriptor brand-lockup__descriptor--inverted" : "brand-lockup__descriptor"}>
            Tax Compliance Control
          </span>
        </span>
      )}
    </Link>
  );
}
