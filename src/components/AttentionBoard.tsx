"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerSummary } from "@/lib/ui/summary";
import { scoreBand, ageLabel, oneDp } from "@/lib/ui/format";
import { HealthBar, Trend } from "@/components/ui";

type Filter = "action" | "declines" | "opportunities";

const TABS: { key: Filter; label: string; hint: string }[] = [
  { key: "action", label: "Action Today", hint: "Ranked by priority score" },
  { key: "declines", label: "Largest Declines", hint: "Biggest 7-day health drops" },
  { key: "opportunities", label: "Strategic Opportunities", hint: "Coverage & confidence upside" },
];

export default function AttentionBoard({ customers }: { customers: CustomerSummary[] }) {
  const [filter, setFilter] = useState<Filter>("action");

  const rows = useMemo(() => {
    const list = [...customers];
    switch (filter) {
      case "action":
        return list
          .filter((c) => c.qualifiesForAttention)
          .sort((a, b) => b.priorityScore - a.priorityScore);
      case "declines":
        return list
          .filter((c) => c.health7dChange < 0)
          .sort((a, b) => a.health7dChange - b.health7dChange);
      case "opportunities":
        return list
          .filter((c) => c.tier === "Strategic" || c.tier === "Enterprise")
          .sort(
            (a, b) =>
              b.expectedImprovement + (100 - b.coverage) - (a.expectedImprovement + (100 - a.coverage)),
          );
    }
  }, [customers, filter]);

  return (
    <div className="panel">
      <div className="spread" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`btn${filter === t.key ? " btn-accent" : ""}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="muted" style={{ fontSize: 12 }}>
          {TABS.find((t) => t.key === filter)!.hint}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th className="rank">#</th>
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
                <td className="rank">{i + 1}</td>
                <td>
                  <Link href={`/customers/${c.id}`} className="link" style={{ fontWeight: 600 }}>
                    {c.name}
                  </Link>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {c.tier} · {c.industry}
                  </div>
                </td>
                <td>
                  <span className={`pill band-${c.priorityBand.toLowerCase()}`}>
                    {c.priorityBand} · {c.priorityScore}
                  </span>
                </td>
                <td>
                  <HealthBar value={c.health} width={70} />
                </td>
                <td>
                  <Trend value={c.health7dChange} />
                </td>
                <td className="dim" style={{ maxWidth: 220 }}>
                  {c.primaryReason}
                  {c.inclusionReasons.length > 0 && (
                    <div className="reason-tags" style={{ marginTop: 4 }}>
                      {c.inclusionReasons.slice(0, 2).map((r) => (
                        <span className="tag" key={r}>
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="dim">{c.owner ?? "—"}</td>
                <td className="dim">{ageLabel(c.ageDays)}</td>
                <td className="dim" style={{ maxWidth: 280, fontSize: 13 }}>
                  {c.nextBestAction}
                </td>
                <td className="num band-good">+{oneDp(c.expectedImprovement)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="muted" style={{ textAlign: "center", padding: 28 }}>
                  No customers match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
