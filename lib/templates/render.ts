import type { EvaluationResult, Organization, ProcessingActivity, CrossBorderTransfer } from "../types";
import type { KnowledgeBase } from "../schemas";

const LEGAL_BASIS_ZH: Record<string, string> = {
  consent: "当事人同意",
  contract: "合同履行 / 人力资源管理",
  legal_obligation: "履行法定职责或义务",
  emergency: "突发公共卫生事件或紧急情况",
  public_interest_news: "新闻报道或公共利益",
  publicly_disclosed: "当事人自行公开的信息",
  other_statutory: "法律法规另有规定",
};

const MECHANISM_ZH: Record<string, string> = {
  security_assessment: "国家安全评估（CAC）",
  standard_contract: "标准合同（SCCs）并备案",
  certification: "个人信息保护认证",
  exempt: "豁免（仍须告知+单独同意）",
};

const DOC_TYPE_ZH: Record<string, string> = {
  privacy_policy: "隐私政策",
  pi_collection_list: "个人信息收集清单",
  sharing_list: "个人信息共享清单",
  separate_consent: "单独同意书",
  crossborder_notice: "跨境传输告知书",
  pipia_report: "个人信息保护影响评估报告",
};

/** 替换模板中的 {{slot}} 占位符 */
function fillSlots(template: string, slots: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => slots[key] ?? `{{${key}}}`);
}

export interface RenderedDocument {
  type: string;
  titleZh: string;
  bodyZh: string;
  bodyEn?: string;
  disclaimer: string;
  kbVersion: string;
}

function disclaimer(kb: KnowledgeBase): string {
  return kb.legal_disclaimer_zh;
}

// ── 跨境单独同意 ───────────────────────────────────────────────────────────────

export function renderCrossBorderConsent(
  transfer: CrossBorderTransfer,
  kb: KnowledgeBase
): RenderedDocument {
  const tpl = kb.templates?.["separate_consent_crossborder"];
  if (!tpl) throw new Error("知识库缺少 separate_consent_crossborder 模板");

  const slots: Record<string, string> = {
    purpose: transfer.purpose,
    recipientCountry: transfer.recipientCountry,
    recipientName: transfer.recipientName,
    piTypes: transfer.piTypes.join("、"),
    recipientContact: transfer.recipientContact,
    rightsMethod: transfer.rightsMethod,
  };

  return {
    type: "crossborder_notice",
    titleZh: tpl.titleZh,
    bodyZh: fillSlots(tpl.bodyZh ?? "", slots),
    bodyEn: tpl.bodyEn ? fillSlots(tpl.bodyEn, slots) : undefined,
    disclaimer: disclaimer(kb),
    kbVersion: kb.version,
  };
}

// ── 隐私政策骨架（占位，Step 5 前补全） ───────────────────────────────────────

export function renderPrivacyPolicyOutline(
  org: Organization,
  activities: ProcessingActivity[],
  result: EvaluationResult,
  kb: KnowledgeBase
): RenderedDocument {
  const piTypes = [...new Set(activities.flatMap((a) => a.piTypes))];
  const hasSharing = activities.some((a) => a.sharing.length > 0);
  const hasCross = activities.some((a) => a.crossBorder !== null);

  const lines: string[] = [
    `# ${org.name} 隐私政策（草稿）`,
    "",
    `## 一、我们收集的个人信息`,
    piTypes.map((t) => `- ${t}`).join("\n"),
    "",
    `## 二、处理目的与法律依据`,
    activities
      .map((a) => `- **${a.purpose}**（法律依据：${LEGAL_BASIS_ZH[a.legalBasis] ?? a.legalBasis}，保留期：${a.retentionPeriod}）`)
      .join("\n"),
    "",
    hasSharing
      ? `## 三、共享与委托处理\n详见个人信息共享清单。\n`
      : "",
    hasCross
      ? `## 四、个人信息跨境传输\n出境机制：${MECHANISM_ZH[result.crossBorderMechanism ?? ""] ?? result.crossBorderMechanism ?? "待评估"}。详见出境告知书。\n`
      : "",
    `## ${hasSharing || hasCross ? "五" : "三"}、您的权利`,
    "您有权查阅、复制、更正、删除您的个人信息，并有权撤回同意、转移数据。",
    "",
    `## 联系我们`,
    org.isOverseasEntity && !org.hasDomesticRepresentative
      ? "⚠️ 境内代表尚未指定，需补充联系信息（PIPL 第53条）。"
      : "如有任何隐私相关问题，请联系我们的数据保护负责人。",
  ];

  return {
    type: "privacy_policy",
    titleZh: "隐私政策",
    bodyZh: lines.filter(Boolean).join("\n"),
    disclaimer: disclaimer(kb),
    kbVersion: kb.version,
  };
}

