"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "./useCurrentUser";
import { receiverInitial } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { title: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  { title: "الرئيسية", items: [{ href: "/dashboard", label: "لوحة التحكم", icon: "📊" }] },
  {
    title: "الإدارة",
    items: [
      { href: "/students", label: "الطلاب", icon: "👨‍🎓" },
      { href: "/groups", label: "الجروبات", icon: "📚" },
      { href: "/payments", label: "الدفعات", icon: "💰" },
      { href: "/invoice", label: "الفواتير", icon: "🧾" },
    ],
  },
  { title: "المالية", items: [{ href: "/cashbook", label: "الخزينة", icon: "🏦" }] },
  {
    title: "التقارير والبيانات",
    items: [
      { href: "/reports", label: "التقارير", icon: "📈" },
      { href: "/import", label: "استيراد Excel", icon: "📥" },
      { href: "/backups", label: "النسخ الاحتياطية", icon: "🗂️" },
      { href: "/auditlog", label: "سجل العمليات", icon: "📋" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, toggleUser } = useCurrentUser();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">
          <Image src="/codewave-logo.png" alt="CW" width={40} height={40} />
        </div>
        <div>
          <div className="logo-text">Code Wave</div>
          <div className="logo-sub">نظام الإدارة المالية</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="nav-section">{section.title}</div>
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === "/invoice" && pathname.startsWith("/invoice"));
              return (
                <Link key={item.href} href={item.href} className={`nav-item${active ? " active" : ""}`}>
                  <span className="icon">{item.icon}</span> {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="user-avatar">{receiverInitial(user)}</div>
        <div className="user-info">
          <div className="user-name">{user}</div>
          <div className="user-role">مسؤول</div>
        </div>
        <button className="btn-switch" onClick={toggleUser} title="تغيير المستخدم">تغيير</button>
      </div>
    </aside>
  );
}
