"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileSearch, Sparkles, AlertCircle, ArrowRight, ClipboardPaste } from "lucide-react";
import type { EvaluationResult, Organization, ProcessingActivity } from "@/lib/types";

type Session = { org: Organization; activities: ProcessingActivity[]; result: EvaluationResult };

export default function ReviewPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [policyText, setPolicyText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [report, setReport] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("pipl_session");
    if (raw) {
      try { setSession(JSON.parse(raw) as Session); } catch { /* ignore */ }
    }
  }, []);

  async function startReview() {
    if (!policyText.trim() || !session || reviewing) return;
    setReviewing(true);
    setReport("");
    setError("");

    const obligations = session.result.obligations.map((o) => ({
      code: o.code,
      titleZh: o.titleZh,
      requiresSeparateConsent: o.requiresSeparateConsent,
      source: o.source,
    }));

    try {
      const res = await fetch("/api/llm/review-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyText, obligations, orgName: session.org.name }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "审查失败");
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6);
            if (payload === "[DONE]") break;
            try {
              text += (JSON.parse(payload) as { text: string }).text;
              setReport(text);
            } catch { /* skip */ }
          }
        }
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setReviewing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">AI 辅助功能</p>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-violet-500" />
            隐私政策合规审查
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            将您的隐私政策粘贴至下方，AI 将对照合规引擎生成的义务清单逐项审查。
          </p>
        </div>

        {/* No session warning */}
        {!session ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">尚未完成合规评估</p>
              <p className="text-xs text-amber-700 mt-0.5">需要先填写问卷并完成评估，以获取义务清单作为审查基准。</p>
              <Link href="/questionnaire" className="inline-flex items-center gap-1 mt-2 text-xs text-amber-800 font-medium hover:underline">
                前往评估 <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
            <p className="text-xs text-violet-800">
              已加载 <strong>{session.org.name}</strong> 的评估结果，
              共 <strong>{session.result.obligations.length}</strong> 条义务将作为审查基准。
            </p>
          </div>
        )}

        {/* Policy text input */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <ClipboardPaste className="w-4 h-4 text-slate-400" />
              粘贴隐私政策全文
            </label>
            <span className="text-xs text-slate-400">{policyText.length} 字符</span>
          </div>
          <textarea
            value={policyText}
            onChange={(e) => setPolicyText(e.target.value)}
            placeholder="将您的隐私政策文本粘贴到此处（支持 HTML 或纯文本，最多取前 8000 字符进行分析）…"
            className="w-full h-56 px-4 pb-4 text-xs text-slate-700 placeholder-slate-400 resize-none focus:outline-none bg-transparent leading-relaxed"
          />
          <div className="px-4 pb-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400">
              提示：文本越完整，审查结论越准确
            </p>
            <button
              onClick={startReview}
              disabled={reviewing || !policyText.trim() || !session}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm text-white font-semibold hover:bg-violet-500 disabled:opacity-40 transition-colors shadow-sm shadow-violet-600/20"
            >
              {reviewing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  审查中…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  开始 AI 审查
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Streaming report */}
        {report && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-slate-800">AI 审查报告</h2>
              {reviewing && (
                <span className="text-xs text-violet-500 animate-pulse">生成中…</span>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">
              {report}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pb-4">
          AI 审查结果仅供参考，不构成法律意见，须经法律专业人士复核
        </p>
      </div>
    </div>
  );
}
