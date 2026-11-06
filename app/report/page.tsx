"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  ListChecks,
} from "lucide-react";
import type {
  EvaluationResult,
  Obligation,
  Organization,
  ProcessingActivity,
} from "@/lib/types";
import type { ComplianceCase } from "@/lib/cases/loader";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { saveToArchive } from "@/lib/archive";

type Session = {
  org: Organization;
  activities: ProcessingActivity[];
  result: EvaluationResult;
};

const MECHANISM_LABEL: Record<string, { label: string; desc: string }> = {
  security_assessment: {
    label: "国家安全评估（CAC）",
    desc: "须通过国家网信部门安全评估后方可跨境传输",
  },
  standard_contract: {
    label: "标准合同（SCCs）",
    desc: "签订标准合同并向省级网信部门备案",
  },
  certification: {
    label: "个人信息保护认证",
    desc: "通过国家认证机构的个人信息保护认证",
  },
  exempt: {
    label: "豁免",
    desc: "当前数量未达到机制触发阈值，仍需满足告知+单独同意",
  },
};

const NOTICE_ITEM_LABEL: Record<string, string> = {
  necessity: "处理必要性说明",
  impact_on_rights: "对个人权益的影响",
  automated_decision_logic: "自动化决策规则及逻辑",
  cross_border_recipient: "境外接收方信息及联系方式",
  minors_policy: "未成年人个人信息专项规则",
  rights_mechanism: "个人权利行使方式",
  sensitive_pi_necessity: "处理敏感信息的必要性及影响",
  face_recognition_alternatives: "人脸识别替代方案告知",
  retention_period: "保存期限",
  sharing_info: "共享接收方信息",
  entrust_info: "受托方信息",
  pipia_scope: "个人信息保护影响评估范围",
};

const REVIEW_STATUS_LABEL: Record<string, string> = {
  current: "已复核",
  needs_review: "待复核",
  draft: "草稿",
};

const REQUIREMENT_LEVEL_LABEL: Record<string, string> = {
  mandatory: "强制义务",
  recommended: "建议措施",
};

function obligationPriority(o: Obligation): "critical" | "high" | "base" {
  if (o.requiresSeparateConsent && o.requiresPIPIA) return "critical";
  if (o.requiresSeparateConsent || o.requiresPIPIA) return "high";
  return "base";
}

const PRIORITY_STYLE = {
  critical: {
    border: "border-l-red-500",
    dot: "bg-red-500",
    bg: "hover:bg-red-50/50",
    expandBg: "bg-red-50/40",
  },
  high: {
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    bg: "hover:bg-amber-50/50",
    expandBg: "bg-amber-50/40",
  },
  base: {
    border: "border-l-blue-400",
    dot: "bg-blue-400",
    bg: "hover:bg-blue-50/30",
    expandBg: "bg-blue-50/20",
  },
};

const CHECKLIST_KEY_PREFIX = "pipl_checklist_";

