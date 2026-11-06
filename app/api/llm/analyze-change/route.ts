import Anthropic from "@anthropic-ai/sdk";
import https from "https";

export const dynamic = "force-dynamic";

const INSECURE_AGENT = new https.Agent({ rejectUnauthorized: false });

function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { agent: INSECURE_AGENT, headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "zh-CN,zh;q=0.9" }, timeout: 15000 },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c: string) => { if (data.length < 12000) data += c; });
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

export interface ChangeAnalysis {
  severity: "major" | "minor" | "unclear";
  summary: string;
  keyRequirements: string[];
  potentialChange: string;
  recommendation: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-ant-xxx")) {
    return Response.json({ error: "请在 .env.local 中配置 ANTHROPIC_API_KEY" }, { status: 503 });
  }

  const { sourceId, sourceName, url } = await req.json() as {
    sourceId: string; sourceName: string; url: string;
  };

  if (!url) return Response.json({ error: "缺少 url 参数" }, { status: 400 });

  let pageContent: string;
  try {
    pageContent = await fetchPage(url);
  } catch (e) {
    return Response.json({ error: `无法获取页面：${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  // 提取正文（去掉 HTML 标签）
  const text = pageContent
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `你是中国数据合规专家。以下是法规官方页面的文本内容（${sourceName}，ID: ${sourceId}）。

页面内容：
${text}

请分析并以如下 JSON 格式回复（不要添加任何其他内容）：
{
  "severity": "major（重大修订）| minor（小幅调整）| unclear（无法判断）",
  "summary": "本法规的核心内容概述（100字以内）",
  "keyRequirements": ["关键义务1", "关键义务2", "关键义务3"],
  "potentialChange": "页面中是否有迹象表明近期有修订或更新（如修正案字样、新施行日期等），如无则说明未发现明显变更迹象",
  "recommendation": "对使用本工具的企业合规团队的建议（50字以内）"
}`
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const result: ChangeAnalysis = JSON.parse(match?.[0] ?? "{}");
    return Response.json(result);
  } catch {
    return Response.json({ error: "AI 响应解析失败", raw }, { status: 500 });
  }
}