// ── 个人信息收集清单 ───────────────────────────────────────────────────────────

export function renderPiCollectionList(
  org: Organization,
  activities: ProcessingActivity[],
  kb: KnowledgeBase
): RenderedDocument {
  const lines: string[] = [
    `# ${org.name} 个人信息收集清单`,
    "",
    "依据《个人信息保护法》第17条，本公司制定并公开以下个人信息收集清单，列明收集的个人信息类型、处理目的、法律依据及保存期限。",
    "",
  ];

  activities.forEach((a, i) => {
    lines.push(`## ${i + 1}. ${a.purpose}`);
    lines.push(`- **收集的个人信息类型**：${a.piTypes.join("、") || "（未填写）"}`);
    lines.push(`- **是否涉及敏感个人信息**：${a.involvesSensitivePi ? "是" : "否"}`);
    if (a.involvesFaceRecognition) {
      lines.push("- **人脸识别信息**：是（属于生物识别敏感信息）");
    }
    lines.push(`- **处理目的**：${a.purpose}`);
    lines.push(`- **法律依据**：${LEGAL_BASIS_ZH[a.legalBasis] ?? a.legalBasis}`);
    lines.push(`- **保存期限**：${a.retentionPeriod || "（待填写）"}`);
    lines.push(`- **涉及14周岁以下未成年人**：${a.involvesMinorsUnder14 ? "是" : "否"}`);
    lines.push("");
  });

  lines.push("## 说明");
  lines.push("- 本清单将随业务变化适时更新，更新后及时在官方渠道公示。");
  lines.push("- 如您对个人信息收集有任何疑问，请联系我们的个人信息保护负责人。");

  return {
    type: "pi_collection_list",
    titleZh: "个人信息收集清单",
    bodyZh: lines.join("\n"),
    disclaimer: disclaimer(kb),
    kbVersion: kb.version,
  };
}

// ── 个人信息共享清单 ───────────────────────────────────────────────────────────

