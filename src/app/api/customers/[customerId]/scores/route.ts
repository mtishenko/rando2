import { NextResponse } from "next/server";
import { getCustomerModel } from "@/lib/data/compute";

/** GET /api/customers/{customerId}/scores — current scores (+ mock history). */
export async function GET(_req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const m = getCustomerModel(customerId);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    current: m.scores,
    model_version: "2026.07.0",
    history: {
      health: {
        "30d_change": m.scores.healthDelta30d,
        "7d_change": m.scores.health7dChange,
      },
      coverage: { "30d_change": m.scores.coverageDelta30d },
    },
  });
}
