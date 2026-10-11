import type { OperatingTaxCategory, VerificationStatus } from './tax-foundation';

export interface RegulatorySourceSeed {
  code: string;
  type: 'revenue_memorandum_circular' | 'bir_web_page' | 'bir_directory' | 'government_proclamation' | 'bir_calendar';
  title: string;
  sourceUrl: string;
  publicationDate?: string;
  effectivityDate?: string;
  verificationStatus: VerificationStatus;
  note: string;
}

export interface TaxTypeSeed {
  code: string;
  label: string;
  operatingCategory: OperatingTaxCategory;
  verificationStatus: VerificationStatus;
  sourceCode: string;
}

export interface FilingChannelSeed {
  code: string;
  label: string;
  verificationStatus: VerificationStatus;
  sourceCode: string;
}

export interface FormSeed {
  formNumber: string;
  title: string;
  taxTypeCodes: string[];
  usualTiming: string;
  usualTimingStatus: VerificationStatus;
  usualTimingSourceCode: string;
  verificationStatus: VerificationStatus;
  sourceCode: string;
  note: string;
}

/**
 * The safe initial catalog is intentionally small and source-backed. It is not
 * a claim that this is the complete Philippine requirement universe. Missing
 * requirement/calendar mappings remain an explicit reconciliation task until
 * each row has been reviewed against an authoritative BIR source.
 */
