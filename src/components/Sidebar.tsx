"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    group: "Operate",
    items: [
      { href: "/", label: "Command Center", icon: "◎" },
      { href: "/tv", label: "Office TV", icon: "▦" },
      { href: "/risk", label: "Risk Events", icon: "⚠" },
    ],
  },
  {
    group: "Analyze",
    items: [
      { href: "/executive", label: "Executive", icon: "▤" },
      { href: "/customers", label: "Customers", icon: "◍" },
      { href: "/integrations", label: "Integrations", icon: "⇄" },
      { href: "/metrics", label: "Metric Registry", icon: "≣" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <span className="brand-mark">P</span>
        <span className="stack" style={{ gap: 0 }}>
          <span className="brand-name">Edgefi Pulse</span>
          <span className="brand-sub">Operational Intelligence</span>
        </span>
      </Link>

      {NAV.map((section) => (
        <div key={section.group}>
          <div className="nav-group-label">{section.group}</div>
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive(item.href) ? " active" : ""}`}
            >
              <span className="nav-ico">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      ))}

      <div style={{ marginTop: "auto", fontSize: 11, color: "var(--text-3)" }}>
        <div className="row" style={{ gap: 7 }}>
          <span className="pulse-dot" />
          Model v2026.07.0
        </div>
        <div style={{ marginTop: 6 }}>MVP · scoring + command center</div>
      </div>
    </aside>
  );
}
