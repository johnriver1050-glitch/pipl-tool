"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type {
  DocumentType,
  EvaluationResult,
  Organization,
  ProcessingActivity,
} from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";

type Session = {
  org: Organization;
  activities: ProcessingActivity[];
  result: EvaluationResult;
};

interface DocMeta {
  label: string;
  desc: string;
  exportable: boolean;
  exportKey: string;
}

const DOC_META: Record<string, DocMeta> = {
  privacy_policy: {
    label: "隐私政策草稿",
    desc: "包含处理目的、方式、类型、保存期限、权利行使方式等法定告知要素",
    exportable: true,
    exportKey: "privacy_policy",
  },
  pi_collection_list: {
    label: "个人信息收集清单",
    desc: "按处理目的列明收集的个人信息类型、法律依据及保存期限",
    exportable: true,
    exportKey: "pi_collection_list",
  },
  sharing_list: {
    label: "个人信息共享与委托处理清单",
    desc: "列明接收方身份、联系方式、共享目的及所涉个人信息类型",
    exportable: true,
    exportKey: "sharing_list",
  },
  separate_consent: {
    label: "单独同意授权书",
    desc: "针对敏感个人信息、人脸识别、第三方共享等场景的独立同意文件",
    exportable: true,
    exportKey: "separate_consent",
  },
  crossborder_notice: {
    label: "跨境传输告知书",
    desc: "告知境外接收方信息、传输目的、权利行使方式，含单独同意条款",
    exportable: true,
    exportKey: "crossborder_notice",
  },
  pipia_report: {
    label: "个人信息保护影响评估报告（PIPIA）",
    desc: "高风险处理活动上线前须完成的合规评估，含风险识别框架与控制措施清单",
    exportable: true,
    exportKey: "pipia_report",
  },
  gap_report: {
    label: "差距分析报告",
    desc: "对比现有合规状态与法规要求，列明待整改事项及优先级",
    exportable: true,
    exportKey: "gap_report",
  },
};

export default function DocumentsPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("pipl_session");
    if (raw) setSession(JSON.parse(raw));
  }, []);

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-slate-500">
        <ShieldCheck className="w-10 h-10 text-slate-300" />
        <p className="text-sm">未找到评估数据</p>
        <Link
          href="/questionnaire"
          className="text-blue-600 text-sm font-medium hover:underline"
        >
          返回问卷 →
        </Link>
      </div>
    );
  }

  const { org, activities, result } = session;
  const hasCrossBorder = activities.some((a) => a.crossBorder !== null);

  const requiredSet = new Set<string>(result.requiredDocuments);
  // Always show gap_report as exportable
  const allDocs = [...result.requiredDocuments];
  if (!allDocs.includes("gap_report" as DocumentType)) {
    allDocs.unshift("gap_report" as DocumentType);
  }

  async function download(docType: string) {
    if (!session) return;
    if (docType === "crossborder_notice" && !hasCrossBorder) return;
    setDownloading(docType);
    setDlError(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType,
          org: session.org,
          activities: session.activities,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disp = res.headers.get("Content-Disposition") ?? "";
      const match = disp.match(/filename\*=UTF-8''(.+)/);
      a.download = match ? decodeURIComponent(match[1]) : `${docType}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDlError(e instanceof Error ? e.message : "下载失败");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">
            合规文件
          </p>
          <h1 className="text-xl font-bold text-slate-900">{org.name}</h1>
          <p className="text-xs text-slate-500 mt-1">
            引擎识别需生成 {result.requiredDocuments.length} 份文件
          </p>
        </div>

        {/* Doc cards */}
        <Card padding={false}>
          <div className="p-5 pb-3">
            <CardHeader
              title="合规文件清单"
              subtitle="绿色打钩为系统建议生成，标注「可导出」的文件支持直接下载 Word 草稿"
            />
          </div>
          <div className="divide-y divide-slate-100">
            {allDocs.map((docType) => {
              const meta = DOC_META[docType] ?? {
                label: docType,
                desc: "",
                exportable: false,
                exportKey: docType,
              };
              const isRequired = requiredSet.has(docType);
              const canDownload =
                meta.exportable &&
                (docType !== "crossborder_notice" || hasCrossBorder);

              return (
                <div
                  key={docType}
                  className="flex items-start gap-4 px-5 py-4"
                >
                  {/* File icon */}
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isRequired
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-sm font-medium text-slate-800">
                        {meta.label}
                      </span>
                      {isRequired && (
                        <Badge variant="green">
                          <CheckCircle2 className="w-3 h-3" />
                          建议生成
                        </Badge>
                      )}
                      {canDownload && (
                        <Badge variant="blue">可导出</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {meta.desc}
                    </p>
                  </div>

                  {canDownload && (
                    <button
                      onClick={() => download(meta.exportKey)}
                      disabled={downloading === meta.exportKey}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 font-medium hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {downloading === meta.exportKey ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      {downloading === meta.exportKey ? "生成中…" : ".docx"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {dlError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {dlError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <Link
            href="/report"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回报告
          </Link>
          <Link
            href="/questionnaire"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重新评估
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400 pb-4">
          文件草稿须经法律专业人士复核后使用
        </p>
      </div>
    </div>
  );
}
