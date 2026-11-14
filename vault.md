# Vividnova Vault Core & KYF Vault Architecture Specification (`vault.md`)

> **Location:** `js/kyf-vault.js`  
> **Status:** ✅ Production Ready (v3.0.0)  
> **Test Suite:** `tests/vault.test.mjs` (53/53 Passing)  
> **Scope:** Unified multi-page on-device persistence for Know Your Finance (KYF) and reusable generic storage engine for all Vividnova web applications.

---

## 1. Executive Summary & Problem Solved

### The Problem
Previously, `.kyf` export and import routines were fragmented across individual pages:
- `cadence.html` saved `{ data: { cadence: [...] } }` and only loaded cadence.
- `market-performance.js` saved `{ data: { cadence, marketReviewDate } }`.
- `goals.html` saved `{ data: { goals: [...] } }`.
- `portfolio.html` saved cadence, portfolio, and portfolio goals, but omitted life planner goals.
- `real-estate-calculator.html` had unwired toolbar buttons.

If a user configured their portfolio and goals, then navigated to `cadence.html` and clicked **"💾 Save Data"**, the exported `.kyf` file **silently dropped the portfolio and goals**. Opening that file in any page caused irreversible data loss.

### The Solution
A unified, two-tier architecture implemented in a single shared file: [`js/kyf-vault.js`](file:///C:/Venkatesh/KYF/js/kyf-vault.js):
1. **Tier 1 — `VividVault` (Generic Engine):** An application-agnostic, zero-dependency client-side file save/open and vault management engine ready to be dropped into **any** Vividnova app (*Canvas*, *WordPower*, *Calculators*, etc.).
2. **Tier 2 — `KYF_VAULT` (KYF Specialization):** A concrete instance tailored for Know Your Finance that unifies all core financial domains (Cadence Roadmap, Portfolio Holdings, Unified Life & Portfolio Goals with `SAVE` vs `COVER` kinds, and First-Class Family Members) across IndexedDB and `localStorage` with non-destructive passthrough guarantees.

---

## 2. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│  Tier 1: VividVault (Generic Engine)                                   │
│  - Zero external dependencies; runs 100% client-side in the browser    │
│  - Canonical envelope: { app, version, fileType, savedAt, data }       │
│  - Non-destructive round-tripping: unknown/extra keys never dropped   │
│  - Pluggable section registry (read, write, summary, validate)         │
│  - UI auto-wiring (file inputs, open buttons, save buttons)            │
│  - Automatic toast notifications & page lifecycle event hooks          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ configures & registers sections
┌───────────────────────────────────▼────────────────────────────────────┐
│  Tier 2: KYF_VAULT (Know Your Finance Specialization)                  │
│  - App metadata: "Know Your Finance", .kyf, "kyf-vault", v3.0.0       │
│  - Section 1: "cadence"   -> localStorage: kyf_cadence_v3              │
│  - Section 2: "portfolio" -> IndexedDB: KYF_PORTFOLIO_DB.holdings      │
│  - Section 3: "goals"     -> IndexedDB: KYF_PORTFOLIO_DB.goals         │
│                              (Unified schema: SAVE & COVER; absorbs    │
│                               retired kyf_goals_v1 via mergeGoalLists) │
│  - Section 4: "members"   -> IndexedDB: KYF_PORTFOLIO_DB.members       │
│  - Extra passthrough data -> localStorage: _kyf_vault_extra            │
│  - Payload normalizer supporting legacy bare-arrays, v1/v2 files       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ loaded by every page
┌───────────────────────────────────▼────────────────────────────────────┐
│  Integrated Pages (Universal Toolbar: 📂 Open & 💾 Save Data)          │
│  ├── cadence.html               (Cadence Action Roadmap)               │
│  ├── portfolio.html             (Family Portfolio Mark-to-Market)      │
│  ├── goals.html                 (Life Goals Inflation Planner)         │
│  ├── market-performance.html    (Institutional Benchmarks)             │
│  └── real-estate-calculator.html(Carpet vs Super Built-up Reality)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Schema & Vault Envelope Specification

### Canonical `.kyf` Envelope (`v3.0.0`)
All `.kyf` vault files follow this standard structured JSON format:

```json
{
  "app": "Know Your Finance",
  "version": "3.0.0",
  "fileType": "kyf-vault",
  "encrypted": false,
  "savedAt": "2026-11-13T12:00:00.000Z",
  "data": {
    "cadence": [
      {
        "id": "cad_tax",
        "title": "Advance Tax Q4 Due",
        "section": "tax",
        "category": "Quarterly",
        "status": "active",
        "dueDate": "2026-12-15"
      }
    ],
    "portfolio": [
      {
        "id": "hold_eq_sbin",
        "name": "State Bank of India",
        "member": "Self",
        "custodian": "Zerodha",
        "assetClass": "Equities",
        "pricingMode": "LIVE_EQUITY",
        "instrumentMeta": { "symbol": "SBIN", "quantity": 500, "avgBuyPrice": 640.0 },
        "investedValue": 320000,
        "allocations": [{ "goalId": "goal_retirement", "percentage": 70 }]
      }
    ],
    "goals": [
      {
        "id": "goal_retirement",
        "name": "Financial Independence / Retirement",
        "icon": "🌴",
        "category": "retirement",
        "kind": "SAVE",
        "priority": "ESSENTIAL",
        "status": "ACTIVE",
        "targetYear": 2038,
        "baseTargetINR": 35000000,
        "inflationCategory": "CPI",
        "inflationRate": null,
        "expectedReturn": 12.0,
        "manualSavedINR": 0,
        "ownerId": "mem_self",
        "notes": "Work-optional target corpus",
        "templateId": "work_optional",
        "createdAt": "2026-11-09T06:00:00.000Z"
      },
      {
        "id": "goal_term_life",
        "name": "Term Life Protection Cover",
        "icon": "👨‍👩‍👧",
        "category": "other",
        "kind": "COVER",
        "priority": "ESSENTIAL",
        "status": "ACTIVE",
        "targetYear": 0,
        "baseTargetINR": 0,
        "coverNeededINR": 25000000,
        "coverInPlaceINR": 10000000,
        "annualPremiumINR": 18500,
        "inflationCategory": "CPI",
        "inflationRate": null,
        "expectedReturn": null,
        "manualSavedINR": 0,
        "ownerId": "mem_self",
        "notes": "10-15x income replacement cover",
        "templateId": "term_life",
        "createdAt": "2026-11-09T06:00:00.000Z"
      }
    ],
    "members": [
      { "id": "mem_self", "name": "Self", "role": "Self", "avatar": "👤" },
      { "id": "mem_spouse", "name": "Spouse", "role": "Spouse", "avatar": "👩" },
      { "id": "mem_aarav", "name": "Aarav", "role": "Child", "avatar": "👦" }
    ],
    "marketReviewDate": "2026-11-13T12:00:00.000Z"
  }
}
```

### Storage Mapping

| Domain Section | Memory / Source | Primary Storage | Fallback / Cache |
| :--- | :--- | :--- | :--- |
| **`cadence`** | Active page `activities` | `localStorage["kyf_cadence_v3"]` | `kyf_cadence_v2`, `kyf_cadence_v1` |
| **`portfolio`** | Active page `rawHoldings` | IndexedDB `KYF_PORTFOLIO_DB` (`holdings`) | `localStorage["kyf_user_holdings"]` |
| **`goals`** (Unified) | Active page `rawGoals` / `goals` | IndexedDB `KYF_PORTFOLIO_DB` (`goals`) | `localStorage["kyf_user_goals"]` (absorbs legacy `kyf_goals_v1`) |
| **`members`** | Active page `rawMembers` | IndexedDB `KYF_PORTFOLIO_DB` (`members`) | `localStorage["kyf_user_members"]` |
| **Extra Data** | Page-specific state / future extensions | `localStorage["_kyf_vault_extra"]` | In-memory passthrough |

---

### Unified Goals Specification: `SAVE` vs `COVER`

In v3.0.0, life planner goals and portfolio envelopes are unified into a single model defined in `js/kyf-goals.js` (`window.KYF_GOALS`) and stored under `data.goals[]`. Each goal declares its architectural `kind`:

| Dimension | `kind: "SAVE"` (Default / Corpus Accumulation) | `kind: "COVER"` (Risk Protection Shield) |
| :--- | :--- | :--- |
| **Primary Intent** | Wealth creation / corpus accumulation by a target year (Retirement, Child Education, Home Down Payment, Emergency Buffer). | Risk protection / insurance adequacy today (Term Life, Health Insurance / Super Top-Up, Personal Accident & Disability). |
| **Target Timing** | `targetYear` (e.g. `2032`, `2038`). | `targetYear: 0` (ongoing risk shield; no expiration milestone). |
| **Target Sizing** | `baseTargetINR` (target cost in today's rupee values). | `coverNeededINR` (statutory / calculated risk cover requirement). |
| **In-Force Sizing** | Derived from Portfolio virtual allocations (`allocations: [{ goalId, percentage }]`) + `manualSavedINR`. | `coverInPlaceINR` (sum assured across all active in-force insurance policies). |
| **Annual Premium** | N/A (monthly SIP / investment required). | `annualPremiumINR` (annual premium outlay paid for policies in force). |
| **Inflation Category**| `CPI`, `EDUCATION`, `MEDICAL`, or `CUSTOM` (`inflationRate`). | Defaults to `CPI` / `MEDICAL`; no compounding applied. |
| **Expected Return** | `expectedReturn` (% p.a. or derived from time horizon). | `expectedReturn: null` (protection policies carry no investment return). |
| **Portfolio Funding**| **Funded from Holdings:** virtual percentage slices of stocks, mutual funds, gold, etc. fund this goal. | **NEVER Funded from Holdings:** risk shields cannot be liquidated or funded by portfolio lots. Any allocation to a `COVER` goal falls back to Unallocated. |

---

## 4. Non-Destructive Round-Tripping (Zero Data Loss)

The core innovation that prevents data loss across pages is **non-destructive round-tripping**:

1. **On Save from ANY Page:**
   - The vault queries the active page hook (`hook.getLocalData()`) for any unsaved in-memory state.
   - For every registered section *not* modified by the current page, the vault reads the latest persisted state from IndexedDB or `localStorage`.
   - The vault merges all extra/unrecognized keys from `localStorage["_kyf_vault_extra"]`.
   - Result: Saving from `cadence.html` reads portfolio from IndexedDB and unified goals from `localStorage`/IndexedDB, outputting a 100% complete `.kyf` file.

2. **On Open on ANY Page:**
   - The normalizer inspects the incoming file.
   - Registered sections (`cadence`, `portfolio`, `goals`, `members`) are written to their respective IndexedDB and `localStorage` stores.
   - Any unknown/future keys (e.g. `budget`, `customTags`, `marketReviewDate`) are saved into `_kyf_vault_extra`.
   - Active page hook (`hook.onAfterOpen()`) is called so the currently visible page updates its UI immediately without a page reload.

3. **Intelligent Legacy Normalization & Automatic Upgrades:**
   - **Unified Goals Migration:**
     - v1 and v2 files carrying separate `portfolioGoals` (from portfolio) and `goals` (from planner) are seamlessly unified by `unifyGoals()` / `KYF_GOALS.mergeGoalLists()` into a single `data.goals` array.
     - The retired planner store (`localStorage["kyf_goals_v1"]`) is absorbed on first read/write and deleted from `localStorage`.
     - Legacy fields mapped: `presentValue` ➔ `baseTargetINR`, `currentSavings` ➔ `manualSavedINR`, `years` ➔ `targetYear = currentYear + years`, `priority: "COMPLETED"` ➔ `status: "ACHIEVED"`.
   - **Cadence Migration:**
     - Older files carrying generic starter milestone cards in Cadence are safely pruned via `KYF_GOALS.migrateCadence()`, delegating all milestones cleanly to the Goals module.
   - **Bare arrays:** Detected by inspecting first element:
     - `recurrence` / `cadenceCategory` ➔ parsed as `cadence`.
     - `assetClass` / `instrumentMeta` ➔ parsed as `portfolio`.
     - `presentValue` / `inflationRate` / `targetYear` / `baseTargetINR` ➔ normalized as unified `goals`.
     - `avatar` / `role` / `member` ➔ parsed as `members`.

---

## 5. Developer Guide: How to Use

### A. Integrating a KYF Page

Every KYF HTML page includes the script:
```html
<script src="js/kyf-vault.js?v=1.11.1"></script>
```

#### Basic Page (View-Only / Calculator):
To automatically wire the top navigation buttons (`#navOpenFileBtn`, `#navSaveDataBtn`, `#kyfFileInput`):
```javascript
if (window.KYF_VAULT) {
  window.KYF_VAULT.bindPageUI({
    fileInputId: "kyfFileInput",
    openBtnId: "navOpenFileBtn",
    saveBtnId: "navSaveDataBtn"
  });
}
```

#### Interactive Page (with In-Memory State & Live Re-Rendering):
```javascript
if (window.KYF_VAULT) {
  window.KYF_VAULT.registerPageHook({
    pageName: "cadence",
    // 1. Provide active in-memory data before saving
    getLocalData: () => {
      saveActivities(); // flush to storage
      return { cadence: activities };
    },
    // 2. React immediately when a user opens a file
    onAfterOpen: (vaultData, summary) => {
      loadActivities(); // reload from storage
      render();         // refresh DOM
    }
  });

  window.KYF_VAULT.bindPageUI({
    fileInputId: "kyfFileInput",
    openBtnId: "navOpenFileBtn",
    openBtnSecondaryId: "openFileHeroBtn",
    saveBtnId: "navSaveDataBtn",
    saveBtnSecondaryId: "exportCadenceBtn"
  });
}
```

---

### B. Using `VividVault` in Other Vividnova Applications

`VividVault` is completely app-agnostic. To use it in a new project (e.g. `WordPower` or `Canvas`):

```javascript
// 1. Instantiate the generic engine
const wordVault = new VividVault({
  appName: "WordPower Vocabulary",
  appSlug: "wordpower",
  fileExtension: ".wpv",
  fileType: "wordpower-vault",
  version: "1.0.0",
  defaultBaseName: "my-vocabulary"
});

// 2. Register application data sections
wordVault.registerSection("words", {
  read: async () => JSON.parse(localStorage.getItem("wp_words") || "[]"),
  write: async (data) => localStorage.setItem("wp_words", JSON.stringify(data)),
  summary: (data) => `${data.length} mastered words`,
  validate: (data) => Array.isArray(data)
});

wordVault.registerSection("streak", {
  read: async () => parseInt(localStorage.getItem("wp_streak") || "0", 10),
  write: async (val) => localStorage.setItem("wp_streak", String(val)),
  summary: (val) => `${val} day streak`
});

// 3. Bind UI buttons
wordVault.bindUI({
  fileInputId: "vaultFileInput",
  openBtnId: "btnOpenVault",
  saveBtnId: "btnSaveVault"
});

// 4. Or trigger programmatically
await wordVault.exportFile("my-backup.wpv");
await wordVault.openFile(fileObj);
```

---

## 6. Future Feature: Password Protection (AES-256-GCM)

### Motivation
Financial data stored in `.kyf` files includes exact net worth, asset quantities, bank balances, and real estate deeds. Users who back up their files to Google Drive, iCloud, or USB thumb drives require the option to encrypt their data with a master passphrase.

### Cryptographic Architecture
Encryption will be implemented client-side using the native W3C **Web Crypto API** (`window.crypto.subtle`), ensuring zero third-party dependencies and zero server exposure.

```
Passphrase (User Input)
      │
      ▼
PBKDF2 Key Derivation (HMAC-SHA-256, 100,000 iterations, 16-byte random salt)
      │
      ▼
AES-GCM-256 Symmetric Key
      │
      ├── Encrypt ──► Ciphertext + 16-byte Auth Tag (AES-GCM with 12-byte random IV)
      └── Decrypt ◄── Plaintext Payload Envelope
```

### Encrypted Vault Envelope Specification
When password protection is enabled, the outer `.kyf` envelope structure becomes:

```json
{
  "app": "Know Your Finance",
  "version": "3.1.0",
  "fileType": "kyf-vault",
  "encrypted": true,
  "savedAt": "2026-11-09T08:00:00.000Z",
  "crypto": {
    "kdf": {
      "algorithm": "PBKDF2",
      "hash": "SHA-256",
      "iterations": 100000,
      "salt": "dGhpcy1pcy1hLXJhbmRvbS1zYWx0LTE2Yg=="
    },
    "cipher": {
      "algorithm": "AES-GCM",
      "length": 256,
      "iv": "cmFuZG9tLTEyLWJ5dGUtaXY="
    }
  },
  "ciphertext": "base64-encoded-aes-gcm-ciphertext-with-auth-tag..."
}
```

The decrypted `ciphertext` produces the standard `data: { cadence, portfolio, goals, members, ... }` payload.

---

## 7. Password Protection Implementation Roadmap & TODO

The following phased checklist guides the future implementation of password protection:

### Phase 1: Cryptographic Primitives (`js/crypto-utils.js` or `VividVault.Crypto`)
- [ ] **Generate Random Bytes:** Helper for `crypto.getRandomValues(new Uint8Array(len))`.
- [ ] **Key Derivation (PBKDF2):**
  - Derive key from string passphrase with `PBKDF2`, `HMAC-SHA-256`, 100,000 iterations, 16-byte salt.
  - Export derived key for `AES-GCM` with length `256`.
- [ ] **Encryption Function:**
  - `encryptPayload(jsonString, passphrase) -> { encryptedPayload }`.
  - Encrypt with AES-GCM using unique 12-byte IV per export.
  - Return base64-encoded salt, IV, and ciphertext.
- [ ] **Decryption Function:**
  - `decryptPayload(encryptedPayload, passphrase) -> decryptedJsonString`.
  - Re-derive key from stored salt + iterations.
  - Decrypt and verify AES-GCM authentication tag.
  - Throw explicit error on authentication tag mismatch (tampering or wrong password).

### Phase 2: `VividVault` Core Integration
- [ ] Add `encrypted: boolean` option to `VividVault.prototype.exportFile()`.
- [ ] Update `VividVault.prototype.parseFile()`:
  - If `parsed.encrypted === true`, flag payload as requiring decryption.
- [ ] Add `VividVault.prototype.unlockAndImport(file, passphrase)`.

### Phase 3: UI & Modal Dialogs
- [ ] **Save Dialog Modal (`#vaultSaveModal`):**
  - Option 1: Quick Export (Plain `.kyf`, same as today).
  - Option 2: Encrypted Export with password and password confirmation inputs.
  - Password strength meter (warns on weak/empty passwords).
  - Prominent warning: *"There is no password reset. If you lose this password, your backup cannot be recovered."*
- [ ] **Open File Password Prompt Modal (`#vaultUnlockModal`):**
  - Triggers automatically when an encrypted `.kyf` file is dropped or selected.
  - Shows file name, saved date, and a password input field.
  - Inline error feedback on incorrect password ("Incorrect password or corrupted file").
  - "Cancel" button to abort import cleanly and reset the file input.

### Phase 4: Automated Testing & Verification
- [ ] Test round-trip: Encrypt with passphrase ➔ Decrypt with correct passphrase ➔ Verify exact object equivalence.
- [ ] Test failure case: Decrypt with incorrect passphrase ➔ Verify failure without state corruption.
- [ ] Test tampering case: Mutate 1 character of ciphertext ➔ Verify AES-GCM tag rejection.
- [ ] Test backward compatibility: Unencrypted `.kyf` files continue to open seamlessly with zero password prompt.

---

*Authored by Antigravity for Vividnova Know Your Finance (KYF).*

