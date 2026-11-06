import { z } from "zod";
import { NextRequest } from "next/server";
import { evaluate } from "@/lib/engine/evaluate";
import { loadKnowledgeBase } from "@/lib/kb/loader";
import { OrganizationSchema, ProcessingActivitySchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = z
    .object({ org: OrganizationSchema, activities: z.array(ProcessingActivitySchema) })
    .safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
  }
  const { org, activities } = parsed.data;
  const kb = loadKnowledgeBase();
  const result = evaluate(org, activities, kb);
  return Response.json(result);
}
