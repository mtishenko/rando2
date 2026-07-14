import { NextResponse } from "next/server";
import { METRIC_CATALOG } from "@/lib/metrics/catalog";

/** GET /api/metrics — list metric definitions. */
export function GET() {
  return NextResponse.json({ metrics: METRIC_CATALOG });
}
