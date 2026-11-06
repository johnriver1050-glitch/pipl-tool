import { describe, it, expect } from "vitest";
import { evaluate, determineCrossBorderMechanism } from "../lib/engine/evaluate";
import type { Organization, ProcessingActivity } from "../lib/types";
import type { KnowledgeBase } from "../lib/schemas";

// ── 最小知识库 fixture ────────────────────────────────────────────────────────

const minimalKb: KnowledgeBase = {
  version: "test",
  last_reviewed: "2026-01-01",
  legal_disclaimer_zh: "测试",
  personal_info_types: [
    { id: "name", labelZh: "姓名", labelEn: "Name", isSensitive: false, category: "基本信息" },
    { id: "biometric", labelZh: "生物识别", labelEn: "Biometric", isSensitive: true, category: "生物识别" },
  ],
  rules: [
    {
      id: "PIPL-SEP-CONSENT-SENSITIVE",
      source: "PIPL 第29条",
      effective_date: "2021-11-01",
      superseded_by: null,
      category: "sensitive_pi",
      requirement_level: "mandatory",
      review_status: "current",
      article_summary_zh: "处理敏感个人信息应取得单独同意。",
      applicability_zh: "适用于敏感个人信息处理活动。",
      exceptions_zh: "应结合具体业务场景判断。",
      action_items_zh: ["取得单独同意", "完成 PIPIA"],
      evidence_examples_zh: ["单独同意记录", "PIPIA 报告"],
      when: { "activity.involvesSensitivePi": true },
      then: { requires_separate_consent: true, requires_pipia: true, notice_must_include: ["necessity", "impact_on_rights"] },
      rationale_zh: "处理敏感个人信息应取得单独同意",
    },
    {
      id: "PIPL-SEP-CONSENT-SHARING",
      source: "PIPL 第23条",
      effective_date: "2021-11-01",
      superseded_by: null,
      when: { "activity.hasSharing": true },
      then: { requires_separate_consent: true, requires_pipia: true, notice_must_include: ["recipient_identity", "purpose"] },
      rationale_zh: "向第三方提供须单独同意",
    },
    {
      id: "PIPL-CROSSBORDER-CONSENT",
      source: "PIPL 第39条",
      effective_date: "2021-11-01",
      superseded_by: null,
      when: { "activity.hasCrossBorder": true },
      then: { requires_separate_consent: true, requires_pipia: true },
      rationale_zh: "跨境提供须单独同意",
    },
    {
      id: "SUPERSEDED-RULE",
      source: "已废止条文",
      effective_date: "2020-01-01",
      superseded_by: "NEW-RULE",
      when: { "activity.involvesSensitivePi": true },
      then: { requires_separate_consent: false },
      rationale_zh: "已被取代",
    },
  ],
  cross_border_thresholds: {
    source: "测试",
    effective_date: "2024-03-22",
    rules: [
      {
        mechanism: "security_assessment",
        when_any: [
          { "org.isCIIO": "true" },
          { "org.piSubjectsCumulative": ">1000000" },
          { "org.sensitivePiSubjectsCumulative": ">10000" },
        ],
      },
      {
        mechanism: "standard_contract",
        when_any: [
          { "org.piSubjectsCumulative": "100000..1000000" },
          { "org.sensitivePiSubjectsCumulative": "1..10000" },
        ],
      },
      {
        mechanism: "exempt",
        when_any: [{ "org.piSubjectsCumulative": "<100000" }],
      },
    ],
  },
};

const baseOrg: Organization = {
  id: "org-1",
  name: "测试公司",
  isOverseasEntity: true,
  hasDomesticRepresentative: false,
  industry: "科技",
  isCIIO: false,
  handlesImportantData: false,
  piSubjectsCumulative: 5000,
  sensitivePiSubjectsCumulative: 0,
  providesAlgorithmRecommendation: false,
  providesDeepSynthesis: false,
  providesGenerativeAI: false,
};

