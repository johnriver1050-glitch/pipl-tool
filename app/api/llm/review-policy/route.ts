import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-ant-xxx")) {
    return Response.json({ error: "请在 .env.local 中配置 ANTHROPIC_API_KEY" }, { status: 503 });
  }

  const { policyText, obligations, orgName } = await req.json() as {
    policyText: string;
    obligations: Array<{ code: string; titleZh: string; requiresSeparateConsent?: boolean; source?: string }>;
    orgName?: string;
  };

  if (!policyText?.trim()) return Response.json({ error: "请提供隐私政策文本" }, { status: 400 });
  if (!obligations?.length) return Response.json({ error: "请先完成合规评估以获取义务清单" }, { status: 400 });

  const obligationList = obligations
    .map((o) => `- [${o.code}] ${o.titleZh}${o.requiresSeparateConsent ? "（须单独同意）" : ""}`)
    .join("\n");

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    system: `你是中国个人信息保护法合规专家。你的任务是审查企业的隐私政策是否满足合规引擎生成的义务清单。
输出格式：
1. 首先给出总体评分（满足/部分满足/不满足）和一句话总结
2. 逐条列出每项义务的审查结论：✅ 已覆盖 / ⚠️ 覆盖不完整 / ❌ 缺失
3. 对"缺失"和"不完整"项给出具体改进建议
4. 最后列出3条优先整改事项
回答使用中文，保持简洁专业。`,
    messages: [{
      role: "user",
      content: `企业名称：${orgName ?? "（未提供）"}

【需审查的合规义务清单】
${obligationList}

【企业现有隐私政策全文】
${policyText.slice(0, 8000)}

请逐项审查并给出报告。`,
    }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
            );
          }
        }
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
