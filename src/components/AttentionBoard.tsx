"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerSummary } from "@/lib/ui/summary";
import { ageLabel, oneDp } from "@/lib/ui/format";
import { HealthBar, PriorityPill, Trend } from "@/components/ui";

type Filter = "action" | "declines" | "opportunities";

const TABS: { key: Filter; label: string }[] = [
  { key: "action", label: "Action today" },
  { key: "declines", label: "Largest declines" },
  { key: "opportunities", label: "Strategic opportunities" },
];

export default function AttentionBoard({ customers }: { customers: CustomerSummary[] }) {
  const [filter, setFilter] = useState<Filter>("action");

  const rows = useMemo(() => {
    const list = [...customers];
    switch (filter) {
      case "action":
        return list.filter((c) => c.qualifiesForAttention).sort((a, b) => b.priorityScore - a.priorityScore);
      case "declines":
        return list.filter((c) => c.health7dChange < 0).sort((a, b) => a.health7dChange - b.health7dChange);
      case "opportunities":
        return list
          .filter((c) => c.tier === "Strategic" || c.tier === "Enterprise")
          .sort((a, b) => b.expectedImprovement + (100 - b.coverage) - (a.expectedImprovement + (100 - a.coverage)));
    }
  }, [customers, filter]);

  return (
    <>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={filter === t.key ? "on" : ""} onClick={() => setFilter(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="ph">
          <b>Customers requiring attention</b>
          <span className="sub2">
            {filter === "action"
              ? "Ranked by priority score — not lowest health"
              : filter === "declines"
                ? "Biggest 7-day health drops"
                : "Coverage and confidence upside"}
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                <th>Customer</th>
                <th>Priority</th>
                <th>Health</th>
                <th>7-day</th>
                <th>Primary reason</th>
                <th>Owner</th>
                <th>Age</th>
                <th>Next best action</th>
                <th className="num">Exp. Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={c.id}>
                  <td className="mono faint">{i + 1}</td>
                  <td>
                    <Link href={`/customers/${c.id}`} className="link">
                      {c.name}
                    </Link>
                    <div className="faint" style={{ fontSize: 12 }}>
                      {c.tier} · {c.industry}
                    </div>
                  </td>
                  <td>
                    <PriorityPill band={c.priorityBand} score={c.priorityScore} />
                  </td>
                  <td>
                    <HealthBar value={c.health} width={64} />
                  </td>
                  <td>
                    <Trend value={c.health7dChange} />
                  </td>
                  <td className="muted" style={{ maxWidth: 220 }}>
                    {c.primaryReason}
                    {c.inclusionReasons.length > 0 && (
                      <div style={{ marginTop: 3 }}>
                        {c.inclusionReasons.slice(0, 2).map((r) => (
                          <span className="rtag" key={r}>
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="muted">{c.owner ?? "—"}</td>
                  <td className="muted">{ageLabel(c.ageDays)}</td>
                  <td className="muted" style={{ maxWidth: 260, fontSize: 13 }}>
                    {c.nextBestAction}
                  </td>
                  <td className="num s-ok" style={{ fontWeight: 600 }}>
                    +{oneDp(c.expectedImprovement)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-note">
                    No customers match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