const sensitiveActivity: ProcessingActivity = {
  id: "act-1",
  purpose: "人脸识别登录",
  piTypes: ["biometric"],
  involvesSensitivePi: true,
  involvesMinorsUnder14: false,
  involvesFaceRecognition: false,
  legalBasis: "consent",
  retentionPeriod: "1年",
  isAutomatedDecisionMaking: false,
  sharing: [],
  entrusting: [],
  isPublicDisclosure: false,
  crossBorder: null,
};

// ── determineCrossBorderMechanism ─────────────────────────────────────────────

describe("determineCrossBorderMechanism", () => {
  it("CIIO 强制安全评估", () => {
    expect(determineCrossBorderMechanism({ ...baseOrg, isCIIO: true }, minimalKb)).toBe("security_assessment");
  });

  it("累计超百万人次 → 安全评估", () => {
    expect(determineCrossBorderMechanism({ ...baseOrg, piSubjectsCumulative: 1_500_000 }, minimalKb)).toBe("security_assessment");
  });

  it("普通个人信息出境阈值边界：100万以内标准合同，超过100万安全评估", () => {
    expect(determineCrossBorderMechanism({ ...baseOrg, piSubjectsCumulative: 99_999 }, minimalKb)).toBe("exempt");
    expect(determineCrossBorderMechanism({ ...baseOrg, piSubjectsCumulative: 100_000 }, minimalKb)).toBe("standard_contract");
    expect(determineCrossBorderMechanism({ ...baseOrg, piSubjectsCumulative: 1_000_000 }, minimalKb)).toBe("standard_contract");
    expect(determineCrossBorderMechanism({ ...baseOrg, piSubjectsCumulative: 1_000_001 }, minimalKb)).toBe("security_assessment");
  });

  it("敏感信息超1万 → 安全评估", () => {
    expect(determineCrossBorderMechanism({ ...baseOrg, sensitivePiSubjectsCumulative: 15_000 }, minimalKb)).toBe("security_assessment");
  });

  it("敏感个人信息出境阈值边界：1万以内标准合同，超过1万安全评估", () => {
    expect(determineCrossBorderMechanism({ ...baseOrg, sensitivePiSubjectsCumulative: 0 }, minimalKb)).toBe("exempt");
    expect(determineCrossBorderMechanism({ ...baseOrg, sensitivePiSubjectsCumulative: 1 }, minimalKb)).toBe("standard_contract");
    expect(determineCrossBorderMechanism({ ...baseOrg, sensitivePiSubjectsCumulative: 10_000 }, minimalKb)).toBe("standard_contract");
    expect(determineCrossBorderMechanism({ ...baseOrg, sensitivePiSubjectsCumulative: 10_001 }, minimalKb)).toBe("security_assessment");
  });

  it("10万~100万 → 标准合同", () => {
    expect(determineCrossBorderMechanism({ ...baseOrg, piSubjectsCumulative: 500_000 }, minimalKb)).toBe("standard_contract");
  });

  it("不足10万 → 豁免", () => {
    expect(determineCrossBorderMechanism({ ...baseOrg, piSubjectsCumulative: 5_000 }, minimalKb)).toBe("exempt");
  });
});

// ── evaluate ──────────────────────────────────────────────────────────────────

