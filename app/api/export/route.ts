import { z } from "zod";
import { NextRequest } from "next/server";
import { evaluate } from "@/lib/engine/evaluate";
import { loadKnowledgeBase } from "@/lib/kb/loader";
import {
  renderGapReport,
  renderPrivacyPolicyOutline,
  renderCrossBorderConsent,
  renderPiCollectionList,
  renderSharingList,
  renderSeparateConsent,
  renderPipiaReport,
} from "@/lib/templates/render";
import { renderToDocx } from "@/lib/export/docx";
import { OrganizationSchema, ProcessingActivitySchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = z
    .object({
      docType: z.string().min(1),
      org: OrganizationSchema,
      activities: z.array(ProcessingActivitySchema),
    })
    .safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify(parsed.error.flatten()), { status: 400 });
  }
  const { docType, org, activities } = parsed.data;

  const kb = loadKnowledgeBase();
  const result = evaluate(org, activities, kb);

  let rendered;
  if (docType === "gap_report") {
    rendered = renderGapReport(org, result, kb);
  } else if (docType === "privacy_policy") {
    rendered = renderPrivacyPolicyOutline(org, activities, result, kb);
  } else if (docType === "crossborder_notice") {
    const act = activities.find((a) => a.crossBorder !== null);
    if (!act?.crossBorder) {
      return new Response("无跨境处理活动", { status: 400 });
    }
    rendered = renderCrossBorderConsent(act.crossBorder, kb);
  } else if (docType === "pi_collection_list") {
    rendered = renderPiCollectionList(org, activities, kb);
  } else if (docType === "sharing_list") {
    rendered = renderSharingList(org, activities, kb);
  } else if (docType === "separate_consent") {
    rendered = renderSeparateConsent(org, activities, kb);
  } else if (docType === "pipia_report") {
    rendered = renderPipiaReport(org, activities, result, kb);
  } else {
    return new Response("未知文档类型", { status: 400 });
  }

  const buf = await renderToDocx(rendered);
  const filename = encodeURIComponent(`${rendered.titleZh}.docx`);

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