export default function ReportPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [completedCodes, setCompletedCodes] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState(false);
  const [allCases, setAllCases] = useState<ComplianceCase[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem("pipl_session");
    if (raw) {
      try {
        const s = JSON.parse(raw) as Session;
        setSession(s);
        const key = CHECKLIST_KEY_PREFIX + s.org.id;
        try {
          const saved = localStorage.getItem(key);
          if (saved) setCompletedCodes(new Set(JSON.parse(saved) as string[]));
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    }
    fetch("/api/cases")
      .then((r) => r.json())
      .then((d: { cases: ComplianceCase[] }) => setAllCases(d.cases))
      .catch(() => {});
  }, []);

  function toggleComplete(code: string) {
    if (!session) return;
    setCompletedCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      localStorage.setItem(
        CHECKLIST_KEY_PREFIX + session.org.id,
        JSON.stringify(Array.from(next))
      );
      return next;
    });
  }

  function handleArchive() {
    if (!session) return;
    saveToArchive(session.org, session.activities, session.result);
    setArchived(true);
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-500">
        <ShieldCheck className="w-10 h-10 text-slate-300" />
        <p className="text-sm">未找到评估数据</p>
        <Link href="/questionnaire" className="text-blue-600 text-sm font-medium hover:underline">
          重新填写问卷 →
        </Link>
      </div>
    );
  }

  const { org, result } = session;
  const critical = result.obligations.filter((o) => obligationPriority(o) === "critical");
  const high = result.obligations.filter((o) => obligationPriority(o) === "high");
  const base = result.obligations.filter((o) => obligationPriority(o) === "base");
  const sortedObligations = [...critical, ...high, ...base];

  const separateConsentCount = result.obligations.filter((o) => o.requiresSeparateConsent).length;
  const completedCount = sortedObligations.filter((o) => completedCodes.has(o.code)).length;
  const totalCount = sortedObligations.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const headerBadge =
    critical.length > 0
      ? { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "需立即处理" }
      : high.length > 0
      ? { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", label: "需关注" }
      : result.obligations.length === 0
      ? { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", label: "暂无义务" }
      : { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", label: "合规待办" };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">
              合规评估报告
            </p>
            <h1 className="text-xl font-bold text-slate-900">{org.name}</h1>
            <p className="text-xs text-slate-500 mt-1">{org.industry}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleArchive}
              disabled={archived}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                archived
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Archive className="w-3 h-3" />
              {archived ? "已存档" : "存入档案"}
            </button>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${headerBadge.bg} ${headerBadge.border} ${headerBadge.text}`}
            >
              <AlertTriangle className="w-3 h-3" />
              {headerBadge.label}
            </span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<ListChecks className="w-4 h-4" />}
            label="触发义务"
            value={result.obligations.length}
            color="blue"
          />
          <StatCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="须单独同意"
            value={separateConsentCount}
            color={critical.length > 0 ? "red" : "amber"}
          />
          <StatCard
            icon={<FileText className="w-4 h-4" />}
            label="需生成文件"
            value={result.requiredDocuments.length}
            color="slate"
          />
        </div>

        {/* Cross-border */}
        {result.crossBorderMechanism && (
          <Card>
            <CardHeader title="跨境传输合规机制" subtitle="基于企业规模与处理规模自动判定" />
            <div className="flex items-start gap-3 bg-blue-50 rounded-lg p-3 border border-blue-100">
              <Globe className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">
                  {MECHANISM_LABEL[result.crossBorderMechanism]?.label ?? result.crossBorderMechanism}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {MECHANISM_LABEL[result.crossBorderMechanism]?.desc}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Obligations + checklist */}
        <Card padding={false}>
          <div className="p-5 pb-4">
            <CardHeader
              title={`合规义务整改清单（${totalCount} 项）`}
              subtitle="勾选已完成项目，进度自动保存 · 点击行可展开触发原因"
            />
            {/* Progress bar */}
            {totalCount > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500">整改进度</span>
                  <span className={completedCount === totalCount ? "text-emerald-600 font-medium" : "text-slate-600"}>
                    {completedCount} / {totalCount} 项已完成
                    {completedCount === totalCount && " ✓"}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      progressPct === 100 ? "bg-emerald-500" : "bg-blue-500"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {totalCount === 0 ? (
            <div className="px-5 pb-5 flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              当前处理活动无触发义务
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedObligations.map((o) => {
                const matchedCases = allCases.filter((c) =>
                  c.related_rules.some((r) => o.ruleIds.includes(r))
                );
                return (
                  <ObligationRow
                    key={o.code}
                    obligation={o}
                    completed={completedCodes.has(o.code)}
                    onToggle={() => toggleComplete(o.code)}
                    cases={matchedCases}
                    orgName={org.name}
                  />
                );
              })}
            </div>
          )}
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <Link
            href="/questionnaire"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重新评估
          </Link>
          <Link
            href="/documents"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm text-white font-semibold hover:bg-blue-500 transition-colors shadow-sm shadow-blue-600/20"
          >
            生成合规文件
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">
          输出须经法律专业人士复核，不构成法律意见
        </p>
      </div>
    </div>
  );
}

function ObligationRow({
  obligation: o,
  completed,
  onToggle,
  cases,
  orgName,
}: {
  obligation: Obligation;
  completed: boolean;
  onToggle: () => void;
  cases: ComplianceCase[];
  orgName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  async function askQuestion() {
    if (!question.trim() || qaLoading) return;
    setQaLoading(true);
    setQaAnswer("");
    try {
      const res = await fetch("/api/llm/obligation-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          obligationCode: o.code,
          obligationTitle: o.titleZh,
          triggerReason: o.triggerReasonZh,
          source: o.source,
          orgName,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setQaAnswer(`错误：${err.error ?? "请求失败"}`);
        return;
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const payload = line.slice(6);
            if (payload === "[DONE]") break;
            try {
              const { text } = JSON.parse(payload) as { text: string };
              answer += text;
              setQaAnswer(answer);
            } catch { /* skip */ }
          }
        }
      }
    } finally {
      setQaLoading(false);
    }
  }

  const priority = obligationPriority(o);
  const style = PRIORITY_STYLE[priority];

  const hasDetail =
    o.triggerReasonZh ||
    o.source ||
    o.articleSummaryZh ||
    o.applicabilityZh ||
    o.exceptionsZh ||
    (o.actionItemsZh && o.actionItemsZh.length > 0) ||
    (o.evidenceExamplesZh && o.evidenceExamplesZh.length > 0) ||
    (o.noticeMustInclude && o.noticeMustInclude.length > 0) ||
    (o.grantsRights && o.grantsRights.length > 0) ||
    cases.length > 0;

  return (
    <div className={`border-l-4 ${style.border} ${completed ? "opacity-50" : ""} transition-opacity`}>
      <div className={`flex gap-2 px-4 py-3.5 ${style.bg} transition-colors`}>
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className="shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
          style={{
            borderColor: completed ? "#10b981" : "#cbd5e1",
            backgroundColor: completed ? "#10b981" : "transparent",
          }}
        >
          {completed && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10">
              <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${style.dot}`} />

        <button
          onClick={() => hasDetail && setExpanded((v) => !v)}
          className={`flex-1 text-left ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="font-mono text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
              {o.code}
            </span>
            {o.requiresSeparateConsent && <Badge variant="orange">需单独同意</Badge>}
            {o.requiresPIPIA && <Badge variant="purple">需 PIPIA</Badge>}
            {o.requirementLevel && (
              <Badge variant={o.requirementLevel === "mandatory" ? "red" : "blue"}>
                {REQUIREMENT_LEVEL_LABEL[o.requirementLevel] ?? o.requirementLevel}
              </Badge>
            )}
            {o.reviewStatus && o.reviewStatus !== "current" && (
              <Badge variant="orange">
                {REVIEW_STATUS_LABEL[o.reviewStatus] ?? o.reviewStatus}
              </Badge>
            )}
            {o.grantsRights && o.grantsRights.length > 0 && (
              <Badge variant="teal">{o.grantsRights.length} 项权利</Badge>
            )}
          </div>
          <p className={`text-xs leading-relaxed ${completed ? "line-through text-slate-400" : "text-slate-700"}`}>
            {o.titleZh}
          </p>
        </button>

        {hasDetail && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-slate-400 shrink-0 mt-0.5"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>

      {expanded && hasDetail && (
        <div className={`px-5 pb-4 pt-2 space-y-2.5 text-xs ${style.expandBg}`}>
          {o.triggerReasonZh && (
            <div>
              <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">触发条件</span>
              <p className="text-slate-700 mt-0.5">{o.triggerReasonZh}</p>
            </div>
          )}
          {o.source && (
            <div>
              <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">法规来源</span>
              <p className="text-slate-700 mt-0.5">
                {o.source}
                {o.effectiveDate && <span className="text-slate-400 ml-2">（{o.effectiveDate} 施行）</span>}
              </p>
            </div>
          )}
          {(o.reviewStatus || o.requirementLevel) && (
            <div>
              <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">规则状态</span>
              <p className="text-slate-700 mt-0.5">
                {o.requirementLevel && (REQUIREMENT_LEVEL_LABEL[o.requirementLevel] ?? o.requirementLevel)}
                {o.requirementLevel && o.reviewStatus && " · "}
                {o.reviewStatus && (REVIEW_STATUS_LABEL[o.reviewStatus] ?? o.reviewStatus)}
              </p>
            </div>
          )}
          {o.articleSummaryZh && (
            <div>
              <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">条文摘要</span>
              <p className="text-slate-700 mt-0.5">{o.articleSummaryZh}</p>
            </div>
          )}
          {o.applicabilityZh && (
            <div>
              <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">适用说明</span>
              <p className="text-slate-700 mt-0.5">{o.applicabilityZh}</p>
            </div>
          )}
          {o.exceptionsZh && (
            <div>
              <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">例外或注意事项</span>
              <p className="text-slate-700 mt-0.5">{o.exceptionsZh}</p>
            </div>
          )}
          {o.actionItemsZh && o.actionItemsZh.length > 0 && (
            <div>
              <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">建议动作</span>
              <ul className="mt-0.5 space-y-0.5">
                {o.actionItemsZh.map((item) => (
                  <li key={item} className="text-slate-700 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {o.evidenceExamplesZh && o.evidenceExamplesZh.length > 0 && (
            <div>
              <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">留存材料示例</span>
              <ul className="mt-0.5 space-y-0.5">
                {o.evidenceExamplesZh.map((item) => (
                  <li key={item} className="text-slate-700 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {o.noticeMustInclude && o.noticeMustInclude.length > 0 && (
            <div>
              <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">须在隐私政策中说明</span>
              <ul className="mt-0.5 space-y-0.5">
                {o.noticeMustInclude.map((item) => (
                  <li key={item} className="text-slate-700 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                    {NOTICE_ITEM_LABEL[item] ?? item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {o.grantsRights && o.grantsRights.length > 0 && (
            <div>
              <span className="font-medium text-slate-500 uppercase tracking-wide text-[10px]">须保障的个人权利</span>
              <p className="text-slate-700 mt-0.5">{o.grantsRights.join("、")}</p>
            </div>
          )}
          {/* AI Q&A */}
          <div className="mt-1 pt-2.5 border-t border-slate-200/60">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-violet-500" />
              <span className="font-medium text-violet-600 uppercase tracking-wide text-[10px]">AI 问答</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askQuestion()}
                placeholder="针对此义务提问，例如：触发门槛是多少？"
                className="flex-1 text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400"
              />
              <button
                onClick={askQuestion}
                disabled={qaLoading || !question.trim()}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs text-white font-medium hover:bg-violet-700 disabled:opacity-40 transition-colors"
              >
                {qaLoading ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-3 h-3" />}
              </button>
            </div>
            {qaAnswer && (
              <div className="mt-2 bg-violet-50 border border-violet-100 rounded-lg p-2.5 text-xs text-violet-900 leading-relaxed whitespace-pre-wrap">
                {qaAnswer}
              </div>
            )}
          </div>

          {cases.length > 0 && (
            <div className="mt-1">
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen className="w-3 h-3 text-rose-500" />
                <span className="font-medium text-rose-600 uppercase tracking-wide text-[10px]">
                  典型执法案例（{cases.length} 件）
                </span>
              </div>
              <div className="space-y-2">
                {cases.map((c) => (
                  <div key={c.id} className="bg-white/70 border border-rose-100 rounded-lg p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-800 text-[11px] leading-snug flex-1">{c.title}</p>
                      <a
                        href={c.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 text-slate-400 hover:text-blue-500 transition-colors mt-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                        {c.regulator}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                        {c.date}
                      </span>
                      {c.penalty && (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-50 border border-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 font-medium">
                          {c.penalty.length > 30 ? c.penalty.slice(0, 30) + "…" : c.penalty}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed border-l-2 border-rose-200 pl-2">
                      {c.lesson.trim()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "red" | "amber" | "green" | "slate";
}) {
  const styles = {
    blue: "bg-blue-600 text-white",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    slate: "bg-white text-slate-700 ring-1 ring-slate-200",
  };
  const iconStyles = {
    blue: "text-blue-200",
    red: "text-red-400",
    amber: "text-amber-400",
    green: "text-emerald-400",
    slate: "text-slate-400",
  };

  return (
    <div className={`rounded-xl p-4 flex flex-col gap-2 shadow-sm ${styles[color]}`}>
      <span className={iconStyles[color]}>{icon}</span>
      <div>
        <span className="text-2xl font-bold leading-none">{value}</span>
        <p className="text-xs mt-1 opacity-80">{label}</p>
      </div>
    </div>
  );
}