export const regulatorySources: RegulatorySourceSeed[] = [
  {
    code: 'BIR-RMC-110-2025',
    type: 'revenue_memorandum_circular',
    title: 'Availability of the 2026 BIR Interactive Tax Calendar on the BIR Website',
    sourceUrl: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%20110-2025.pdf',
    publicationDate: '2025-12-26',
    verificationStatus: 'verified',
    note: 'Official announcement of the 2026 interactive calendar and linked forms, attachments/reports, directory, and payment references.',
  },
  {
    code: 'BIR-FORMS-CATALOG',
    type: 'bir_web_page',
    title: 'BIR Forms catalog',
    sourceUrl: 'https://www.bir.gov.ph/bir-forms',
    verificationStatus: 'verified',
    note: 'Official BIR catalog endpoint; individual titles/revisions require row-level reconciliation.',
  },
  {
    code: 'BIR-EFPS-JOBAIDS',
    type: 'bir_web_page',
    title: 'eFPS Jobaids',
    sourceUrl: 'https://efps.bir.gov.ph/efps-war/efpsJobaids.xhtml',
    verificationStatus: 'partially_verified',
    note: 'Official eFPS reference exposing form job aids; channel applicability still requires rule-level reconciliation.',
  },
  {
    code: 'BIR-RR-RDO-DIRECTORY-2024',
    type: 'bir_directory',
    title: 'Directory Revenue Regions and District Offices',
    sourceUrl: 'https://bir-cdn.bir.gov.ph/BIR/pdf/citizens-charter-rr-rdo-2024-v3.pdf',
    publicationDate: '2024-01-01',
    verificationStatus: 'superseded',
    note: 'Historical directory reference retained for provenance; superseded as the current office directory by the 2026 BIR Citizen’s Charter and 2026 RDO amendments.',
  },
  {
    code: 'BIR-CHARTER-RR-RDO-DIRECTORY-2026',
    type: 'bir_directory',
    title: 'BIR Citizen’s Charter 2026 — Revenue Regional and District Offices Directory',
    sourceUrl: 'https://bir-cdn.bir.gov.ph/BIR/pdf/BIR%20Citizen%27s%20Charter%20(2026%20Edition)%20final.pdf',
    publicationDate: '2026-01-01',
    verificationStatus: 'verified',
    note: 'Current 2026 directory reference for governed Revenue Region and RDO codes/names; the database preserves effective-dated amendments separately.',
  },
  {
    code: 'BIR-RAO-1-2026-RDO-17A-17B',
    type: 'bir_web_page',
    title: 'Revenue Administrative Order No. 1-2026 — RDO 17A and RDO 17B renaming',
    sourceUrl: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RAO%20No.%201-2026.pdf',
    publicationDate: '2026-02-24',
    effectivityDate: '2026-02-24',
    verificationStatus: 'verified',
    note: 'Immediate-effect amendment recorded in the governed office master.',
  },
  {
    code: 'BIR-RAO-2-2026-RDO-107-108-110-111',
    type: 'bir_web_page',
    title: 'Revenue Administrative Order No. 2-2026 — amendment of RAO No. 6-2025',
    sourceUrl: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RAO%20No.%202-2026.pdf',
    publicationDate: '2026-04-14',
    effectivityDate: '2026-04-14',
    verificationStatus: 'verified',
    note: 'Immediate-effect amendment recorded in the governed office master.',
  },
  {
    code: 'PH-OFFICIAL-GAZETTE',
    type: 'government_proclamation',
    title: 'Official Gazette of the Republic of the Philippines',
    sourceUrl: 'https://officialgazette.gov.ph/',
    verificationStatus: 'verified',
    note: 'Authoritative government publication index for proclamations and holiday authorities; individual 2026 holiday rows require source-by-source review.',
  },
  {
    code: 'PH-PROC-1006-2025',
    type: 'government_proclamation',
    title: 'Proclamation No. 1006, s. 2025 — 2026 regular and special non-working days',
    sourceUrl: 'https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/7/99678',
    publicationDate: '2025-09-03',
    effectivityDate: '2025-09-03',
    verificationStatus: 'verified',
    note: 'Government proclamation reproduced by the Supreme Court E-Library. It identifies national 2026 holidays; it does not itself decide every BIR deadline adjustment.',
  },
  {
    code: 'PH-PROC-1189-2026',
    type: 'government_proclamation',
    title: 'Proclamation No. 1189, s. 2026 — Eid’l Fitr',
    sourceUrl: 'https://pco.gov.ph/news_releases/proclamation-no-1189-s-2026-declaring-friday-20-march-2026-a-regular-holiday-throughout-the-country-in-observance-of-eidl-fitr-feast-of-ramadhan/',
    publicationDate: '2026-03-12',
    effectivityDate: '2026-03-20',
    verificationStatus: 'verified',
    note: 'Government announcement of the 2026 national holiday date.',
  },
  {
    code: 'PH-PROC-1264-2026',
    type: 'government_proclamation',
    title: 'Proclamation No. 1264, s. 2026 — Eid’l Adha',
    sourceUrl: 'https://pco.gov.ph/news_releases/palace-declares-may-27-as-a-regular-holiday-for-eidl-adha-observance/',
    publicationDate: '2026-05-21',
    effectivityDate: '2026-05-27',
    verificationStatus: 'verified',
    note: 'Government announcement of the 2026 national holiday date.',
  },
  {
    code: 'BIR-RMC-55-2026',
    type: 'revenue_memorandum_circular',
    title: 'Reminder on alphalist submission obligations for withholding agents',
    sourceUrl: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2055-2026%20Digest.pdf',
    publicationDate: '2026-05-26',
    verificationStatus: 'verified',
    note: 'Official 2026 BIR circular with alphalist relationships and example cadence/deadline statements; requirement identity and all exceptions still need normalization.',
  },
  {
    code: 'BIR-RMC-25-2024',
    type: 'revenue_memorandum_circular',
    title: 'Quarterly Alphalist of Payees file structure',
    sourceUrl: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2025-2024%20Annex%20A.pdf',
    publicationDate: '2024-01-01',
    verificationStatus: 'partially_verified',
    note: 'Official file-structure annex supporting the QAP relationship to BIR Form 1601EQ; effective and universal applicability requires reconciliation.',
  },
  {
    code: 'BIR-RMC-3-2006',
    type: 'revenue_memorandum_circular',
    title: 'SAWT and MAP electronic file structure and attachment guidance',
    sourceUrl: 'https://bir-cdn.bir.gov.ph/BIR/pdf/27815rmc%2003-2006.pdf',
    publicationDate: '2006-01-18',
    verificationStatus: 'partially_verified',
    note: 'Official source describing SAWT/MAP as attachments in the cited contexts; current applicability and supersession require reconciliation.',
  },
  {
    code: 'BIR-RMC-34-2025',
    type: 'revenue_memorandum_circular',
    title: 'Submission of required attachments',
    sourceUrl: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2034-2025%20Annex%20C.pdf',
    publicationDate: '2025-04-01',
    verificationStatus: 'partially_verified',
    note: 'Official attachment/submission reference covering eAFS and examples of filing/payment/electronic evidence.',
  },
  {
    code: 'BIR-RMC-46-2026',
    type: 'revenue_memorandum_circular',
    title: 'eAFS submission procedure and 2025 AFS extension',
    sourceUrl: 'https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2046-2026%20Digest.pdf',
    publicationDate: '2026-05-18',
    verificationStatus: 'verified',
    note: 'Official example of a specific extension affecting eAFS attachments without extending the underlying annual income tax return deadline.',
  },
  {
    code: 'BIR-TAX-REMINDER-2026',
    type: 'bir_calendar',
    title: 'BIR Tax Reminder / 2026 published reminder entries',
    sourceUrl: 'https://www.bir.gov.ph/Tax-Reminder?q=Orus',
    verificationStatus: 'partially_verified',
    note: 'Official BIR reminder surface used as a validation/reference dataset; it is not the sole rules engine.',
  },
  {
    code: 'BIR-EFPS-FAQ-DEADLINES',
    type: 'bir_web_page',
    title: 'eFPS FAQ — form deadline reference',
    sourceUrl: 'https://efps.bir.gov.ph/eFPSFAQ.html',
    verificationStatus: 'verified',
    note: 'Official eFPS reference for selected statutory deadline patterns. Channel, taxpayer, period, and exception rules remain governed elsewhere.',
  },
];

