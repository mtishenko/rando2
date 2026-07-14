import Link from "next/link";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal">
      <div className="portal-top">
        <Link href="/portal" className="brand">
          <span className="mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logomark_purple.png" alt="edgefi" />
          </span>
          <b style={{ fontSize: 17, fontWeight: 500 }}>
            edgefi <span style={{ fontWeight: 700 }}>portal</span>
          </b>
        </Link>
        <span className="onbehalf">
          <span className="cdot" />
          edgefi, on your behalf
        </span>
      </div>
      <div className="portal-body">{children}</div>
    </div>
  );
}
