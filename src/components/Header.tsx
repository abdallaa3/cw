"use client";

import { ReactNode } from "react";
import { formatDate, todayIso } from "@/lib/utils";

export function Header({
  title,
  actions,
  onMenuToggle,
}: {
  title: ReactNode;
  actions?: ReactNode;
  onMenuToggle?: () => void;
}) {
  return (
    <header className="header">
      {/* Hamburger — only visible on mobile via CSS */}
      <button
        className="menu-toggle"
        onClick={onMenuToggle}
        aria-label="فتح القائمة"
        type="button"
      >
        ☰
      </button>

      <div className="header-title">{title}</div>

      <div className="header-actions">
        <div className="header-date">{formatDate(todayIso())}</div>
        {actions}
      </div>
    </header>
  );
}
