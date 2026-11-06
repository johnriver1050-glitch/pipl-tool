import Link from "next/link";
import { ArrowRight, Shield, BookOpen, Activity, FileCheck } from "lucide-react";

const STATS = [
  { label: "覆盖法规", value: "15", unit: "部" },
  { label: "合规规则", value: "29", unit: "条" },
  { label: "可生成文件", value: "6", unit: "类" },
  { label: "跨境机制", value: "3", unit: "种" },
];

const FEATURES = [
  {
    icon: <FileCheck className="w-5 h-5 text-blue-400" />,
    title: "自动义务识别",
    desc: "根据企业特征与处理活动，自动匹配 PIPL、DSL、网安法等 27 条规则，生成专属义务清单。",
  },
  {
    icon: <BookOpen className="w-5 h-5 text-blue-400" />,
    title: "13 部法规覆盖",
    desc: "从 PIPL 核心条款到人脸识别、出境认证、算法推荐——含 2025/2026 年最新施行的法规。",
  },
  {
    icon: <Activity className="w-5 h-5 text-blue-400" />,
    title: "法规更新追踪",
    desc: "自动监测各官方页面内容哈希变化，第一时间发现法规修订，保持知识库与监管动态同步。",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 px-6 pt-24 pb-20">
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/20 rounded-full blur-[80px]" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-500/20 px-4 py-1.5 mb-6">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-blue-300 font-medium">
              个人信息保护法合规工具
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight tracking-tight mb-4">
            让 PIPL 合规
            <br />
            <span className="text-blue-400">清晰可执行</span>
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed max-w-xl mx-auto mb-8">
            填写一份问卷，自动识别企业适用的合规义务，生成隐私政策、单独同意书、PIPIA
            报告等合规文件草稿。
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/questionnaire"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3 text-sm text-white font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
            >
              开始合规评估
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-6 py-3 text-sm text-slate-300 font-medium hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Activity className="w-4 h-4" />
              法规更新追踪
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-6 py-4 grid grid-cols-4 divide-x divide-slate-800">
          {STATS.map((s) => (
            <div key={s.label} className="text-center px-4 py-1">
              <p className="text-2xl font-bold text-white">
                {s.value}
                <span className="text-sm text-slate-400 font-normal ml-0.5">
                  {s.unit}
                </span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-xl ring-1 ring-slate-200/80 shadow-sm p-5"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-slate-900 text-sm mb-2">
                {f.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer disclaimer */}
      <footer className="border-t border-slate-200 py-6 px-6">
        <p className="text-center text-xs text-slate-400">
          输出结果为合规起草辅助，不构成法律意见，须经法律专业人士复核后使用。
        </p>
      </footer>
    </div>
  );
}
