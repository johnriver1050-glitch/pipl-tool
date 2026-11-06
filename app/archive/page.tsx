"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ArrowLeft, Clock, RotateCcw, Trash2 } from "lucide-react";
import { loadArchive, deleteArchiveEntry, type ArchiveEntry } from "@/lib/archive";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

function formatDate(iso: string) {
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

export default function ArchivePage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);

  useEffect(() => {
    setEntries(loadArchive());
  }, []);

  function handleRestore(entry: ArchiveEntry) {
    sessionStorage.setItem(
      "pipl_session",
      JSON.stringify({ org: entry.org, activities: entry.activities, result: entry.result })
    );
    router.push("/report");
  }

  function handleDelete(id: string) {
    deleteArchiveEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">
              历史记录
            </p>
            <h1 className="text-xl font-bold text-slate-900">评估存档</h1>
            <p className="text-xs text-slate-500 mt-1">
              最多保存 20 条，恢复后可查看完整报告和下载文件
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回首页
          </Link>
        </div>

        {entries.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
              <Archive className="w-10 h-10 text-slate-300" />
              <p className="text-sm">暂无存档</p>
              <Link
                href="/questionnaire"
                className="text-blue-600 text-sm font-medium hover:underline"
              >
                开始合规评估 →
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const criticalCount = entry.result.obligations.filter(
                (o) => o.requiresSeparateConsent && o.requiresPIPIA
              ).length;
              const highCount = entry.result.obligations.filter(
                (o) =>
                  (o.requiresSeparateConsent || o.requiresPIPIA) &&
                  !(o.requiresSeparateConsent && o.requiresPIPIA)
              ).length;

              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl ring-1 ring-slate-200/80 shadow-sm p-4 flex items-start gap-4"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                    <Archive className="w-4 h-4 text-blue-400" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {entry.orgName}
                      </span>
                      {criticalCount > 0 && (
                        <Badge variant="orange">{criticalCount} 项须单独同意</Badge>
                      )}
                      {highCount > 0 && (
                        <Badge variant="purple">{highCount} 项须 PIPIA</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(entry.savedAt)}
                      </span>
                      <span>{entry.result.obligations.length} 条义务</span>
                      <span>{entry.activities.length} 个处理活动</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRestore(entry)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 font-medium hover:bg-blue-100 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      恢复
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pb-4">
          存档保存在浏览器本地，清除浏览器数据后将丢失
        </p>
      </div>
    </div>
  );
}