export function renderSharingList(
  org: Organization,
  activities: ProcessingActivity[],
  kb: KnowledgeBase
): RenderedDocument {
  const lines: string[] = [
    `# ${org.name} 个人信息共享清单`,
    "",
    "依据《个人信息保护法》第23条，本公司将向第三方提供个人信息的情况公示如下。",
    "",
  ];

  let hasAny = false;

  activities.forEach((a) => {
    if (a.sharing.length === 0 && a.entrusting.length === 0) return;
    hasAny = true;
    lines.push(`## 处理活动：${a.purpose}`);

    if (a.sharing.length > 0) {
      lines.push("### 共享（第三方直接使用）");
      a.sharing.forEach((s, i) => {
        lines.push(`#### 接收方 ${i + 1}：${s.name}`);
        lines.push(`- **是否境外机构**：${s.isOverseas ? "是" : "否"}`);
        lines.push(`- **共享目的**：${s.purpose}`);
        lines.push(`- **共享的个人信息类型**：${s.piTypes.join("、") || "（与上方处理活动一致）"}`);
        if (s.contact) lines.push(`- **联系方式**：${s.contact}`);
        lines.push("");
      });
    }

    if (a.entrusting.length > 0) {
      lines.push("### 委托处理（受托方仅按指令处理）");
      a.entrusting.forEach((e, i) => {
        lines.push(`#### 受托方 ${i + 1}：${e.name}`);
        lines.push(`- **委托目的**：${e.purpose}`);
        lines.push(`- **委托的个人信息类型**：${e.piTypes.join("、") || "（与上方处理活动一致）"}`);
        if (e.contact) lines.push(`- **联系方式**：${e.contact}`);
        lines.push("");
      });
    }
  });

  if (!hasAny) {
    lines.push("经引擎评估，本次评估范围内暂无向第三方共享或委托处理的个人信息活动。");
  }

  lines.push("## 说明");
  lines.push("- 委托处理须与受托方签订委托合同，明确处理目的、期限、方式及保密义务（PIPL 第21条）。");
  lines.push("- 向第三方共享须取得个人单独同意（PIPL 第23条），并在隐私政策中公示。");

  return {
    type: "sharing_list",
    titleZh: "个人信息共享与委托处理清单",
    bodyZh: lines.join("\n"),
    disclaimer: disclaimer(kb),
    kbVersion: kb.version,
  };
}

// ── 单独同意书 ────────────────────────────────────────────────────────────────

export function renderSeparateConsent(
  org: Organization,
  activities: ProcessingActivity[],
  kb: KnowledgeBase
): RenderedDocument {
  const lines: string[] = [
    `# ${org.name} 单独同意授权书`,
    "",
    "根据《个人信息保护法》相关规定，以下处理活动需取得您的单独、明确同意。请在仔细阅读后，对适用项作出选择。",
    "",
  ];

  let sectionIndex = 1;

  // 敏感信息同意
  const sensitiveActivities = activities.filter((a) => a.involvesSensitivePi);
  if (sensitiveActivities.length > 0) {
    lines.push(`## ${sectionIndex++}. 处理敏感个人信息`);
    lines.push("依据《个人信息保护法》第29条，处理敏感个人信息须取得单独同意。");
    lines.push("");
    sensitiveActivities.forEach((a) => {
      lines.push(`**处理目的**：${a.purpose}`);
      lines.push(`**信息类型**：${a.piTypes.join("、")}`);
      lines.push(`**保存期限**：${a.retentionPeriod || "（待填写）"}`);
      lines.push("");
    });
    lines.push("□ 我同意上述敏感个人信息的处理");
    lines.push("");
  }

  // 人脸识别同意
  const faceActivities = activities.filter((a) => a.involvesFaceRecognition);
  if (faceActivities.length > 0) {
    lines.push(`## ${sectionIndex++}. 人脸识别信息处理`);
    lines.push("依据《人脸识别技术应用安全管理办法》第9条，须以书面方式告知并取得单独同意，同时提供非人脸识别的替代方案。");
    lines.push("");
    faceActivities.forEach((a) => {
      lines.push(`**处理目的**：${a.purpose}`);
      lines.push("**替代方案**：如您不同意人脸识别，可通过【（填写替代方式）】完成相应操作。");
      lines.push("");
    });
    lines.push("□ 我同意通过人脸识别技术完成上述操作（已了解替代方案）");
    lines.push("");
  }

  // 共享同意
  const sharingActivities = activities.filter((a) => a.sharing.length > 0);
  if (sharingActivities.length > 0) {
    lines.push(`## ${sectionIndex++}. 向第三方共享个人信息`);
    lines.push("依据《个人信息保护法》第23条，向第三方提供个人信息须取得单独同意。");
    lines.push("");
    sharingActivities.forEach((a) => {
      a.sharing.forEach((s) => {
        lines.push(`**接收方**：${s.name}${s.isOverseas ? "（境外机构）" : ""}`);
        lines.push(`**共享目的**：${s.purpose}`);
        lines.push(`**共享信息类型**：${s.piTypes.join("、") || a.piTypes.join("、")}`);
        lines.push("");
      });
    });
    lines.push("□ 我同意向上述第三方共享个人信息");
    lines.push("");
  }

  lines.push("## 签署确认");
  lines.push("本人已充分阅读并理解上述内容，自愿作出上述同意。本同意书可随时通过【（填写撤回方式）】撤回，撤回不影响撤回前基于同意所进行处理的效力。");
  lines.push("");
  lines.push("姓名：________________________");
  lines.push("");
  lines.push("签署日期：________年____月____日");

  return {
    type: "separate_consent",
    titleZh: "单独同意授权书",
    bodyZh: lines.join("\n"),
    disclaimer: disclaimer(kb),
    kbVersion: kb.version,
  };
}

