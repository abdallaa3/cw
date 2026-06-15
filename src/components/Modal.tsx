"use client";

import { ReactNode, useEffect } from "react";

export function Modal({
  title,
  onClose,
  children,
  width,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { width } : undefined}>
        <button className="modal-close" onClick={onClose} aria-label="إغلاق">
          ×
        </button>
        <div className="modal-title">{title}</div>
        {children}
      </div>
    </div>
  );
}
