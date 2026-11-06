import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-ant-xxx")) {
    return Response.json({ error: "请在 .env.local 中配置 ANTHROPIC_API_KEY" }, { status: 503 });
  }

  const { question, obligationCode, obligationTitle, triggerReason, source, orgName } =
    await req.json() as {
      question: string;
      obligationCode: string;
      obligationTitle: string;
      triggerReason?: string;
      source?: string;
      orgName?: string;
    };

  if (!question?.trim()) return Response.json({ error: "问题不能为空" }, { status: 400 });

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: "你是中国个人信息保护法合规顾问，回答简洁、准确、基于现行法规，不超过200字。",
    messages: [{
      role: "user",
      content: `义务：${obligationCode} — ${obligationTitle}
${source ? `法规来源：${source}` : ""}
${triggerReason ? `触发原因：${triggerReason}` : ""}
${orgName ? `企业：${orgName}` : ""}

问题：${question}`,
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