// ── 个人信息保护影响评估报告（PIPIA） ─────────────────────────────────────────

export function renderPipiaReport(
  org: Organization,
  activities: ProcessingActivity[],
  result: EvaluationResult,
  kb: KnowledgeBase
): RenderedDocument {
  const pipiaActivities = activities.filter((a) =>
    a.involvesSensitivePi || a.involvesFaceRecognition || a.involvesMinorsUnder14 ||
    a.crossBorder !== null || a.isAutomatedDecisionMaking
  );

  const lines: string[] = [
    `# ${org.name} 个人信息保护影响评估报告`,
    `**评估版本**：初稿`,
    `**知识库版本**：${kb.version}（最后审阅：${kb.last_reviewed}）`,
    `**评估范围**：${pipiaActivities.map((a) => a.purpose).join("、") || "全部处理活动"}`,
    "",
    "## 一、评估目的与依据",
    "本报告依据《个人信息保护法》第55条、GB/T 39335《个人信息安全影响评估指南》及网信部门相关规定，对下列高风险处理活动开展个人信息保护影响评估。",
    "",
    "**触发评估的情形**：",
  ];

  if (activities.some((a) => a.involvesSensitivePi)) lines.push("- 处理敏感个人信息（PIPL第55条第（一）款）");
  if (activities.some((a) => a.isAutomatedDecisionMaking)) lines.push("- 利用个人信息进行自动化决策（PIPL第55条第（二）款）");
  if (activities.some((a) => a.crossBorder !== null)) lines.push("- 向境外提供个人信息（PIPL第55条第（三）款）");
  if (activities.some((a) => a.involvesFaceRecognition)) lines.push("- 使用人脸识别等生物识别技术（高风险处理活动）");
  if (activities.some((a) => a.involvesMinorsUnder14)) lines.push("- 处理未成年人个人信息（高风险处理活动）");

  lines.push("");
  lines.push("## 二、处理活动描述");
  pipiaActivities.forEach((a, i) => {
    lines.push(`### 活动 ${i + 1}：${a.purpose}`);
    lines.push(`- **处理的个人信息类型**：${a.piTypes.join("、")}`);
    lines.push(`- **法律依据**：${LEGAL_BASIS_ZH[a.legalBasis] ?? a.legalBasis}`);
    lines.push(`- **保存期限**：${a.retentionPeriod || "（待填写）"}`);
    lines.push(`- **敏感信息**：${a.involvesSensitivePi ? "是" : "否"}`);
    lines.push(`- **人脸识别**：${a.involvesFaceRecognition ? "是" : "否"}`);
    lines.push(`- **自动化决策**：${a.isAutomatedDecisionMaking ? "是" : "否"}`);
    lines.push(`- **跨境传输**：${a.crossBorder ? `是（接收方：${a.crossBorder.recipientName}，${a.crossBorder.recipientCountry}）` : "否"}`);
    lines.push("");
  });

  lines.push("## 三、个人信息权益影响识别");
  lines.push("### 3.1 处理必要性");
  lines.push("（请评估人员填写：上述处理活动是否与处理目的相称、是否符合最小必要原则）");
  lines.push("");
  lines.push("### 3.2 对个人权益的潜在影响");
  lines.push("（请评估人员填写：包括但不限于对个人隐私、名誉、财产、人身安全等方面的影响）");
  lines.push("");
  lines.push("### 3.3 数据泄露风险");
  lines.push("（请评估人员填写：存储、传输、共享等环节的安全风险分析）");
  lines.push("");

  lines.push("## 四、风险等级评定");
  lines.push("| 风险维度 | 风险描述 | 可能性 | 严重程度 | 综合风险等级 |");
  lines.push("（此部分由评估人员填写，参考 GB/T 39335 附录A 风险矩阵）");
  lines.push("");

  lines.push("## 五、风险控制措施");
  const obligations = result.obligations.filter((o) =>
    pipiaActivities.some((a) => {
      if (o.code.includes("SENSITIVE") && a.involvesSensitivePi) return true;
      if (o.code.includes("FACEREC") && a.involvesFaceRecognition) return true;
      if (o.code.includes("MINORS") && a.involvesMinorsUnder14) return true;
      if (o.code.includes("CROSSBORDER") && a.crossBorder !== null) return true;
      return false;
    })
  );
  if (obligations.length > 0) {
    lines.push("根据引擎分析，以下合规义务已自动识别，应作为控制措施落实：");
    obligations.forEach((o) => lines.push(`- **${o.code}**：${o.titleZh}`));
  } else {
    lines.push("（请评估人员根据风险识别结果填写具体控制措施）");
  }
  lines.push("");

  lines.push("## 六、评估结论与审批");
  lines.push("**评估结论**：□ 风险可接受，可以开展处理活动  □ 需整改后再评估  □ 风险不可接受，不得开展");
  lines.push("");
  lines.push("**评估人员**：________________________");
  lines.push("");
  lines.push("**评估日期**：________年____月____日");
  lines.push("");
  lines.push("**审批负责人**：________________________");
  lines.push("");
  lines.push("**审批日期**：________年____月____日");

  return {
    type: "pipia_report",
    titleZh: "个人信息保护影响评估报告",
    bodyZh: lines.join("\n"),
    disclaimer: disclaimer(kb),
    kbVersion: kb.version,
  };
}

