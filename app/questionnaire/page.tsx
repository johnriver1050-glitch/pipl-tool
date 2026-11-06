"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, ChevronDown, ChevronLeft, ChevronRight,
  Copy, Layers, Loader2, Plus, Save, Trash2,
} from "lucide-react";
import type { Organization, ProcessingActivity, LegalBasis } from "@/lib/types";

const LEGAL_BASIS_OPTIONS: { value: LegalBasis; label: string }[] = [
  { value: "consent", label: "当事人同意（第13条第（一）项）" },
  { value: "contract", label: "合同履行 / 人力资源管理（第13条第（二）项）" },
  { value: "legal_obligation", label: "履行法定职责或义务（第13条第（三）项）" },
  { value: "emergency", label: "突发公共卫生事件或紧急情况（第13条第（四）项）" },
  { value: "public_interest_news", label: "新闻报道或公共利益（第13条第（五）项）" },
  { value: "publicly_disclosed", label: "当事人自行公开的信息（第13条第（六）项）" },
  { value: "other_statutory", label: "法律法规另有规定" },
];

type OrgDraft = {
  name: string; industry: string;
  isCIIO: boolean; handlesImportantData: boolean;
  isOverseasEntity: boolean; hasDomesticRepresentative: boolean;
  piSubjectsCumulative: string; sensitivePiSubjectsCumulative: string;
  providesAlgorithmRecommendation: boolean;
  providesDeepSynthesis: boolean; providesGenerativeAI: boolean;
};

type ActivityDraft = {
  purpose: string; piTypes: string;
  involvesSensitivePi: boolean; involvesMinorsUnder14: boolean;
  involvesFaceRecognition: boolean; legalBasis: LegalBasis;
  retentionPeriod: string; isAutomatedDecisionMaking: boolean;
  isPublicDisclosure: boolean; hasSharing: boolean;
  sharingName: string; sharingPurpose: string; sharingIsOverseas: boolean;
  hasCrossBorder: boolean; crossCountry: string;
  crossRecipientName: string; crossRecipientContact: string;
  crossPurpose: string; crossPiTypes: string; crossRightsMethod: string;
};

const defaultOrg: OrgDraft = {
  name: "", industry: "",
  isCIIO: false, handlesImportantData: false,
  isOverseasEntity: false, hasDomesticRepresentative: false,
  piSubjectsCumulative: "0", sensitivePiSubjectsCumulative: "0",
  providesAlgorithmRecommendation: false,
  providesDeepSynthesis: false, providesGenerativeAI: false,
};

const defaultActivity: ActivityDraft = {
  purpose: "", piTypes: "",
  involvesSensitivePi: false, involvesMinorsUnder14: false,
  involvesFaceRecognition: false, legalBasis: "consent",
  retentionPeriod: "", isAutomatedDecisionMaking: false,
  isPublicDisclosure: false, hasSharing: false,
  sharingName: "", sharingPurpose: "", sharingIsOverseas: false,
  hasCrossBorder: false, crossCountry: "",
  crossRecipientName: "", crossRecipientContact: "",
  crossPurpose: "", crossPiTypes: "", crossRightsMethod: "联系数据保护负责人",
};

const DRAFT_KEY = "pipl_draft";

function labelClass() { return "block text-sm font-medium text-slate-700 mb-1"; }
function inputClass() {
  return "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
}
function checkRow(label: string, checked: boolean, onChange: (v: boolean) => void) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-blue-600" />
      {label}
    </label>
  );
}

type ThresholdHint = { text: string; color: "red" | "amber" | "slate" };
function getThresholdHint(piStr: string, sensitiveStr: string, isCIIO: boolean, handlesImportantData: boolean): ThresholdHint | null {
  const pi = parseInt(piStr) || 0;
  const sensitive = parseInt(sensitiveStr) || 0;
  if (isCIIO || handlesImportantData)
    return { text: "CIIO / 重要数据处理者：所有跨境传输须通过国家安全评估", color: "red" };
  if (pi > 1_000_000 || sensitive > 10_000)
    return { text: "已超阈值（普通 > 100万 或 敏感 > 1万）：跨境传输须通过国家安全评估，且须指定个人信息保护负责人", color: "red" };
  if (pi > 100_000 || sensitive > 1_000)
    return { text: "已超阈值（普通 > 10万 或 敏感 > 1千）：如有跨境传输，须签订标准合同（或完成认证）并备案", color: "amber" };
  if (pi > 0 || sensitive > 0)
    return { text: "低于跨境传输机制触发阈值，如有跨境仍须满足告知义务与单独同意", color: "slate" };
  return null;
}
const HINT_STYLE: Record<string, string> = {
  red: "bg-red-50 border-red-200 text-red-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  slate: "bg-slate-50 border-slate-200 text-slate-500",
};

