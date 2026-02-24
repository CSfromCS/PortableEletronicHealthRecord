# Recommended Issue Implementation Order

> Analysis of the 9 open issues as of 2026-02-24, with recommended
> implementation sequence based on dependency chains, complexity, and
> daily-use value for medical clerks.

---

## Issue Inventory

| Priority | Issue | Title | Complexity | Depends on | Existing PR |
|----------|-------|-------|------------|------------|-------------|
| 1 | #15 | Set up Copilot instructions | Low | — | PR #16 (draft) |
| 2 | #5 | Addition of history and PE – Profile page | Low | — | — |
| 3 | #18 | Add "Others" – Labs tab | Low | — | — |
| 4 | #6 | Copy/retain inputs from latest entry – FRICHMOND | Medium | — | — |
| 5 | #8 | Rework Electrolytes/Renal → Blood Chemistry – Labs tab | High | — | — |
| 6 | #9 | Add ABG template – Labs tab | High | — | PR #14 (draft) |
| 7 | #10 / #12 | Report Tab reformatting (combine both) | Very High | #8, #9 | PR #11, #13 (drafts) |
| 8 | #17 | Multiple photo upload – Photos tab | High | — | — |

---

## Rationale

### Phase 1 — Quick wins (independent, low risk)

**1. #15 — Set up Copilot instructions**
- Already has PR #16 in draft; just needs review and merge.
- Improves quality and speed of all subsequent agent-assisted work.
- Zero risk to user-facing behavior.

**2. #5 — Addition of history and PE – Profile page**
- Adds 5 text boxes (CC, HPI, PMH, PE, Clinical Summary) to the Profile tab.
- Simple schema addition (`Patient` type + Dexie migration) with no downstream
  dependencies.
- High value: clerks need this data ready "just in case" the attending asks
  during rounds.

**3. #18 — Add "Others" – Labs tab**
- Adds one new lab template with 2 fields (custom label + freeform result).
- No impact on existing templates or report formatting logic.
- Lets users capture any non-standard lab immediately rather than waiting for a
  dedicated template.

### Phase 2 — Core workflow improvement

**4. #6 — Copy/retain inputs from latest FRICHMOND entry**
- Medium complexity: needs a "Copy from latest" button on the FRICHMOND form
  that pre-fills all fields from the most recent entry for the same patient.
- Independent of all other issues.
- High daily-use impact: FRICHMOND is updated every 12 hours and most fields
  carry over unchanged.

### Phase 3 — Lab template foundations (required before reporting rework)

**5. #8 — Rework Electrolytes/Renal → Blood Chemistry**
- Renames the existing template, expands from 7 to 31+ fields, adds ULN
  (upper limit of normal) inputs for specific analytes, and normal-value
  range inputs for thyroid function tests.
- **Must be completed before #12** because the Report Tab reformatting
  specification includes Blood Chemistry–specific formatting rules
  (ULN multiplier display, sodium delta calculations, thyroid NV ranges)
  that depend on these new fields existing.

**6. #9 — Add ABG template**
- Adds a new structured template with auto-calculated oxygenation indices
  (pO2/FiO2, Desired FiO2) and age-adjusted normal values.
- Already has PR #14 in draft.
- **Must be completed before #12** because the reporting spec includes
  ABG-specific comparison and Desired FiO2 display rules.

### Phase 4 — Reporting overhaul (depends on Phase 3)

**7. #10 + #12 — Report Tab reformatting (combine into one effort)**
- #12 is a comprehensive superset of #10; they should be merged into a
  single implementation.
- Very high complexity: covers 13 specification sections including
  header standardization, lab comparison mode, ULN multiplier display,
  sodium delta calculations, ABG Desired FiO2 display, thyroid NV
  ranges, urinalysis comparison rules, multi-patient vitals, orders
  filtering, and census report restructuring.
- Depends on #8 and #9 for the Blood Chemistry and ABG field structures.
- Existing draft PRs #11 and #13 cover basic formatting; the advanced
  rules (Sections 5–10, 13) still need implementation.

### Phase 5 — UX enhancement (independent, highest complexity)

**8. #17 — Multiple photo upload**
- Requires schema changes (grouping multiple photos under a single
  block), new UI components (carousel viewer, batch upload, count
  indicator), and camera integration for batch capture.
- Fully independent of all other issues.
- Deferred to last because it has the highest UX complexity and the
  current single-photo workflow is functional.

---

## Dependency Graph

```
#15 (Copilot setup)
 │
 ▼
#5 (Profile H&P) ──────────────────────────────┐
#18 (Others lab) ───────────────────────────────┤
#6 (FRICHMOND copy) ───────────────────────────┤
 │                                              │
#8 (Blood Chemistry) ──┐                       │
#9 (ABG template) ─────┤                       │
                        ▼                       │
               #10/#12 (Report reformatting) ◄──┘
                        │
                        ▼
               #17 (Multi-photo upload)
```

Issues #5, #18, #6, and #17 are fully independent and can be parallelized.
Issues #8 and #9 are independent of each other but both block #10/#12.

---

## Notes

- **PR consolidation:** #10 and #12 cover the same reporting tab. #12's
  spec is the authoritative source. Recommend closing #10 (and its
  PR #11) in favor of #12 (PR #13) to avoid merge conflicts.
- **Existing draft PRs:** #14 (ABG) and #16 (Copilot setup) appear
  near-complete and should be reviewed/merged first for quick progress.
- **Schema migrations:** #5 and #8 both add fields to the patient /
  labs schema. Implementing them sequentially avoids migration version
  conflicts.
