import { BookOpen, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function UsageGuide({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="usage-guide">
      <summary>
        <BookOpen className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>{title}</strong>
          <span className="usage-guide-description">{description}</span>
        </span>
        <ChevronDown
          className="usage-guide-chevron size-4 shrink-0"
          aria-hidden="true"
        />
      </summary>
      <div className="usage-guide-content">{children}</div>
    </details>
  );
}
