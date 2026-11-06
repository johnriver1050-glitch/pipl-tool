import type { Organization, ProcessingActivity, EvaluationResult } from "./types";

export interface ArchiveEntry {
  id: string;
  savedAt: string;
  orgName: string;
  org: Organization;
  activities: ProcessingActivity[];
  result: EvaluationResult;
}

const ARCHIVE_KEY = "pipl_archive";
const MAX_ENTRIES = 20;

export function loadArchive(): ArchiveEntry[] {
  try {
    const raw = localStorage.getItem(ARCHIVE_KEY);
    return raw ? (JSON.parse(raw) as ArchiveEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveToArchive(
  org: Organization,
  activities: ProcessingActivity[],
  result: EvaluationResult
): ArchiveEntry {
  const entry: ArchiveEntry = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    orgName: org.name,
    org,
    activities,
    result,
  };
  const list = loadArchive();
  // Newest first, cap at MAX_ENTRIES
  const updated = [entry, ...list].slice(0, MAX_ENTRIES);
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updated));
  return entry;
}

export function deleteArchiveEntry(id: string): void {
  const list = loadArchive().filter((e) => e.id !== id);
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(list));
}
