# Philippine Tax Knowledge Reconciliation Register

**Purpose:** development/research control artifact for the TaxMonWeb tax foundation. It is not a production BIR Center screen and does not itself authorize generated compliance work.

**Research cut:** 2026-10-05

## Authority register

| Source ID | Authority | Use | Status |
|---|---|---|---|
| BIR-RMC-110-2025 | [RMC No. 110-2025](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%20110-2025.pdf) | Confirms the 2026 Interactive Tax Calendar, forms, attachments/reports, directory, and payment references. | Verified |
| BIR-FORMS-CATALOG | [BIR Forms](https://www.bir.gov.ph/bir-forms) | Official form catalog endpoint. Individual title/revision extraction remains row-level work. | Verified |
| BIR-EFPS-JOBAIDS | [eFPS Jobaids](https://efps.bir.gov.ph/efps-war/efpsJobaids.xhtml) | Official eFPS form/facility reference. | Partially verified |
| BIR-RMC-55-2026 | [RMC No. 55-2026](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2055-2026%20Digest.pdf) | Withholding/alphalist relationships and example cadence statements. | Verified |
| BIR-RMC-25-2024 | [RMC No. 25-2024 Annex A](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2025-2024%20Annex%20A.pdf) | QAP file structure associated with Form 1601EQ. | Partially verified |
| BIR-RMC-3-2006 | [RMC No. 3-2006](https://bir-cdn.bir.gov.ph/BIR/pdf/27815rmc%2003-2006.pdf) | SAWT/MAP attachment and file-structure reference. | Partially verified; current applicability requires reconciliation |
| BIR-RMC-34-2025 | [RMC No. 34-2025 Annex C](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2034-2025%20Annex%20C.pdf) | AFS/eAFS and filing/payment evidence examples. | Partially verified |
| BIR-RMC-46-2026 | [RMC No. 46-2026](https://bir-cdn.bir.gov.ph/BIR/pdf/RMC%20No.%2046-2026%20Digest.pdf) | Specific eAFS extension example and its boundary. | Verified for the cited extension |
| BIR-TAX-REMINDER-2026 | [BIR Tax Reminder](https://www.bir.gov.ph/Tax-Reminder?q=Orus) | Published reminder entries for calendar validation. | Partially verified; not the rules engine |
| BIR-RR-RDO-DIRECTORY-2024 | [BIR Revenue Region/RDO directory](https://bir-cdn.bir.gov.ph/BIR/pdf/citizens-charter-rr-rdo-2024-v3.pdf) | Office structure/contact reference. | Partially verified; current reconciliation required |
| PH-PROC-1006-2025 | [2026 holiday Proclamation No. 1006](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/7/99678) | National regular/special holiday dates. | Verified |
| PH-PROC-1189-2026 | [Eid’l Fitr 2026](https://pco.gov.ph/news_releases/proclamation-no-1189-s-2026-declaring-friday-20-march-2026-a-regular-holiday-throughout-the-country-in-observance-of-eidl-fitr-feast-of-ramadhan/) | Later national holiday authority. | Verified |
| PH-PROC-1264-2026 | [Eid’l Adha 2026](https://pco.gov.ph/news_releases/palace-declares-may-27-as-a-regular-holiday-for-eidl-adha-observance/) | Later national holiday authority. | Verified |

## Requirement reconciliation matrix

These are candidate requirement/work-package rows, not automatically approved legal requirements. The identity column is stable within this research artifact; rows marked unresolved must not seed authoritative generated work.

| Candidate ID | Requirement / package | Category | Form / artifact | Frequency | Components / relationship | Channel | Authority | Verification |
|---|---|---|---|---|---|---|---|---|
| CAND-CIT-ANNUAL | Corporate annual income tax return family | CIT | Form/version unresolved | Annual | Filing, payment if applicable, AFS/other attachments where applicable | Channel depends on taxpayer/rule | BIR-RMC-110-2025; BIR-RMC-34-2025 | Unresolved row-level identity/applicability |
| CAND-CIT-QUARTERLY | Corporate quarterly income tax return family | CIT | Form/version unresolved | Quarterly | Filing, payment if applicable, SAWT if applicable | Channel unresolved | BIR-TAX-REMINDER-2026; BIR-RMC-110-2025 | Unresolved |
| CAND-VAT-RETURN | VAT return family | VAT / Percentage Tax | Form/version unresolved | Monthly/Quarterly cadence requires reconciliation | Filing, payment if applicable, attachments where applicable | eFPS/eBIRForms/other rule context | BIR-RMC-110-2025; BIR-TAX-REMINDER-2026 | Unresolved |
| CAND-PERCENTAGE-RETURN | Percentage tax return family | VAT / Percentage Tax | Form/version unresolved | Monthly/Quarterly cadence requires reconciliation | Filing, payment if applicable | Channel unresolved | BIR-RMC-110-2025; BIR-TAX-REMINDER-2026 | Unresolved |
| CAND-WHT-MONTHLY | Withholding tax remittance family | WHT | 1601-C / 0619-E / 0619-F appear in official reminders; revisions/applicability require row review | Monthly | Filing, payment, MAP/alphalist where applicable | eFPS/non-eFPS distinctions appear in reminders | BIR-RMC-55-2026; BIR-TAX-REMINDER-2026 | Partially verified |
| CAND-WHT-QAP | Quarterly Alphalist of Payees | WHT | QAP associated with 1601EQ | Quarterly | Candidate component of withholding return; separate electronic evidence | eSubmission/eFPS attachment context | BIR-RMC-25-2024; official 1601EQ guidance | Partially verified; component-vs-requirement decision pending row review |
| CAND-WHT-SAWT-MAP | SAWT / MAP submission family | WHT | Electronic data files | As-needed/period-linked | Candidate attachment/component; file and validation evidence | Electronic submission context | BIR-RMC-3-2006; BIR Downloadables | Partially verified; current applicability/supersession pending |
| CAND-AFS-EAFS | AFS and other attachments submission | Others | AFS/other attachments | Annual/event-linked | Candidate separate submission or package component; TRN/confirmation evidence | eAFS, contingency channel under approved source | BIR-RMC-34-2025; BIR-RMC-46-2026 | Partially verified; legal identity/exception rules pending |
| CAND-1709 | Related-party transaction information return | Others | BIR Form 1709 reference appears in official attachment guidance | Annual/event-linked | Filing/attachments/evidence relationship requires reconciliation | Channel unresolved | BIR-RMC-34-2025 | Partially verified |
| CAND-ESALES | e-Sales report family | Others | Form/artifact unresolved | Monthly/event-linked | Separate electronic submission candidate | eSubmission context | BIR-TAX-REMINDER-2026 | Partially verified |
| CAND-EXCISE | Excise return/submission family | Others | 2200-M / 2200-C appear in official reminders | Monthly/event-linked | Filing, payment, related schedules where applicable | Channel/context unresolved | BIR-TAX-REMINDER-2026 | Partially verified |
| CAND-DST | Documentary stamp tax return family | Others | Form/version unresolved | Monthly/event-linked | Filing/payment relationship unresolved | Channel unresolved | BIR-RMC-110-2025 | Unresolved |
| CAND-SRS | Supplier/list submission family | Others | SRS validation module is listed by BIR | As-needed/period-linked | Requirement identity and current legal applicability unresolved | Electronic submission context unresolved | BIR Downloadables | Unresolved |

## 2026 calendar reconciliation sample

The following official reminder rows are registered as validation samples. They are not yet authoritative TaxMonWeb calendar rows because they do not have approved Requirement Master IDs and complete rule context.

| Published date | Published entry summary | Period/event shown | Source | TaxMonWeb status |
|---|---|---|---|---|
| 2026-09-10 | 1600-VT / 1600-PT and MAP; selected eFPS/non-eFPS context | August 2026 | BIR-TAX-REMINDER-2026 | UNMAPPED BIR REQUIREMENT — REVIEW REQUIRED |
| 2026-09-10 | e-Sales report example | August 2026 | BIR-TAX-REMINDER-2026 | UNMAPPED BIR REQUIREMENT — REVIEW REQUIRED |
| 2026-09-11 | 1601-C / 0619-E / 0619-F, eFPS Group E | August 2026 | BIR-TAX-REMINDER-2026 | UNMAPPED BIR REQUIREMENT — REVIEW REQUIRED |
| 2026-09-12 | 1601-C / 0619-E / 0619-F, eFPS Group D | August 2026 | BIR-TAX-REMINDER-2026 | UNMAPPED BIR REQUIREMENT — REVIEW REQUIRED |

No row is marked MATCH until the published entry maps to a Requirement Master version and the rule-derived base/adjusted dates are calculated from approved content.

## Current coverage accounting

| Area | Current state |
|---|---|
| Requirement candidates | 13 research candidates; none promoted to verified production legal content in this pass |
| Forms | 4 form-number references seeded as partially verified; complete titles/revisions remain open |
| Tax types | Operating taxonomy seeded: CIT, VAT, Percentage Tax, WHT, Others |
| Filing channels | eFPS verified as a source-backed facility/channel; eBIRForms, eSubmission, eAFS and unresolved channel retained with partial/unresolved status |
| eFPS groups | Schema exists; current group classifications remain unresolved until sourced and reconciled |
| BIR offices | Single canonical office master exists; current row-level directory import remains partial/unresolved |
| Holidays | 2026 national holiday records seeded with official proclamation provenance; local holiday coverage and BIR adjustment effects remain separate research |
| 2026 calendar | Published sample rows captured as unmapped review items; full row-level reconciliation remains open |

## Explicit unresolved content work

1. Complete the full BIR Requirement Master inventory from current official sources.
2. Reconcile each candidate’s independent-identity versus component classification.
3. Reconcile current form revisions, channel rules, eFPS group rules, and office directory records.
4. Normalize the complete 2026 Interactive Tax Calendar into row-level entries.
5. Reconcile BIR deadline extensions and contingency advisories against released calendar versions.
6. Establish source-backed rules for local holidays and non-working-day adjustments where legally applicable.

Until these items are resolved and approved, the affected content remains visible as unresolved and cannot generate authoritative compliance work.
