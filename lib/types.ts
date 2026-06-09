// PIPL 合规工具 — 核心数据模型（对应 SPEC 第5节）

export type LegalBasis =
  | "consent"
  | "contract"
  | "legal_obligation"
  | "emergency"
  | "public_interest_news"
  | "publicly_disclosed"
  | "other_statutory";

export type CrossBorderMechanism =
  | "security_assessment"
  | "standard_contract"
  | "certification"
  | "exempt";

export interface Recipient {
  name: string;
  isOverseas: boolean;
  purpose: string;
  piTypes: string[];
  contact?: string;
}

export interface CrossBorderTransfer {
  recipientCountry: string;
  recipientName: string;
  recipientContact: string;
  purpose: string;
  piTypes: string[];
  rightsMethod: string;
}

export interface Organization {
  id: string;
  name: string;
  isOverseasEntity: boolean;
  hasDomesticRepresentative: boolean;
  industry: string;
  isCIIO: boolean;
  handlesImportantData: boolean;
  /** 自当年1月1日起累计人次 */
  piSubjectsCumulative: number;
  sensitivePiSubjectsCumulative: number;
}

export interface ProcessingActivity {
  id: string;
  purpose: string;
  piTypes: string[];
  involvesSensitivePi: boolean;
  involvesMinorsUnder14: boolean;
  legalBasis: LegalBasis;
  retentionPeriod: string;
  isAutomatedDecisionMaking: boolean;
  sharing: Recipient[];
  entrusting: Recipient[];
  isPublicDisclosure: boolean;
  crossBorder: CrossBorderTransfer | null;
}

export interface PersonalInfoType {
  id: string;
  labelZh: string;
  labelEn: string;
  isSensitive: boolean;
  category: string;
}

/** 引擎输出，不持久化存储 */
export interface Obligation {
  code: string;
  titleZh: string;
  ruleIds: string[];
  requiresSeparateConsent?: boolean;
  requiresPIPIA?: boolean;
  requiresCrossBorderMechanism?: CrossBorderMechanism;
  noticeMustInclude?: string[];
  grantsRights?: string[];
  gap?: boolean;
}

export interface EvaluationResult {
  obligations: Obligation[];
  gaps: Obligation[];
  requiredDocuments: DocumentType[];
  crossBorderMechanism?: CrossBorderMechanism;
  triggeredRuleIds: string[];
}

export type DocumentType =
  | "privacy_policy"
  | "pi_collection_list"
  | "sharing_list"
  | "separate_consent"
  | "crossborder_notice"
  | "pipia_report";
