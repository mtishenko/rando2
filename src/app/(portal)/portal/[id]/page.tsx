import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerModel, getPortfolioModel } from "@/lib/data/compute";
import { buildPortalView } from "@/lib/ui/portal";
import { scoreStatus, oneDp } from "@/lib/ui/format";
import { Trend } from "@/components/ui";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getPortfolioModel().customers.map((m) => ({ id: m.customer.id }));
}

export default async function PortalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = getCustomerModel(id);
  if (!model) notFound();
  const v = buildPortalView(model);
  const day = getPortfolioModel().commandCenter.operatingDay;

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title" style={{ fontSize: 24 }}>
          {v.customerName}
        </h1>
        <div className="page-sub">
          Your security and reliability posture · as of {day}
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className={`n s-${scoreStatus(v.health)}`}>{oneDp(v.health)}</div>
          <div className="l">Health</div>
        </div>
        <div className="stat">
          <div className={`n s-${scoreStatus(v.coverage)}`}>{oneDp(v.coverage)}%</div>
          <div className="l">Coverage</div>
        </div>
        <div className="stat">
          <div className={`n s-${scoreStatus(v.confidence * 100)}`}>{oneDp(v.confidence * 100)}%</div>
          <div className="l">Evidence confidence</div>
        </div>
        <div className="stat">
          <div className="n s-edgefi">
            {v.controlsVerified}
            <span className="faint" style={{ fontSize: 16, fontWeight: 600 }}> / {v.controlsTotal}</span>
          </div>
          <div className="l">Controls verified for you</div>
        </div>
      </div>

      <div className="notice" style={{ alignItems: "center" }}>
        <span>
          Progress this period: health{" "}
          <b>
            <Trend value={v.healthDelta30d} />
          </b>{" "}
          over 30 days, coverage{" "}
          <b>
            <Trend value={v.coverageDelta30d} />
          </b>
          . Health and Coverage measure how well your controls are working and how completely we can
          see them — a control we cannot yet verify lowers coverage without pretending your health is
          fine.
        </span>
      </div>

      <div className="panel">
        <div className="ph">
          <b>What we&apos;re working on for you</b>
          <span className="sub2">{v.workingOn.length} items</span>
        </div>
        <div className="pbody">
          {v.workingOn.length === 0 && (
            <div className="empty-note">Nothing open right now — your environment is in good shape.</div>
          )}
          {v.workingOn.map((w) => (
            <div className="work-item" key={w.id}>
              <span className={`badge ${w.kind === "issue" ? "k-issue" : "k-visibility"}`}>
                {w.kind === "issue" ? "Issue" : "Visibility"}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{w.capability}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {w.headline}
                </div>
              </div>
              <div className="right" style={{ minWidth: 130 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{w.status}</div>
                <div className="faint" style={{ fontSize: 12 }}>
                  edgefi, on your behalf
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {v.needsYou.length > 0 && (
        <div className="panel">
          <div className="ph">
            <b>Needs your input</b>
          </div>
          <div className="pbody">
            {v.needsYou.map((w) => (
              <div className="work-item" key={w.id}>
                <span className="badge k-visibility">You</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{w.capability}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {w.headline}
                  </div>
                </div>
                <button className="btn btn-pri btn-sm">Respond</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {v.acceptedRisks.length > 0 && (
        <div className="panel">
          <div className="ph">
            <b>Accepted risks</b>
            <span className="sub2">decisions you&apos;ve approved</span>
          </div>
          <div className="pbody">
            {v.acceptedRisks.map((r, i) => (
              <div className="work-item" key={i}>
                <span className="badge k-visibility">Accepted</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{r.capability}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {r.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="ph">
          <b>Reports</b>
        </div>
        <div className="pbody">
          <div className="spread">
            <div>
              <div style={{ fontWeight: 600 }}>Quarterly business review</div>
              <div className="muted" style={{ fontSize: 13 }}>
                An evidence-grounded review of your posture, progress, and next-quarter priorities.
                Every statement maps to measured evidence.
              </div>
            </div>
            <button className="btn btn-ghost">Request PDF</button>
          </div>
        </div>
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Every figure here maps to measured evidence. We never show usernames, hostnames, IP addresses,
        or vulnerability details. <Link href="/" className="link">Internal view →</Link>
      </div>
    </>
  );
}
