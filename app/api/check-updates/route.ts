import { NextRequest } from "next/server";
import {
  checkAllSources,
  getCachedStatuses,
  confirmSource,
} from "@/lib/legal-tracker/checker";

export async function GET(req: NextRequest) {
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (refresh) {
    const statuses = await checkAllSources();
    return Response.json({ statuses, refreshed: true });
  }

  const statuses = getCachedStatuses();
  return Response.json({ statuses, refreshed: false });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) {
    return new Response("缺少 id", { status: 400 });
  }
  confirmSource(id);
  return Response.json({ ok: true });
}
