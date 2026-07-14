import { NextResponse } from "next/server";
import { getCustomerModel } from "@/lib/data/compute";

/** GET /api/customers/{customerId}/risk-events — list customer risk events. */
export async function GET(_req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const m = getCustomerModel(customerId);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ risk_events: m.events });
}
