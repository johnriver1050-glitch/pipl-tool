import { z } from "zod";

export const LegalBasisSchema = z.enum([
  "consent",
  "contract",
  "legal_obligation",
  "emergency",
  "public_interest_news",
  "publicly_disclosed",
  "other_statutory",
]);

export const CrossBorderMechanismSchema = z.enum([
  "security_assessment",
  "standard_contract",
  "certification",
  "exempt",
]);

export const RecipientSchema = z.object({
  name: z.string().min(1),
  isOverseas: z.boolean(),
  purpose: z.string().min(1),
  piTypes: z.array(z.string()),
  contact: z.string().optional(),
});

export const CrossBorderTransferSchema = z.object({
  recipientCountry: z.string().min(1),
  recipientName: z.string().min(1),
  recipientContact: z.string().min(1),
  purpose: z.string().min(1),
  piTypes: z.array(z.string()).min(1),
  rightsMethod: z.string().min(1),
});

export const OrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  isOverseasEntity: z.boolean(),
  hasDomesticRepresentative: z.boolean(),
  industry: z.string().min(1),
  isCIIO: z.boolean(),
  handlesImportantData: z.boolean(),
  piSubjectsCumulative: z.number().int().min(0),
  sensitivePiSubjectsCumulative: z.number().int().min(0),
  providesAlgorithmRecommendation: z.boolean().default(false),
  providesDeepSynthesis: z.boolean().default(false),
  providesGenerativeAI: z.boolean().default(false),
});

export const ProcessingActivitySchema = z.object({
  id: z.string().min(1),
  purpose: z.string().min(1),
  piTypes: z.array(z.string()).min(1),
  involvesSensitivePi: z.boolean(),
  involvesMinorsUnder14: z.boolean(),
  involvesFaceRecognition: z.boolean().default(false),
  legalBasis: LegalBasisSchema,
  retentionPeriod: z.string().min(1),
  isAutomatedDecisionMaking: z.boolean(),
  sharing: z.array(RecipientSchema),
  entrusting: z.array(RecipientSchema),
  isPublicDisclosure: z.boolean(),
  crossBorder: CrossBorderTransferSchema.nullable(),
});

export const PersonalInfoTypeSchema = z.object({
  id: z.string().min(1),
  labelZh: z.string().min(1),
  labelEn: z.string().min(1),
  isSensitive: z.boolean(),
  category: z.string().min(1),
});

// ── 知识库 YAML schema ──────────────────────────────────────────────────────

const RuleWhenSchema = z.object({
  "activity.involvesSensitivePi": z.boolean().optional(),
  "activity.hasSharing": z.boolean().optional(),
  "activity.hasEntrusting": z.boolean().optional(),
  "activity.isPublicDisclosure": z.boolean().optional(),
  "activity.involvesMinorsUnder14": z.boolean().optional(),
  "activity.isAutomatedDecisionMaking": z.boolean().optional(),
  "activity.hasCrossBorder": z.boolean().optional(),
  "org.isOverseasEntity": z.boolean().optional(),
  "org.isCIIO": z.boolean().optional(),
  "org.handlesImportantData": z.boolean().optional(),
  "org.piSubjectsCumulative": z.string().optional(),
  "org.providesAlgorithmRecommendation": z.boolean().optional(),
  "org.providesDeepSynthesis": z.boolean().optional(),
  "org.providesGenerativeAI": z.boolean().optional(),
  "activity.involvesFaceRecognition": z.boolean().optional(),
});

const RuleThenSchema = z.object({
  requires_separate_consent: z.boolean().optional(),
  requires_pipia: z.boolean().optional(),
  requires_special_rules: z.boolean().optional(),
  notice_must_include: z.array(z.string()).optional(),
  grants_right: z.array(z.string()).optional(),
});

export const KbRuleSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  superseded_by: z.string().nullable().optional(),
  category: z.string().optional(),
  requirement_level: z.enum(["mandatory", "recommended"]).optional(),
  review_status: z.enum(["current", "needs_review", "draft"]).optional(),
  article_summary_zh: z.string().optional(),
  applicability_zh: z.string().optional(),
  exceptions_zh: z.string().optional(),
  action_items_zh: z.array(z.string()).optional(),
  evidence_examples_zh: z.array(z.string()).optional(),
  when: RuleWhenSchema,
  then: RuleThenSchema,
  rationale_zh: z.string().min(1),
});

const CrossBorderThresholdRuleSchema = z.object({
  mechanism: CrossBorderMechanismSchema,
  when_any: z.array(z.record(z.string(), z.union([z.string(), z.boolean()]))),
});

const CrossBorderThresholdsSchema = z.object({
  source: z.string(),
  effective_date: z.string(),
  rules: z.array(CrossBorderThresholdRuleSchema),
  note_zh: z.string().optional(),
});

export const KnowledgeBaseSchema = z.object({
  version: z.string(),
  last_reviewed: z.string(),
  legal_disclaimer_zh: z.string(),
  personal_info_types: z.array(PersonalInfoTypeSchema),
  rules: z.array(KbRuleSchema),
  cross_border_thresholds: CrossBorderThresholdsSchema,
  templates: z.record(z.string(), z.any()).optional(),
});

export type KbRule = z.infer<typeof KbRuleSchema>;
export type KnowledgeBase = z.infer<typeof KnowledgeBaseSchema>;