describe("evaluate", () => {
  it("无活动时无义务", () => {
    const result = evaluate(baseOrg, [], minimalKb);
    expect(result.obligations).toHaveLength(0);
    expect(result.crossBorderMechanism).toBeUndefined();
  });

  it("敏感信息活动触发单独同意 + PIPIA", () => {
    const result = evaluate(baseOrg, [sensitiveActivity], minimalKb);
    const ob = result.obligations.find((o) => o.code === "PIPL-SEP-CONSENT-SENSITIVE");
    expect(ob).toBeDefined();
    expect(ob?.requiresSeparateConsent).toBe(true);
    expect(ob?.requiresPIPIA).toBe(true);
    expect(ob?.noticeMustInclude).toContain("necessity");
  });

  it("规则解释元数据会进入义务结果", () => {
    const result = evaluate(baseOrg, [sensitiveActivity], minimalKb);
    const ob = result.obligations.find((o) => o.code === "PIPL-SEP-CONSENT-SENSITIVE");
    expect(ob?.category).toBe("sensitive_pi");
    expect(ob?.requirementLevel).toBe("mandatory");
    expect(ob?.reviewStatus).toBe("current");
    expect(ob?.articleSummaryZh).toContain("单独同意");
    expect(ob?.actionItemsZh).toContain("完成 PIPIA");
    expect(ob?.evidenceExamplesZh).toContain("PIPIA 报告");
  });

  it("废止规则不被触发", () => {
    const result = evaluate(baseOrg, [sensitiveActivity], minimalKb);
    expect(result.triggeredRuleIds).not.toContain("SUPERSEDED-RULE");
  });

  it("共享活动触发共享文档", () => {
    const sharingActivity: ProcessingActivity = {
      ...sensitiveActivity,
      id: "act-2",
      involvesSensitivePi: false,
      sharing: [{ name: "第三方", isOverseas: false, purpose: "分析", piTypes: ["name"] }],
    };
    const result = evaluate(baseOrg, [sharingActivity], minimalKb);
    expect(result.requiredDocuments).toContain("sharing_list");
    expect(result.requiredDocuments).toContain("separate_consent");
  });

  it("跨境活动附带出境机制判定", () => {
    const crossBorderActivity: ProcessingActivity = {
      ...sensitiveActivity,
      id: "act-3",
      involvesSensitivePi: false,
      crossBorder: {
        recipientCountry: "美国",
        recipientName: "Acme Corp",
        recipientContact: "privacy@acme.com",
        purpose: "云存储",
        piTypes: ["name"],
        rightsMethod: "发邮件至 privacy@acme.com",
      },
    };
    const result = evaluate(baseOrg, [crossBorderActivity], minimalKb);
    expect(result.crossBorderMechanism).toBe("exempt");
    expect(result.requiredDocuments).toContain("crossborder_notice");
  });

  it("始终生成隐私政策和收集清单", () => {
    const result = evaluate(baseOrg, [sensitiveActivity], minimalKb);
    expect(result.requiredDocuments).toContain("privacy_policy");
    expect(result.requiredDocuments).toContain("pi_collection_list");
  });

  it("A1: 零活动时组织级规则仍触发", () => {
    const kbWithOrgRule: KnowledgeBase = {
      ...minimalKb,
      rules: [
        ...minimalKb.rules,
        {
          id: "DPO-REQUIRED",
          source: "PIPL 第52条",
          effective_date: "2021-11-01",
          superseded_by: null,
          when: { "org.piSubjectsCumulative": ">1000000" },
          then: {},
          rationale_zh: "须指定个人信息保护负责人",
        },
      ],
    };
    const bigOrg: Organization = { ...baseOrg, piSubjectsCumulative: 2_000_000 };
    const result = evaluate(bigOrg, [], kbWithOrgRule);
    expect(result.obligations.some((o) => o.code === "DPO-REQUIRED")).toBe(true);
  });

  it("A1: 组织级规则多活动时只生成一条义务（不重复）", () => {
    const kbWithOrgRule: KnowledgeBase = {
      ...minimalKb,
      rules: [
        {
          id: "ALG-TRANSPARENCY",
          source: "算法推荐管理规定",
          effective_date: "2022-03-01",
          superseded_by: null,
          when: { "org.providesAlgorithmRecommendation": true },
          then: {},
          rationale_zh: "须提供算法透明度说明",
        },
      ],
    };
    const algOrg: Organization = { ...baseOrg, providesAlgorithmRecommendation: true };
    const result = evaluate(algOrg, [sensitiveActivity, sensitiveActivity], kbWithOrgRule);
    const hits = result.obligations.filter((o) => o.code === "ALG-TRANSPARENCY");
    expect(hits).toHaveLength(1);
  });
});
