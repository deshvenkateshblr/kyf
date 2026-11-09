# Vividnova Vault Core & KYF Vault Architecture Specification (`vault.md`)

> **Location:** `js/kyf-vault.js`  
> **Status:** ✅ Production Ready (v2.0.0)  
> **Test Suite:** `tests/vault.test.mjs` (31/31 Passing)  
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
2. **Tier 2 — `KYF_VAULT` (KYF Specialization):** A concrete instance tailored for Know Your Finance that unifies all four financial domains (Cadence, Portfolio Holdings, Portfolio Goals, and Life Goals) across IndexedDB and `localStorage` with non-destructive passthrough guarantees.

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
│  - App metadata: "Know Your Finance", .kyf, "kyf-vault", v2.0.0       │
│  - Section 1: "cadence"        -> localStorage: kyf_cadence_v3         │
│  - Section 2: "portfolio"      -> IndexedDB: KYF_PORTFOLIO_DB.holdings │
│  - Section 3: "portfolioGoals" -> IndexedDB: KYF_PORTFOLIO_DB.goals    │
│  - Section 4: "goals"          -> localStorage: kyf_goals_v1           │
│  - Extra passthrough data      -> localStorage: _kyf_vault_extra       │
│  - Payload normalizer supporting legacy bare-arrays & v1 exports       │
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

### Canonical `.kyf` Envelope (`v2.0.0`)
All `.kyf` vault files follow this standard structured JSON format:

```json
{
  "app": "Know Your Finance",
  "version": "2.0.0",
  "fileType": "kyf-vault",
  "encrypted": false,
  "savedAt": "2026-11-09T06:00:00.000Z",
  "data": {
    "cadence": [
      {
        "id": "goal-home",
        "title": "Home Purchase Down Payment",
        "section": "goals",
        "category": "Milestone",
        "status": "active",
        "dueDate": "2026-12-31"
      }
    ],
    "portfolio": [
      {
        "id": "hold_eq_sbin",
        "name": "State Bank of India",
        "member": "Rajesh",
        "custodian": "Zerodha",
        "assetClass": "Equities",
        "pricingMode": "LIVE_EQUITY",
        "instrumentMeta": { "symbol": "SBIN", "quantity": 500, "avgBuyPrice": 640.0 },
        "investedValue": 320000,
        "allocations": [{ "goalId": "goal_retirement", "percentage": 70 }]
      }
    ],
    "portfolioGoals": [
      {
        "id": "goal_retirement",
        "name": "Financial Independence / Retirement",
        "icon": "🌴",
        "targetYear": 2038,
        "baseTargetINR": 35000000,
        "inflationCategory": "CPI",
        "priority": "HIGH"
      }
    ],
    "goals": [
      {
        "id": "goal-retire",
        "title": "Financial Freedom & Retirement Corpus",
        "category": "retirement",
        "presentValue": 25000000,
        "inflationRate": 6.0,
        "expectedReturn": 12.0
      }
    ],
    "marketReviewDate": "2026-11-09T06:00:00.000Z"
  }
}
```

### Storage Mapping

| Domain Section | Memory / Source | Primary Storage | Fallback / Cache |
| :--- | :--- | :--- | :--- |
| **`cadence`** | Active page `activities` | `localStorage["kyf_cadence_v3"]` | `kyf_cadence_v2`, `kyf_cadence_v1` |
| **`portfolio`** | Active page `rawHoldings` | IndexedDB `KYF_PORTFOLIO_DB` (`holdings`) | `localStorage["kyf_user_holdings"]` |
| **`portfolioGoals`** | Active page `rawGoals` | IndexedDB `KYF_PORTFOLIO_DB` (`goals`) | `localStorage["kyf_user_goals"]` |
| **`goals`** | Active page `goals` | `localStorage["kyf_goals_v1"]` | — |
| **Extra Data** | Page-specific state / future extensions | `localStorage["_kyf_vault_extra"]` | In-memory passthrough |

---

## 4. Non-Destructive Round-Tripping (Zero Data Loss)

The core innovation that prevents data loss across pages is **non-destructive round-tripping**:

1. **On Save from ANY Page:**
   - The vault queries the active page hook (`hook.getLocalData()`) for any unsaved in-memory state.
   - For every registered section *not* modified by the current page, the vault reads the latest persisted state from IndexedDB or `localStorage`.
   - The vault merges all extra/unrecognized keys from `localStorage["_kyf_vault_extra"]`.
   - Result: Saving from `cadence.html` reads portfolio from IndexedDB and goals from `localStorage`, outputting a 100% complete `.kyf` file.

2. **On Open on ANY Page:**
   - The normalizer inspects the incoming file.
   - Registered sections (`cadence`, `portfolio`, `portfolioGoals`, `goals`) are written to their respective IndexedDB and `localStorage` stores.
   - Any unknown/future keys (e.g. `budget`, `customTags`, `marketReviewDate`) are saved into `_kyf_vault_extra`.
   - Active page hook (`hook.onAfterOpen()`) is called so the currently visible page updates its UI immediately without a page reload.

3. **Intelligent Legacy Normalization:**
   - **Bare arrays:** Detected by inspecting first element:
     - `recurrence` / `cadenceCategory` ➔ parsed as `cadence`.
     - `assetClass` / `instrumentMeta` ➔ parsed as `portfolio`.
     - `presentValue` / `inflationRate` ➔ parsed as planner `goals`.
     - `targetYear` / `baseTargetINR` ➔ parsed as `portfolioGoals`.
   - **Old `v1.x` Files:** Disambiguates `data.goals` between Portfolio Envelopes (`targetYear`) and Life Planner Goals (`presentValue`).

---

## 5. Developer Guide: How to Use

### A. Integrating a KYF Page

Every KYF HTML page includes the script:
```html
<script src="js/kyf-vault.js?v=1.4.8"></script>
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
  "version": "2.1.0",
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

The decrypted `ciphertext` produces the standard `data: { cadence, portfolio, portfolioGoals, goals, ... }` payload.

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

