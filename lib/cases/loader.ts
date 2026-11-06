import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface ComplianceCase {
  id: string;
  title: string;
  entity: string;
  regulator: string;
  date: string;
  penalty: string;
  penalty_amount?: number;
  law_basis: string[];
  violation_summary: string;
  related_rules: string[];
  source_url: string;
  lesson: string;
}

const CASES_PATH = path.join(
  process.cwd(),
  "knowledge-base",
  "compliance-cases.yaml"
);

let _cache: ComplianceCase[] | null = null;

export function loadCases(): ComplianceCase[] {
  if (_cache) return _cache;
  const raw = fs.readFileSync(CASES_PATH, "utf-8");
  const data = yaml.load(raw) as { cases: ComplianceCase[] };
  _cache = data.cases;
  return _cache;
}

export function getCasesForRules(ruleIds: string[]): ComplianceCase[] {
  const ruleSet = new Set(ruleIds);
  return loadCases().filter((c) =>
    c.related_rules.some((r) => ruleSet.has(r))
  );
}
