import Image from "next/image";
import { cn } from "@/lib/utils";

export function TradePilotBrand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("tp-brand", compact && "tp-brand-compact", className)}>
      <span className="tp-brand-symbol" aria-hidden="true">
        <Image src="/icon.svg" alt="" width={38} height={38} unoptimized />
      </span>
      <span className="tp-brand-type">
        <strong>TradePilot</strong>
        <small>AI SALES &amp; TRADE</small>
      </span>
    </span>
  );
}
