import { ReactNode } from "react";
import { formatDate, todayIso } from "@/lib/utils";

export function Header({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <header className="header">
      <div className="header-title">{title}</div>
      <div className="header-actions">
        <div className="header-date">{formatDate(todayIso())}</div>
        {actions}
      </div>
    </header>
  );
}
