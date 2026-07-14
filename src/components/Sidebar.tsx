"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import RoleSwitcher from "@/components/RoleSwitcher";

/* 16px stroke-1.75 line icons (edgefi nav spec) */
const icons: Record<string, React.ReactNode> = {
  command: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
  tv: (
    <>
      <rect x="2.5" y="4.5" width="19" height="13" rx="1.5" />
      <path d="M8 21h8M12 17.5V21" />
    </>
  ),
  risk: (
    <>
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  exec: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.5a3 3 0 0 1 0 6M17 20a5.5 5.5 0 0 0-3-4.9" />
    </>
  ),
  integrations: <path d="M7 8l-4 4 4 4M17 8l4 4-4 4M14 4l-4 16" />,
  metrics: <path d="M4 6h16M4 12h16M4 18h10" />,
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
}

const NAV = [
  {
    group: "operate",
    items: [
      { href: "/", label: "Command center", icon: "command" },
      { href: "/tv", label: "Office TV", icon: "tv" },
      { href: "/risk", label: "Risk events", icon: "risk" },
    ],
  },
  {
    group: "analyze",
    items: [
      { href: "/executive", label: "Executive", icon: "exec" },
      { href: "/customers", label: "Customers", icon: "customers" },
      { href: "/integrations", label: "Integrations", icon: "integrations" },
      { href: "/metrics", label: "Metric registry", icon: "metrics" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="side">
      <Link href="/" className="brand">
        <span className="mark">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logomark_purple.png" alt="edgefi" />
        </span>
        <b>
          edgefi <span>pulse</span>
        </b>
      </Link>

      <nav className="nav">
        {NAV.map((section) => (
          <div key={section.group}>
            <div className="grp">{section.group}</div>
            {section.items.map((item) => (
              <Link key={item.href} href={item.href} className={isActive(item.href) ? "on" : ""}>
                <Icon name={item.icon} />
                <span className="lbl">{item.label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: 16 }}>
        <RoleSwitcher />
        <div className="tagline" style={{ marginTop: 14 }}>
          <span className="cdot" />
          Contain the chaos.
        </div>
        <div className="micro" style={{ padding: "10px 0 0", letterSpacing: ".05em" }}>
          model v2026.07.0
        </div>
      </div>
    </aside>
  );
}