export const taxTypes: TaxTypeSeed[] = [
  { code: 'CIT', label: 'CIT', operatingCategory: 'cit', verificationStatus: 'verified', sourceCode: 'BIR-RMC-110-2025' },
  { code: 'VAT', label: 'VAT', operatingCategory: 'vat_percentage', verificationStatus: 'verified', sourceCode: 'BIR-RMC-110-2025' },
  { code: 'PERCENTAGE_TAX', label: 'Percentage Tax', operatingCategory: 'vat_percentage', verificationStatus: 'verified', sourceCode: 'BIR-RMC-110-2025' },
  { code: 'WHT', label: 'Withholding Tax', operatingCategory: 'wht', verificationStatus: 'verified', sourceCode: 'BIR-RMC-110-2025' },
  { code: 'OTHERS', label: 'Others', operatingCategory: 'others', verificationStatus: 'verified', sourceCode: 'BIR-RMC-110-2025' },
];

export const filingChannels: FilingChannelSeed[] = [
  { code: 'EFPS', label: 'eFPS', verificationStatus: 'verified', sourceCode: 'BIR-EFPS-JOBAIDS' },
  { code: 'EBIRFORMS', label: 'eBIRForms', verificationStatus: 'partially_verified', sourceCode: 'BIR-FORMS-CATALOG' },
  { code: 'ESUBMISSION', label: 'eSubmission', verificationStatus: 'partially_verified', sourceCode: 'BIR-RMC-110-2025' },
  { code: 'EAFS', label: 'eAFS', verificationStatus: 'partially_verified', sourceCode: 'BIR-RMC-110-2025' },
  { code: 'UNRESOLVED', label: 'Unresolved channel', verificationStatus: 'unresolved', sourceCode: 'BIR-RMC-110-2025' },
];