// ── 差距报告 ───────────────────────────────────────────────────────────────────

export function renderGapReport(
  org: Organization,
  result: EvaluationResult,
  kb: KnowledgeBase
): RenderedDocument {
  const lines: string[] = [
    `# PIPL 合规差距分析报告`,
    `**企业**：${org.name}`,
    `**知识库版本**：${kb.version}（最后审阅：${kb.last_reviewed}）`,
    "",
    `## 触发义务（${result.obligations.length} 项）`,
    ...result.obligations.map(
      (o) =>
        `- **${o.code}**：${o.titleZh}` +
        (o.requiresSeparateConsent ? "　→ 需单独同意" : "") +
        (o.requiresPIPIA ? "　→ 需 PIPIA" : "")
    ),
    "",
    `## 需要生成的文档`,
    ...result.requiredDocuments.map((d) => `- ${DOC_TYPE_ZH[d] ?? d}`),
    "",
    result.crossBorderMechanism
      ? `## 跨境出境机制\n适用机制：**${MECHANISM_ZH[result.crossBorderMechanism] ?? result.crossBorderMechanism}**`
      : "",
    "",
    `## 法规追溯`,
    ...result.triggeredRuleIds.map((id) => {
      const rule = kb.rules.find((r) => r.id === id);
      return rule ? `- ${id}（${rule.source}，生效：${rule.effective_date}）` : `- ${id}`;
    }),
  ];

  return {
    type: "gap_report",
    titleZh: "差距分析报告",
    bodyZh: lines.filter((l) => l !== "").join("\n"),
    disclaimer: disclaimer(kb),
    kbVersion: kb.version,
  };
}
