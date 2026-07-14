import { NextResponse } from "next/server";
import { getPortfolioModel } from "@/lib/data/compute";

/** GET /api/dashboard/command-center — TV and command-center data. */
export function GET() {
  return NextResponse.json(getPortfolioModel().commandCenter);
}