// ── 单条活动表单 ──────────────────────────────────────────────────────────────

function ActivityForm({
  index, act, total,
  onChange, onRemove, onCopy,
}: {
  index: number;
  act: ActivityDraft;
  total: number;
  onChange: (k: keyof ActivityDraft, v: ActivityDraft[keyof ActivityDraft]) => void;
  onRemove: () => void;
  onCopy: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const label = act.purpose.trim() || `处理活动 ${index + 1}`;

  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200/80 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="text-xs font-medium text-slate-400 tabular-nums w-5 shrink-0">
            {index + 1}.
          </span>
          <span className="text-sm font-medium text-slate-800 truncate">{label}</span>
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        </button>
        <button onClick={onCopy} title="复制此活动"
          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
          <Copy className="w-3.5 h-3.5" />
        </button>
        {total > 1 && (
          <button onClick={onRemove} title="删除此活动"
            className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="p-5 space-y-4">
          <div>
            <label className={labelClass()}>处理目的 *</label>
            <input className={inputClass()} value={act.purpose}
              onChange={(e) => onChange("purpose", e.target.value)}
              placeholder="例：用户账户注册与身份核验" />
          </div>

          <div>
            <label className={labelClass()}>处理的个人信息类型（逗号分隔）*</label>
            <input className={inputClass()} value={act.piTypes}
              onChange={(e) => onChange("piTypes", e.target.value)}
              placeholder="例：姓名, 手机号, 身份证号" />
          </div>

          <div>
            <label className={labelClass()}>处理法律依据 *</label>
            <select className={inputClass()} value={act.legalBasis}
              onChange={(e) => onChange("legalBasis", e.target.value as LegalBasis)}>
              {LEGAL_BASIS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass()}>保存期限</label>
            <input className={inputClass()} value={act.retentionPeriod}
              onChange={(e) => onChange("retentionPeriod", e.target.value)}
              placeholder="例：注销账户后30天删除" />
          </div>

          <div className="space-y-2 pt-1">
            {checkRow("涉及敏感个人信息", act.involvesSensitivePi,
              (v) => onChange("involvesSensitivePi", v))}
            {checkRow("涉及不满14周岁未成年人", act.involvesMinorsUnder14,
              (v) => onChange("involvesMinorsUnder14", v))}
            {checkRow("涉及人脸识别（《人脸识别技术应用安全管理办法》2025-06-01施行）",
              act.involvesFaceRecognition,
              (v) => {
                onChange("involvesFaceRecognition", v);
                if (v) onChange("involvesSensitivePi", true);
              })}
            {act.involvesFaceRecognition && (
              <p className="ml-6 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                人脸信息属于生物识别敏感个人信息，已自动勾选"涉及敏感个人信息"
              </p>
            )}
            {checkRow("利用个人信息进行自动化决策", act.isAutomatedDecisionMaking,
              (v) => onChange("isAutomatedDecisionMaking", v))}
            {checkRow("对外公开披露个人信息", act.isPublicDisclosure,
              (v) => onChange("isPublicDisclosure", v))}
          </div>

          {/* Sharing */}
          <div className="space-y-3">
            {checkRow("向第三方共享个人信息", act.hasSharing,
              (v) => onChange("hasSharing", v))}
            {act.hasSharing && (
              <div className="ml-6 space-y-2 border-l-2 border-slate-100 pl-4">
                <div>
                  <label className={labelClass()}>接收方名称</label>
                  <input className={inputClass()} value={act.sharingName}
                    onChange={(e) => onChange("sharingName", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass()}>共享目的</label>
                  <input className={inputClass()} value={act.sharingPurpose}
                    onChange={(e) => onChange("sharingPurpose", e.target.value)} />
                </div>
                {checkRow("接收方为境外机构", act.sharingIsOverseas, (v) => {
                  onChange("sharingIsOverseas", v);
                  if (v) onChange("hasCrossBorder", true);
                })}
              </div>
            )}
          </div>

          {/* Cross-border */}
          <div className="space-y-3">
            {checkRow("存在跨境数据传输（向境外提供个人信息）", act.hasCrossBorder,
              (v) => onChange("hasCrossBorder", v))}
            {act.hasCrossBorder && (
              <div className="ml-6 space-y-2 border-l-2 border-slate-100 pl-4">
                <div>
                  <label className={labelClass()}>接收方所在国家/地区</label>
                  <input className={inputClass()} value={act.crossCountry}
                    onChange={(e) => onChange("crossCountry", e.target.value)}
                    placeholder="例：美国" />
                </div>
                <div>
                  <label className={labelClass()}>境外接收方名称</label>
                  <input className={inputClass()} value={act.crossRecipientName}
                    onChange={(e) => onChange("crossRecipientName", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass()}>接收方联系方式</label>
                  <input className={inputClass()} value={act.crossRecipientContact}
                    onChange={(e) => onChange("crossRecipientContact", e.target.value)}
                    placeholder="例：privacy@example.com" />
                </div>
                <div>
                  <label className={labelClass()}>跨境传输的个人信息类型（逗号分隔，留空同上）</label>
                  <input className={inputClass()} value={act.crossPiTypes}
                    onChange={(e) => onChange("crossPiTypes", e.target.value)}
                    placeholder="留空则与上方处理类型相同" />
                </div>
                <div>
                  <label className={labelClass()}>当事人行使权利的方式</label>
                  <input className={inputClass()} value={act.crossRightsMethod}
                    onChange={(e) => onChange("crossRightsMethod", e.target.value)} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function QuestionnairePage() {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [org, setOrg] = useState<OrgDraft>(defaultOrg);
  const [acts, setActs] = useState<ActivityDraft[]>([{ ...defaultActivity }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const { org: savedOrg, acts: savedActs } = JSON.parse(saved);
        if (savedOrg) setOrg(savedOrg);
        if (Array.isArray(savedActs) && savedActs.length > 0) setActs(savedActs);
        setDraftRestored(true);
      }
    } catch { /* ignore */ }
  }, []);

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ org, acts }));
      setDraftSavedAt(new Date());
    }, 600);
    return () => clearTimeout(timer);
  }, [org, acts]);

  function setOrgField<K extends keyof OrgDraft>(k: K, v: OrgDraft[K]) {
    setOrg((prev) => ({ ...prev, [k]: v }));
  }

  function updateAct(index: number, k: keyof ActivityDraft, v: ActivityDraft[keyof ActivityDraft]) {
    setActs((prev) => prev.map((a, i) => i === index ? { ...a, [k]: v } : a));
  }

  function addActivity() {
    setActs((prev) => [...prev, { ...defaultActivity }]);
  }

  function removeActivity(index: number) {
    setActs((prev) => prev.filter((_, i) => i !== index));
  }

  function copyActivity(index: number) {
    setActs((prev) => [
      ...prev.slice(0, index + 1),
      { ...prev[index], purpose: prev[index].purpose ? `${prev[index].purpose}（副本）` : "" },
      ...prev.slice(index + 1),
    ]);
  }

  function draftToActivity(act: ActivityDraft): ProcessingActivity {
    return {
      id: crypto.randomUUID(),
      purpose: act.purpose,
      piTypes: act.piTypes.split(",").map((s) => s.trim()).filter(Boolean),
      involvesSensitivePi: act.involvesSensitivePi,
      involvesMinorsUnder14: act.involvesMinorsUnder14,
      involvesFaceRecognition: act.involvesFaceRecognition,
      legalBasis: act.legalBasis,
      retentionPeriod: act.retentionPeriod,
      isAutomatedDecisionMaking: act.isAutomatedDecisionMaking,
      isPublicDisclosure: act.isPublicDisclosure,
      sharing: act.hasSharing
        ? [{ name: act.sharingName, isOverseas: act.sharingIsOverseas, purpose: act.sharingPurpose,
            piTypes: act.piTypes.split(",").map((s) => s.trim()).filter(Boolean) }]
        : [],
      entrusting: [],
      crossBorder: act.hasCrossBorder
        ? {
            recipientCountry: act.crossCountry,
            recipientName: act.crossRecipientName,
            recipientContact: act.crossRecipientContact,
            purpose: act.crossPurpose || act.purpose,
            piTypes: act.crossPiTypes.trim()
              ? act.crossPiTypes.split(",").map((s) => s.trim()).filter(Boolean)
              : act.piTypes.split(",").map((s) => s.trim()).filter(Boolean),
            rightsMethod: act.crossRightsMethod,
          }
        : null,
    };
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const orgData: Organization = {
        id: crypto.randomUUID(),
        name: org.name, industry: org.industry,
        isCIIO: org.isCIIO, handlesImportantData: org.handlesImportantData,
        isOverseasEntity: org.isOverseasEntity,
        hasDomesticRepresentative: org.hasDomesticRepresentative,
        piSubjectsCumulative: parseInt(org.piSubjectsCumulative) || 0,
        sensitivePiSubjectsCumulative: parseInt(org.sensitivePiSubjectsCumulative) || 0,
        providesAlgorithmRecommendation: org.providesAlgorithmRecommendation,
        providesDeepSynthesis: org.providesDeepSynthesis,
        providesGenerativeAI: org.providesGenerativeAI,
      };
      const activities = acts.map(draftToActivity);

      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org: orgData, activities }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();

      sessionStorage.setItem("pipl_session", JSON.stringify({ org: orgData, activities, result }));
      localStorage.removeItem(DRAFT_KEY);
      router.push("/report");
    } catch (e) {
      setError(e instanceof Error ? e.message : "评估请求失败");
    } finally {
      setSubmitting(false);
    }
  }

  const thresholdHint = getThresholdHint(
    org.piSubjectsCumulative, org.sensitivePiSubjectsCumulative,
    org.isCIIO, org.handlesImportantData
  );

  const canSubmit = acts.some((a) => a.purpose.trim() && a.piTypes.trim());

  const STEPS = [
    { label: "企业基本信息", icon: <Building2 className="w-4 h-4" /> },
    { label: `处理活动（${acts.length} 条）`, icon: <Layers className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">合规评估问卷</p>
            <h1 className="text-xl font-bold text-slate-900">填写企业信息</h1>
          </div>
          {(draftRestored || draftSavedAt) && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <Save className="w-3 h-3" />
              {draftRestored ? "草稿已恢复" : "已自动保存"}
            </span>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i as 0 | 1)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  step === i ? "bg-blue-600 text-white shadow-sm"
                    : i < step ? "bg-blue-50 text-blue-700 cursor-pointer hover:bg-blue-100"
                    : "text-slate-400 cursor-default"
                }`}
              >
                {s.icon}
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 0 — 企业信息 */}
        {step === 0 && (
          <div className="bg-white rounded-xl ring-1 ring-slate-200/80 shadow-sm p-6 space-y-5">
            <h2 className="font-semibold text-slate-800">企业基本信息</h2>

            <div>
              <label className={labelClass()}>企业名称 *</label>
              <input className={inputClass()} value={org.name}
                onChange={(e) => setOrgField("name", e.target.value)}
                placeholder="例：某某科技有限公司" />
            </div>

            <div>
              <label className={labelClass()}>所属行业</label>
              <input className={inputClass()} value={org.industry}
                onChange={(e) => setOrgField("industry", e.target.value)}
                placeholder="例：互联网、金融、医疗" />
            </div>

            <div>
              <label className={labelClass()}>本年度累计处理个人信息人次（自然人数）</label>
              <input type="number" className={inputClass()} value={org.piSubjectsCumulative}
                onChange={(e) => setOrgField("piSubjectsCumulative", e.target.value)} min="0" />
            </div>

            <div>
              <label className={labelClass()}>本年度累计处理敏感个人信息人次</label>
              <input type="number" className={inputClass()} value={org.sensitivePiSubjectsCumulative}
                onChange={(e) => setOrgField("sensitivePiSubjectsCumulative", e.target.value)} min="0" />
            </div>

            {thresholdHint && (
              <div className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${HINT_STYLE[thresholdHint.color]}`}>
                {thresholdHint.text}
              </div>
            )}

            <div className="space-y-2 pt-1">
              {checkRow("关键信息基础设施运营者（CIIO）", org.isCIIO, (v) => setOrgField("isCIIO", v))}
              {checkRow("处理重要数据", org.handlesImportantData, (v) => setOrgField("handlesImportantData", v))}
              {checkRow("境外主体（在境外处理中国境内自然人个人信息）", org.isOverseasEntity, (v) => setOrgField("isOverseasEntity", v))}
              {org.isOverseasEntity && checkRow("已在境内设立专门机构或指定代表", org.hasDomesticRepresentative, (v) => setOrgField("hasDomesticRepresentative", v))}
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">新兴技术服务</p>
              {checkRow("提供算法推荐服务（《算法推荐管理规定》）", org.providesAlgorithmRecommendation, (v) => setOrgField("providesAlgorithmRecommendation", v))}
              {checkRow("提供深度合成服务（AI换脸/声音克隆等）", org.providesDeepSynthesis, (v) => setOrgField("providesDeepSynthesis", v))}
              {checkRow("提供生成式AI服务（《生成式AI管理办法》）", org.providesGenerativeAI, (v) => setOrgField("providesGenerativeAI", v))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setStep(1)}
                disabled={!org.name.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm text-white font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors shadow-sm"
              >
                下一步 <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — 处理活动列表 */}
        {step === 1 && (
          <div className="space-y-4">
            {acts.map((act, index) => (
              <ActivityForm
                key={index}
                index={index}
                act={act}
                total={acts.length}
                onChange={(k, v) => updateAct(index, k, v)}
                onRemove={() => removeActivity(index)}
                onCopy={() => copyActivity(index)}
              />
            ))}

            {/* 新增按钮 */}
            <button
              onClick={addActivity}
              className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增处理活动
            </button>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex justify-between pt-1">
              <button
                onClick={() => setStep(0)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> 上一步
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm text-white font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors shadow-sm"
              >
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />评估中…</>
                  : <>提交 {acts.length} 条活动评估 <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
