"use client";

// Lightweight DOM toast — mirrors the reference app's toast behaviour.
export function toast(message: string, type: "success" | "error" = "success") {
  if (typeof document === "undefined") return;
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = (type === "success" ? "✅ " : "⚠️ ") + message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateY(14px)";
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
