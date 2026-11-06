"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Activity, FileText, Home, Archive, ScanSearch } from "lucide-react";

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-13 bg-slate-950 border-b border-slate-800/60">
      <div className="max-w-6xl mx-auto h-full flex items-center gap-6 px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-white font-semibold text-sm shrink-0"
        >
          <Shield className="w-4 h-4 text-blue-400" />
          PIPL 合规工具
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/" icon={<Home className="w-3.5 h-3.5" />} active={pathname === "/"}>
            首页
          </NavLink>
          <NavLink
            href="/questionnaire"
            icon={<FileText className="w-3.5 h-3.5" />}
            active={pathname.startsWith("/questionnaire") || pathname.startsWith("/report") || pathname.startsWith("/documents")}
          >
            合规评估
          </NavLink>
          <NavLink
            href="/archive"
            icon={<Archive className="w-3.5 h-3.5" />}
            active={pathname.startsWith("/archive")}
          >
            存档
          </NavLink>
          <NavLink
            href="/review"
            icon={<ScanSearch className="w-3.5 h-3.5" />}
            active={pathname.startsWith("/review")}
          >
            政策审查
          </NavLink>
          <NavLink
            href="/admin"
            icon={<Activity className="w-3.5 h-3.5" />}
            active={pathname.startsWith("/admin")}
          >
            法规追踪
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-xs text-blue-400 font-medium">
            知识库 v0.1.0
          </span>
          <span className="text-xs text-slate-600">29条规则 · 15部法规</span>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  icon,
  active,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? "bg-slate-700 text-white"
          : "text-slate-400 hover:text-white hover:bg-slate-800"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
