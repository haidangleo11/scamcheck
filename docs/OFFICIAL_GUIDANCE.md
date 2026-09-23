# Source-backed web guidance

The web app uses `official-guidance.js` as its single, local catalogue of action
steps. AI still assesses message content, but its `actions` and `safeActions`
arrays are not displayed as instructions. This is not a guarantee that all
AI analysis is accurate or deterministic.

## Scope

- Main results, old saved results, public share action lists, quick rescue,
  contextual quiz answers, pre-transfer action lists and text/print exports.
- Five user-selected exposure states plus a general prevention playbook.
- Vietnamese and English share step identifiers and ordering.
- No automatic assumption that a quoted scam means the visitor already paid.
- No extension, Android, authentication, database or provider changes.
- Static library/simulation teaching material is not a fully audited official
  curriculum; this update standardises the action-guidance flow, not every
  sentence in the product.

## Source policy

Each action has fixed source IDs. Links cannot be supplied by model output or
share URLs. Sources include Vietnam's Ministry of Public Security, its People's
Police College I, Vietcombank and the US FTC. Specific VCB instructions are
labelled as such; FTC references supply technical advice, not US reporting
procedures for Vietnam. Text is a ScamCheck summary/translation, not official
endorsement. URLs, publication dates and review date are in the catalogue.

To update: read the primary source, check scope/jurisdiction, edit both languages,
retain the stable step ID, increment VERSION and the versioned script URL in
index.html and sw.js, then run the tests. Checklist storage is versioned so an
old checked position cannot silently refer to a different new step. Do not add
unverified hotlines, guarantees of recovery, or destructive device instructions.

## Verification and release

Run `node scripts/test-official-guidance.js`, `node scripts/test-web-ui.js`,
`node scripts/test-forum-auth.js`, `node scripts/smoke-test.js` and
`node scripts/test-feedback-api.js`.

Include `official-guidance.js` in any selected-file deployment alongside
index.html, web-ui.css and sw.js. It is in the offline app shell. If unavailable,
the interface shows a load error instead of substituting AI-generated steps.
Opening source links still requires a connection. No live production AI or
user accounts are required for the offline regression suite.
