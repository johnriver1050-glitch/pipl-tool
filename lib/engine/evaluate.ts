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
  condition: Record<string, string | boolean>
): boolean {
  for (const [key, value] of Object.entries(condition)) {
    const asBool = typeof value === "boolean" ? value : value === "true";
    if (key === "org.isCIIO") return org.isCIIO === asBool;
    if (key === "org.handlesImportantData")
      return org.handlesImportantData === asBool;
    if (key === "org.piSubjectsCumulative")
      return compareNumeric(org.piSubjectsCumulative, String(value));
    if (key === "org.sensitivePiSubjectsCumulative")
      return compareNumeric(org.sensitivePiSubjectsCumulative, String(value));
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

// ── 规则分类 & 匹配 ───────────────────────────────────────────────────────────

function isRuleActive(rule: KbRule): boolean {
  return !rule.superseded_by;
}

/** 所有 when 条件都是 org.* 的规则只需在组织维度评估一次，与活动数量无关 */
function isOrgScopedRule(rule: KbRule): boolean {
  return Object.keys(rule.when).every((k) => k.startsWith("org."));
}

function orgMatchesRule(org: Organization, rule: KbRule): boolean {
  const w = rule.when;
  if (w["org.isOverseasEntity"] !== undefined && org.isOverseasEntity !== w["org.isOverseasEntity"]) return false;
  if (w["org.isCIIO"] !== undefined && org.isCIIO !== w["org.isCIIO"]) return false;
  if (w["org.handlesImportantData"] !== undefined && org.handlesImportantData !== w["org.handlesImportantData"]) return false;
  if (w["org.piSubjectsCumulative"] !== undefined && !compareNumeric(org.piSubjectsCumulative, w["org.piSubjectsCumulative"])) return false;
  if (w["org.providesAlgorithmRecommendation"] !== undefined && (org.providesAlgorithmRecommendation ?? false) !== w["org.providesAlgorithmRecommendation"]) return false;
  if (w["org.providesDeepSynthesis"] !== undefined && (org.providesDeepSynthesis ?? false) !== w["org.providesDeepSynthesis"]) return false;
  if (w["org.providesGenerativeAI"] !== undefined && (org.providesGenerativeAI ?? false) !== w["org.providesGenerativeAI"]) return false;
  return true;
}

function activityMatchesRule(
  activity: ProcessingActivity,
  rule: KbRule,
  org: Organization
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
    w["activity.hasEntrusting"] !== undefined &&
    (activity.entrusting.length > 0) !== w["activity.hasEntrusting"]
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
  if (
    w["org.isOverseasEntity"] !== undefined &&
    org.isOverseasEntity !== w["org.isOverseasEntity"]
  )
    return false;
  if (w["org.isCIIO"] !== undefined && org.isCIIO !== w["org.isCIIO"])
    return false;
  if (
    w["org.handlesImportantData"] !== undefined &&
    org.handlesImportantData !== w["org.handlesImportantData"]
  )
    return false;
  if (
    w["org.piSubjectsCumulative"] !== undefined &&
    !compareNumeric(org.piSubjectsCumulative, w["org.piSubjectsCumulative"])
  )
    return false;
  if (
    w["org.providesAlgorithmRecommendation"] !== undefined &&
    (org.providesAlgorithmRecommendation ?? false) !== w["org.providesAlgorithmRecommendation"]
  )
    return false;
  if (
    w["org.providesDeepSynthesis"] !== undefined &&
    (org.providesDeepSynthesis ?? false) !== w["org.providesDeepSynthesis"]
  )
    return false;
  if (
    w["org.providesGenerativeAI"] !== undefined &&
    (org.providesGenerativeAI ?? false) !== w["org.providesGenerativeAI"]
  )
    return false;
  if (
    w["activity.involvesFaceRecognition"] !== undefined &&
    (activity.involvesFaceRecognition ?? false) !== w["activity.involvesFaceRecognition"]
  )
    return false;
  return true;
}

// ── 触发原因描述 ──────────────────────────────────────────────────────────────

const WHEN_LABEL: Record<string, string> = {
  "activity.involvesSensitivePi": "处理敏感个人信息",
  "activity.hasSharing": "向第三方共享",
  "activity.hasEntrusting": "委托处理",
  "activity.isPublicDisclosure": "公开披露",
  "activity.involvesMinorsUnder14": "处理14周岁以下未成年人信息",
  "activity.isAutomatedDecisionMaking": "使用自动化决策",
  "activity.hasCrossBorder": "跨境传输个人信息",
  "activity.involvesFaceRecognition": "使用人脸识别技术",
  "org.isOverseasEntity": "境外主体处理中国境内用户信息",
  "org.isCIIO": "关键信息基础设施运营者（CIIO）",
  "org.handlesImportantData": "处理重要数据",
  "org.providesAlgorithmRecommendation": "提供算法推荐服务",
  "org.providesDeepSynthesis": "提供深度合成服务",
  "org.providesGenerativeAI": "提供生成式AI服务",
};

function describeTrigger(rule: KbRule): string {
  const w = rule.when;
  const parts: string[] = [];
  for (const [key, val] of Object.entries(w)) {
    if (val !== true) continue;
    if (WHEN_LABEL[key]) parts.push(WHEN_LABEL[key]);
  }
  if (w["org.piSubjectsCumulative"]) {
    parts.push(`年度累计处理人次 ${w["org.piSubjectsCumulative"]} 人`);
  }
  return parts.join("、");
}

// ── 义务合并 ──────────────────────────────────────────────────────────────────

function mergeObligation(existing: Obligation, rule: KbRule): void {
  if (!existing.ruleIds.includes(rule.id)) existing.ruleIds.push(rule.id);
  existing.category ??= rule.category;
  existing.requirementLevel ??= rule.requirement_level;
  existing.reviewStatus ??= rule.review_status;
  existing.articleSummaryZh ??= rule.article_summary_zh;
  existing.applicabilityZh ??= rule.applicability_zh;
  existing.exceptionsZh ??= rule.exceptions_zh;
  if (rule.action_items_zh) {
    existing.actionItemsZh = [
      ...new Set([
        ...(existing.actionItemsZh ?? []),
        ...rule.action_items_zh,
      ]),
    ];
  }
  if (rule.evidence_examples_zh) {
    existing.evidenceExamplesZh = [
      ...new Set([
        ...(existing.evidenceExamplesZh ?? []),
        ...rule.evidence_examples_zh,
      ]),
    ];
  }
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
    source: rule.source,
    effectiveDate: rule.effective_date,
    category: rule.category,
    requirementLevel: rule.requirement_level,
    reviewStatus: rule.review_status,
    articleSummaryZh: rule.article_summary_zh,
    applicabilityZh: rule.applicability_zh,
    exceptionsZh: rule.exceptions_zh,
    actionItemsZh: rule.action_items_zh,
    evidenceExamplesZh: rule.evidence_examples_zh,
    triggerReasonZh: describeTrigger(rule),
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
  const orgRules = activeRules.filter(isOrgScopedRule);
  const activityRules = activeRules.filter((r) => !isOrgScopedRule(r));

  const obligationMap = new Map<string, Obligation>();
  const triggeredRuleIds = new Set<string>();

  function record(rule: KbRule) {
    triggeredRuleIds.add(rule.id);
    const existing = obligationMap.get(rule.id);
    if (existing) mergeObligation(existing, rule);
    else obligationMap.set(rule.id, obligationFromRule(rule));
  }

  // 组织级规则：评估一次，不依赖活动列表是否为空
  for (const rule of orgRules) {
    if (orgMatchesRule(org, rule)) record(rule);
  }

  // 活动级规则：逐活动评估
  for (const activity of activities) {
    for (const rule of activityRules) {
      if (activityMatchesRule(activity, rule, org)) record(rule);
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