export const forms: FormSeed[] = [
  { formNumber: '0605', title: 'Payment Form', taxTypeCodes: [], usualTiming: 'Event or payment-specific; calendar rule required', usualTimingStatus: 'unresolved', usualTimingSourceCode: 'BIR-TAX-REMINDER-2026', verificationStatus: 'verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'Cross-category payment form; it is not assigned to one operating tax type.' },
  { formNumber: '0619-E', title: 'Monthly Remittance Form of Creditable Income Taxes Withheld (Expanded)', taxTypeCodes: ['WHT'], usualTiming: 'Monthly · date varies by eFPS group/channel', usualTimingStatus: 'partially_verified', usualTimingSourceCode: 'BIR-TAX-REMINDER-2026', verificationStatus: 'verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'Official form title; the published reminder shows channel/group-specific monthly dates.' },
  { formNumber: '0619-F', title: 'Monthly Remittance Form of Final Income Taxes Withheld', taxTypeCodes: ['WHT'], usualTiming: 'Monthly · date varies by eFPS group/channel', usualTimingStatus: 'partially_verified', usualTimingSourceCode: 'BIR-TAX-REMINDER-2026', verificationStatus: 'verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'Official form title; the published reminder shows channel/group-specific monthly dates.' },
  { formNumber: '1600', title: 'Monthly Remittance Return of VAT and Other Percentage Taxes Withheld', taxTypeCodes: ['WHT'], usualTiming: 'Monthly · applicable calendar date', usualTimingStatus: 'unresolved', usualTimingSourceCode: 'BIR-TAX-REMINDER-2026', verificationStatus: 'partially_verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'Official form listing; current requirement relationship and scope remain under reconciliation.' },
  { formNumber: '1600WP', title: 'Remittance Return of Percentage Tax on Winnings and Prizes Withheld', taxTypeCodes: ['WHT'], usualTiming: 'Event/month-specific · applicable calendar date', usualTimingStatus: 'partially_verified', usualTimingSourceCode: 'BIR-TAX-REMINDER-2026', verificationStatus: 'partially_verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'Official form listing; exact applicability and deadline remain rule-governed.' },
  { formNumber: '1601-C', title: 'Monthly Remittance Return of Income Taxes Withheld on Compensation', taxTypeCodes: ['WHT'], usualTiming: 'Monthly · date varies by eFPS group/channel', usualTimingStatus: 'partially_verified', usualTimingSourceCode: 'BIR-TAX-REMINDER-2026', verificationStatus: 'verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'Official form title; the published reminder shows channel/group-specific monthly dates.' },
  { formNumber: '1601-EQ', title: 'Quarterly Remittance Return of Creditable Income Taxes Withheld (Expanded)', taxTypeCodes: ['WHT'], usualTiming: 'Quarterly · applicable calendar date', usualTimingStatus: 'partially_verified', usualTimingSourceCode: 'BIR-TAX-REMINDER-2026', verificationStatus: 'verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'Official form title; exact deadline depends on the governed requirement and applicable context.' },
  { formNumber: '1702-RT', title: 'Annual Income Tax Return for Corporation, Partnership and Other Non-Individual Taxpayer Subject Only to Regular Income Tax Rate', taxTypeCodes: ['CIT'], usualTiming: 'Annual · 15th day of the 4th month after fiscal year-end', usualTimingStatus: 'verified', usualTimingSourceCode: 'BIR-EFPS-FAQ-DEADLINES', verificationStatus: 'verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'The eFPS reference states the annual deadline pattern; exact dates remain period and rule derived.' },
  { formNumber: '2550Q', title: 'Quarterly Value-Added Tax (VAT) Return', taxTypeCodes: ['VAT'], usualTiming: 'Quarterly · within 25 days after quarter-end', usualTimingStatus: 'verified', usualTimingSourceCode: 'BIR-EFPS-FAQ-DEADLINES', verificationStatus: 'verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'The eFPS reference states the quarterly deadline pattern; adjusted dates remain calendar-derived.' },
  { formNumber: '2551M', title: 'Monthly Percentage Tax Return', taxTypeCodes: ['PERCENTAGE_TAX'], usualTiming: 'Monthly · coverage/deadline requires verification', usualTimingStatus: 'unresolved', usualTimingSourceCode: 'BIR-TAX-REMINDER-2026', verificationStatus: 'partially_verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'Official form listing; current requirement relationship and scope remain under reconciliation.' },
  { formNumber: '2551Q', title: 'Quarterly Percentage Tax Return', taxTypeCodes: ['PERCENTAGE_TAX'], usualTiming: 'Quarterly · applicable calendar date', usualTimingStatus: 'partially_verified', usualTimingSourceCode: 'BIR-TAX-REMINDER-2026', verificationStatus: 'verified', sourceCode: 'BIR-FORMS-CATALOG', note: 'Published 2026 reminder entries show quarter-end filing dates; exact rule context remains governed.' },
];

export const unresolvedResearchItems = [
  'Complete row-level BIR Requirement Master inventory and component classification.',
  'Map every 2026 published calendar row to a Requirement Master ID or explicit unmapped-review record.',
  'Reconcile current BIR form titles/revisions and form-to-requirement relationships.',
  'Reconcile current RDO/LTS/other office records and effective dates.',
  'Reconcile eFPS group classifications and channel-dependent deadlines.',
  'Reconcile 2026 holiday proclamations and each deadline adjustment authority.',
];
