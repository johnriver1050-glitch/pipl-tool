"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Sparkles, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";

interface SourceStatus {
  id: string;
  name_zh: string;
  url: string;
  effective_date: string;
  related_rules: string[];
  note_zh?: string;
  status: "current" | "possibly_updated" | "error" | "pending";
  last_verified: string;
  checked_at: string;
  error?: string;
}

const STATUS_CONFIG = {
  current: {
    label: "正常",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
  },
  possibly_updated: {
    label: "可能有更新",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
  error: {
    label: "访问失败",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  pending: {
    label: "待首次检测",
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminPage() {
  const [statuses, setStatuses] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [analyses, setAnalyses] = useState<Record<string, { severity: string; summary: string; keyRequirements: string[]; potentialChange: string; recommendation: string } | { error: string }>>({});
  const [expandedAnalysis, setExpandedAnalysis] = useState<Set<string>>(new Set());

  async function load(refresh = false) {
    refresh ? setChecking(true) : setLoading(true);
    setError(null);
    try {
      const url = refresh
        ? "/api/check-updates?refresh=1"
        : "/api/check-updates";
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setStatuses(data.statuses);
      setLastRefresh(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "请求失败");
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }

  async function handleConfirm(id: string) {
    setConfirming((prev) => new Set(prev).add(id));
    try {
      const res = await fetch("/api/check-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatuses((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "current" } : s))
      );
    } catch {
      // silently ignore — user can retry by refreshing
    } finally {
      setConfirming((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleAnalyze(src: SourceStatus) {
    setAnalyzing((prev) => new Set(prev).add(src.id));
    try {
      const res = await fetch("/api/llm/analyze-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: src.id, sourceName: src.name_zh, url: src.url }),
      });
      const data = await res.json();
      setAnalyses((prev) => ({ ...prev, [src.id]: data }));
      setExpandedAnalysis((prev) => new Set(prev).add(src.id));
    } catch (e) {
      setAnalyses((prev) => ({ ...prev, [src.id]: { error: String(e) } }));
    } finally {
      setAnalyzing((prev) => { const n = new Set(prev); n.delete(src.id); return n; });
    }
  }

  useEffect(() => {
    load(false);
  }, []);

  const counts = {
    total: statuses.length,
    current: statuses.filter((s) => s.status === "current").length,
    possibly_updated: statuses.filter((s) => s.status === "possibly_updated")
      .length,
    error: statuses.filter((s) => s.status === "error").length,
    pending: statuses.filter((s) => s.status === "pending").length,
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-400 mb-1">PIPL 合规工具 / 法规追踪</p>
            <h1 className="text-2xl font-bold text-slate-900">
              法规来源追踪
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              实时检测各法规官方页面的内容变化，发现可能的修订或更新。
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => load(true)}
              disabled={checking || loading}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {checking ? "检测中…" : "立即检测所有来源"}
            </button>
            {lastRefresh && (
              <p className="text-xs text-slate-400">
                上次刷新：{formatDate(lastRefresh)}
              </p>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "法规总数", value: counts.total, color: "text-slate-700" },
            { label: "正常", value: counts.current, color: "text-green-700" },
            {
              label: "可能有更新",
              value: counts.possibly_updated,
              color: "text-amber-600",
            },
            {
              label: "访问失败",
              value: counts.error,
              color: "text-red-600",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-4 text-center shadow-sm"
            >
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {counts.possibly_updated > 0 && (
          <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <strong>注意：</strong>检测到 {counts.possibly_updated}{" "}
            个法规来源页面内容发生变化，建议人工核查是否有条文修订，并更新知识库规则。
            核查完成后点击"已核查确认"，状态方可恢复正常。
          </div>
        )}

        {/* Sources table */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">加载中…</div>
        ) : (
          <div className="space-y-3">
            {statuses.map((src) => {
              const cfg = STATUS_CONFIG[src.status];
              return (
                <div
                  key={src.id}
                  className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0`}
                        />
                        <span className="font-medium text-slate-800 text-sm">
                          {src.name_zh}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.text} font-medium`}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline break-all"
                      >
                        {src.url}
                      </a>

                      {src.note_zh && (
                        <p className="text-xs text-slate-500 mt-1">
                          注：{src.note_zh}
                        </p>
                      )}

                      {src.error && (
                        <p className="text-xs text-red-600 mt-1">
                          错误：{src.error}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1 mt-2">
                        {src.related_rules.map((r) => (
                          <span
                            key={r}
                            className="text-xs bg-white/70 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 font-mono"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-500 flex-shrink-0 flex flex-col items-end gap-2">
                      <div>
                        <p>施行：{src.effective_date}</p>
                        <p className="mt-1">
                          {src.last_verified
                            ? `核验：${formatDate(src.last_verified)}`
                            : "尚未核验"}
                        </p>
                        <p className="mt-1 text-slate-400">
                          {src.related_rules.length} 条关联规则
                        </p>
                      </div>
                      {src.status === "possibly_updated" && (
                        <div className="flex flex-col gap-1.5 items-end">
                          <button
                            onClick={() => handleAnalyze(src)}
                            disabled={analyzing.has(src.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors"
                          >
                            <Sparkles className="w-3 h-3" />
                            {analyzing.has(src.id) ? "AI 解读中…" : "AI 解读变更"}
                          </button>
                          <button
                            onClick={() => handleConfirm(src.id)}
                            disabled={confirming.has(src.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs text-white font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {confirming.has(src.id) ? "确认中…" : "已核查确认"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI 分析结果 */}
                  {analyses[src.id] && (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      {"error" in analyses[src.id] ? (
                        <p className="text-xs text-red-600">{"error" in analyses[src.id] ? (analyses[src.id] as { error: string }).error : ""}</p>
                      ) : (() => {
                        const a = analyses[src.id] as { severity: string; summary: string; keyRequirements: string[]; potentialChange: string; recommendation: string };
                        const severityStyle = a.severity === "major"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : a.severity === "minor"
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-600 border-slate-200";
                        const severityLabel = a.severity === "major" ? "重大修订" : a.severity === "minor" ? "小幅调整" : "待进一步核实";
                        const isExpanded = expandedAnalysis.has(src.id);
                        return (
                          <div>
                            <button
                              onClick={() => setExpandedAnalysis((prev) => {
                                const n = new Set(prev);
                                isExpanded ? n.delete(src.id) : n.add(src.id);
                                return n;
                              })}
                              className="w-full flex items-center justify-between text-left"
                            >
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                                <span className="text-xs font-medium text-violet-700">AI 解读结果</span>
                                <span className={`text-[10px] border rounded-full px-2 py-0.5 font-medium ${severityStyle}`}>{severityLabel}</span>
                              </div>
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                            </button>
                            {isExpanded && (
                              <div className="mt-2 space-y-2 text-xs">
                                <p className="text-slate-700"><span className="font-medium text-slate-500">内容概述：</span>{a.summary}</p>
                                {a.keyRequirements?.length > 0 && (
                                  <div>
                                    <p className="font-medium text-slate-500 mb-1">核心合规要求：</p>
                                    <ul className="space-y-0.5 pl-3">
                                      {a.keyRequirements.map((r, i) => (
                                        <li key={i} className="text-slate-700 flex items-start gap-1">
                                          <span className="text-slate-400 shrink-0">•</span>{r}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                <p className="text-slate-700"><span className="font-medium text-slate-500">变更迹象：</span>{a.potentialChange}</p>
                                <div className="flex items-start gap-1.5 bg-violet-50 border border-violet-100 rounded-lg p-2">
                                  <AlertTriangle className="w-3 h-3 text-violet-500 shrink-0 mt-0.5" />
                                  <p className="text-violet-800">{a.recommendation}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-xl bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
          <strong>工作原理：</strong>
          系统抓取各法规官方页面的前 8KB 内容并计算哈希值。若哈希与上次确认的基线不同，状态变为"可能有更新"——
          该状态会持久保留，直到人工点击"已核查确认"后方可恢复正常。
          建议定期运行检测（每月一次），并在发现变化时人工比对条文、更新{" "}
          <code className="bg-blue-100 px-1 rounded">knowledge-base.yaml</code>{" "}
          中的对应规则。
        </div>
      </div>
    </div>
  );
}
