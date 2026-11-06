"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Organization, ProcessingActivity } from "@/lib/types";

const org: Organization = {
  id: "demo-xinghe", name: "星禾生活（虚构演示企业）", industry: "生活服务电商",
  isOverseasEntity: false, hasDomesticRepresentative: false, isCIIO: false,
  handlesImportantData: false, piSubjectsCumulative: 120000, sensitivePiSubjectsCumulative: 200,
  providesAlgorithmRecommendation: false, providesDeepSynthesis: false, providesGenerativeAI: false,
};
const activities: ProcessingActivity[] = [{
  id: "demo-orders", purpose: "订单配送与售后服务", piTypes: ["姓名", "手机号", "收货地址"],
  involvesSensitivePi: false, involvesMinorsUnder14: false, involvesFaceRecognition: false,
  legalBasis: "contract", retentionPeriod: "订单完成后三年（示例，需复核）",
  isAutomatedDecisionMaking: false, isPublicDisclosure: false, crossBorder: null,
  sharing: [{ name: "示例配送服务商", isOverseas: false, purpose: "配送订单", piTypes: ["姓名", "手机号", "收货地址"] }],
  entrusting: [],
}, {
  id: "demo-members", purpose: "会员健康偏好服务", piTypes: ["姓名", "健康信息"],
  involvesSensitivePi: true, involvesMinorsUnder14: false, involvesFaceRecognition: false,
  legalBasis: "consent", retentionPeriod: "会员主动删除或注销账户时删除（示例）",
  isAutomatedDecisionMaking: false, isPublicDisclosure: false, crossBorder: null,
  sharing: [], entrusting: [],
}];

export function DemoStart() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ org, activities }) });
      if (!res.ok) throw new Error("演示数据加载失败，请重试");
      const result = await res.json();
      sessionStorage.setItem("pipl_session", JSON.stringify({ org, activities, result }));
      router.push("/report");
    } catch (e) { setError(e instanceof Error ? e.message : "无法打开演示"); setBusy(false); }
  }
  return <div className="mt-6 text-center">
    <button onClick={start} disabled={busy} className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-blue-50 disabled:opacity-50">{busy ? "正在生成报告…" : "一键体验 · 虚构企业示例 →"}</button>
    <p className="mt-3 text-sm text-slate-400">无需填写资料，直接查看义务识别、整改清单与文件导出</p>
    {error && <p role="alert" className="mt-2 text-red-300">{error}</p>}
  </div>;
}
