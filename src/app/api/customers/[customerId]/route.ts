import { NextResponse } from "next/server";
import { getCustomerModel } from "@/lib/data/compute";

/** GET /api/customers/{customerId} — profile and summary. */
export async function GET(_req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const m = getCustomerModel(customerId);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    customer: m.customer,
    scores: m.scores,
    integrations: m.integrations,
    open_events: m.events.length,
  });
}
