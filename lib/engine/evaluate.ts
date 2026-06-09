import { type KnowledgeBase, type KbRule } from "../schemas";
import type {
  Organization,
  ProcessingActivity,
  Obligation,
  EvaluationResult,
  CrossBorderMechanism,
  DocumentType,
} from "../types";

// ── 跨境机制判定（单独可测函数，SPEC 第7节）──────────────────────────────────

export function determineCrossBorderMechanism(
  org: Pick<
    Organization,
    | "isCIIO"
    | "handlesImportantData"
    | "piSubjectsCumulative"
    | "sensitivePiSubjectsCumulative"
  >,
  kb: KnowledgeBase
): CrossBorderMechanism {
  const { rules } = kb.cross_border_thresholds;

  for (const rule of rules) {
    for (const condition of rule.when_any) {
      if (matchThresholdCondition(org, condition)) {
        return rule.mechanism as CrossBorderMechanism;
      }
    }
  }
  return "exempt";
}

function matchThresholdCondition(
  org: Pick<
    Organization,
    | "isCIIO"
    | "handlesImportantData"
    | "piSubjectsCumulative"
    | "sensitivePiSubjectsCumulative"
  >,
  condition: Record<string, string>
): boolean {
  for (const [key, value] of Object.entries(condition)) {
    if (key === "org.isCIIO") return org.isCIIO === (value === "true");
    if (key === "org.handlesImportantData")
      return org.handlesImportantData === (value === "true");
    if (key === "org.piSubjectsCumulative")
      return compareNumeric(org.piSubjectsCumulative, value);
    if (key === "org.sensitivePiSubjectsCumulative")
      return compareNumeric(org.sensitivePiSubjectsCumulative, value);
  }
  return false;
}

function compareNumeric(actual: number, expr: string): boolean {
  const gt = expr.match(/^>(\d+)$/);
  if (gt) return actual > parseInt(gt[1]);
  const lt = expr.match(/^<(\d+)$/);
  if (lt) return actual < parseInt(lt[1]);
  const range = expr.match(/^(\d+)\.\.(\d+)$/);
  if (range) return actual >= parseInt(range[1]) && actual <= parseInt(range[2]);
  return false;
}

// ── 规则匹配 ──────────────────────────────────────────────────────────────────

function isRuleActive(rule: KbRule): boolean {
  return !rule.superseded_by;
}

function activityMatchesRule(
  activity: ProcessingActivity,
  rule: KbRule
): boolean {
  const w = rule.when;
  if (
    w["activity.involvesSensitivePi"] !== undefined &&
    activity.involvesSensitivePi !== w["activity.involvesSensitivePi"]
  )
    return false;
  if (
    w["activity.hasSharing"] !== undefined &&
    (activity.sharing.length > 0) !== w["activity.hasSharing"]
  )
    return false;
  if (
    w["activity.isPublicDisclosure"] !== undefined &&
    activity.isPublicDisclosure !== w["activity.isPublicDisclosure"]
  )
    return false;
  if (
    w["activity.involvesMinorsUnder14"] !== undefined &&
    activity.involvesMinorsUnder14 !== w["activity.involvesMinorsUnder14"]
  )
    return false;
  if (
    w["activity.isAutomatedDecisionMaking"] !== undefined &&
    activity.isAutomatedDecisionMaking !==
      w["activity.isAutomatedDecisionMaking"]
  )
    return false;
  if (
    w["activity.hasCrossBorder"] !== undefined &&
    (activity.crossBorder !== null) !== w["activity.hasCrossBorder"]
  )
    return false;
  return true;
}

// ── 义务合并 ──────────────────────────────────────────────────────────────────

function mergeObligation(existing: Obligation, rule: KbRule): void {
  existing.ruleIds.push(rule.id);
  if (rule.then.requires_separate_consent)
    existing.requiresSeparateConsent = true;
  if (rule.then.requires_pipia) existing.requiresPIPIA = true;
  if (rule.then.notice_must_include) {
    existing.noticeMustInclude = [
      ...new Set([
        ...(existing.noticeMustInclude ?? []),
        ...rule.then.notice_must_include,
      ]),
    ];
  }
  if (rule.then.grants_right) {
    existing.grantsRights = [
      ...new Set([
        ...(existing.grantsRights ?? []),
        ...rule.then.grants_right,
      ]),
    ];
  }
}

function obligationFromRule(rule: KbRule): Obligation {
  return {
    code: rule.id,
    titleZh: rule.rationale_zh,
    ruleIds: [rule.id],
    requiresSeparateConsent: rule.then.requires_separate_consent,
    requiresPIPIA: rule.then.requires_pipia,
    noticeMustInclude: rule.then.notice_must_include,
    grantsRights: rule.then.grants_right,
  };
}

// ── 所需文档推导 ───────────────────────────────────────────────────────────────

function deriveRequiredDocuments(
  obligations: Obligation[],
  activities: ProcessingActivity[]
): DocumentType[] {
  const docs = new Set<DocumentType>(["privacy_policy", "pi_collection_list"]);
  const hasSeparateConsent = obligations.some((o) => o.requiresSeparateConsent);
  const hasPIPIA = obligations.some((o) => o.requiresPIPIA);
  const hasSharing = activities.some(
    (a) => a.sharing.length > 0 || a.entrusting.length > 0
  );
  const hasCrossBorder = activities.some((a) => a.crossBorder !== null);

  if (hasSharing) docs.add("sharing_list");
  if (hasSeparateConsent) docs.add("separate_consent");
  if (hasCrossBorder) docs.add("crossborder_notice");
  if (hasPIPIA) docs.add("pipia_report");

  return Array.from(docs);
}

// ── 主入口 ────────────────────────────────────────────────────────────────────

export function evaluate(
  org: Organization,
  activities: ProcessingActivity[],
  kb: KnowledgeBase
): EvaluationResult {
  const activeRules = kb.rules.filter(isRuleActive);
  const obligationMap = new Map<string, Obligation>();
  const triggeredRuleIds = new Set<string>();

  for (const activity of activities) {
    for (const rule of activeRules) {
      if (activityMatchesRule(activity, rule)) {
        triggeredRuleIds.add(rule.id);
        const existing = obligationMap.get(rule.id);
        if (existing) {
          mergeObligation(existing, rule);
        } else {
          obligationMap.set(rule.id, obligationFromRule(rule));
        }
      }
    }
  }

  const obligations = Array.from(obligationMap.values());
  const gaps = obligations.filter((o) => o.gap);
  const requiredDocuments = deriveRequiredDocuments(obligations, activities);

  const hasCrossBorder = activities.some((a) => a.crossBorder !== null);
  const crossBorderMechanism = hasCrossBorder
    ? determineCrossBorderMechanism(org, kb)
    : undefined;

  return {
    obligations,
    gaps,
    requiredDocuments,
    crossBorderMechanism,
    triggeredRuleIds: Array.from(triggeredRuleIds),
  };
}
