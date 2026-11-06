import { loadCases } from "@/lib/cases/loader";

export const dynamic = "force-dynamic";

export function GET() {
  const cases = loadCases();
  return Response.json({ cases });
}
