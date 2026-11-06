import crypto from "crypto";
import fs from "fs";
import https from "https";
import path from "path";
import yaml from "js-yaml";

// npc.gov.cn uses CFCA certificates not in Node.js's trust store
const NPC_AGENT = new https.Agent({ rejectUnauthorized: false });

export interface LegalSource {
  id: string;
  name_zh: string;
  url: string;
  effective_date: string;
  last_verified: string;
  url_hash: string;
  related_rules: string[];
  note_zh?: string;
}

export interface SourceStatus {
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

interface CacheEntry {
  baseline_hash: string;
  latest_hash: string;
  checked_at: string;
}

const SOURCES_PATH = path.join(
  process.cwd(),
  "knowledge-base",
  "legal-sources.yaml"
);

const CACHE_PATH = path.join(
  process.cwd(),
  "knowledge-base",
  "legal-update-cache.json"
);

export function loadSources(): LegalSource[] {
  const raw = fs.readFileSync(SOURCES_PATH, "utf-8");
  const data = yaml.load(raw) as { sources: LegalSource[] };
  return data.sources;
}

function loadCache(): Record<string, CacheEntry> {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")) as Record<
      string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any
    >;
    const migrated: Record<string, CacheEntry> = {};
    for (const [id, entry] of Object.entries(raw)) {
      if (entry.baseline_hash !== undefined) {
        migrated[id] = entry as CacheEntry;
      } else if (entry.hash !== undefined) {
        // Migrate old format: { hash, checked_at } → dual-hash format
        migrated[id] = {
          baseline_hash: entry.hash,
          latest_hash: entry.hash,
          checked_at: entry.checked_at,
        };
      }
    }
    return migrated;
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, CacheEntry>): void {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
}

function fetchTextInsecure(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        agent: NPC_AGENT,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PIPL-ComplianceTool/1.0; legal-tracker)",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
        timeout: 15000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => { if (data.length < 8192) data += chunk; });
        res.on("end", () => resolve(data));
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function fetchHash(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let text: string;
  try {
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; PIPL-ComplianceTool/1.0; legal-tracker)",
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Retry without SSL verification for hosts using untrusted CA certificates
      if (msg.includes("SSL") || msg.includes("certificate") || msg.includes("fetch failed")) {
        text = await fetchTextInsecure(url);
      } else {
        throw e;
      }
    }
  } finally {
    clearTimeout(timer);
  }
  // Hash first 8KB — captures title, date, and opening content
  return crypto
    .createHash("sha256")
    .update(text!.substring(0, 8192))
    .digest("hex")
    .substring(0, 16);
}

export async function checkAllSources(): Promise<SourceStatus[]> {
  const sources = loadSources();
  const cache = loadCache();
  const now = new Date().toISOString();

  const results = await Promise.allSettled(
    sources.map(async (src): Promise<SourceStatus> => {
      try {
        const hash = await fetchHash(src.url);
        const prev = cache[src.id];
        const isNew = !prev;
        const changed = prev && prev.baseline_hash !== hash;

        // Only update latest_hash — baseline_hash advances only via confirmSource()
        cache[src.id] = {
          baseline_hash: prev?.baseline_hash ?? hash,
          latest_hash: hash,
          checked_at: now,
        };

        return {
          id: src.id,
          name_zh: src.name_zh,
          url: src.url,
          effective_date: src.effective_date,
          related_rules: src.related_rules,
          note_zh: src.note_zh,
          status: isNew ? "pending" : changed ? "possibly_updated" : "current",
          last_verified: now,
          checked_at: now,
        };
      } catch (e) {
        return {
          id: src.id,
          name_zh: src.name_zh,
          url: src.url,
          effective_date: src.effective_date,
          related_rules: src.related_rules,
          note_zh: src.note_zh,
          status: "error",
          last_verified: cache[src.id]?.checked_at ?? "",
          checked_at: now,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    })
  );

  saveCache(cache);

  return results.map((r) => {
    if (r.status === "fulfilled") return r.value;
    return {
      id: "unknown",
      name_zh: "未知",
      url: "",
      effective_date: "",
      related_rules: [],
      status: "error" as const,
      last_verified: "",
      checked_at: now,
      error: String(r.reason),
    };
  });
}

export function getCachedStatuses(): SourceStatus[] {
  const sources = loadSources();
  const cache = loadCache();

  return sources.map((src) => {
    const cached = cache[src.id];
    if (!cached) {
      return {
        id: src.id,
        name_zh: src.name_zh,
        url: src.url,
        effective_date: src.effective_date,
        related_rules: src.related_rules,
        note_zh: src.note_zh,
        status: "pending" as const,
        last_verified: "",
        checked_at: "",
      };
    }
    const status: SourceStatus["status"] =
      cached.baseline_hash !== cached.latest_hash ? "possibly_updated" : "current";
    return {
      id: src.id,
      name_zh: src.name_zh,
      url: src.url,
      effective_date: src.effective_date,
      related_rules: src.related_rules,
      note_zh: src.note_zh,
      status,
      last_verified: cached.checked_at,
      checked_at: cached.checked_at,
    };
  });
}

/** 用户人工核查后确认，将 baseline_hash 推进到 latest_hash */
export function confirmSource(id: string): void {
  const cache = loadCache();
  if (cache[id]) {
    cache[id].baseline_hash = cache[id].latest_hash;
  }
  saveCache(cache);
}
