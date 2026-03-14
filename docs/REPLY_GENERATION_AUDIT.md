# Reply Generation Logic Audit: English, Korean, Japanese

**Date:** 2025-03-14  
**Scope:** Tone/length Auto-manual independence, prompt structure consistency, EN/KO/JP alignment

---

## 1. Files Examined

| File | Purpose |
|------|---------|
| `replymate-backend/server.js` | Backend prompt assembly, tone switch, length handling, system prompts |
| `replymate-extension/content/gmail.js` | Extension: `buildLengthInstruction`, `buildLengthInstructionWithAuto`, `detectOptimalTone`, `detectOptimalLength`, payload construction |
| `replymate-extension/popup/popup.js` | Settings (tone, length, language) storage |

---

## 2. Findings

### 2.1 Tone/Length Auto–Manual Independence ✅

**Extension logic (gmail.js:1157–1159, 2081–2082):**

```javascript
const finalTone = userTone === "auto" ? detectOptimalTone(...).tone : userTone;
const finalLength = userLength === "auto" ? detectOptimalLength(...).length : userLength;
```

- Tone and length are resolved independently.
- No `if (tone === "auto" || length === "auto")` merging.
- Correct behavior:
  - **Tone=Auto, Length=Manual** → AI tone, user length
  - **Tone=Manual, Length=Auto** → User tone, AI length
  - **Both Auto** → AI decides both
  - **Both Manual** → Both followed exactly

### 2.2 Final Prompt Composition

**Backend (server.js:329–361):**

- `effectiveLengthInstruction` (includes explicit Tone/Length from extension) at top
- `toneInstructions` from backend switch in Instructions section
- Both tone and length are present in the final prompt

**Extension (gmail.js:1183–1190):**

- Prepends `Tone: ${finalTone}\nLength: ${finalLength}` to `lengthInstruction`
- Sends `tone`, `length`, and `lengthInstruction` to backend

### 2.3 Backend Length Override

**Backend (server.js:268–276):**

```javascript
let effectiveLengthInstruction = lengthInstruction;
const length = req.body.length || "auto";

if (!lengthInstruction && length.toLowerCase() === "auto") {
  effectiveLengthInstruction = determineAutoLength(latestMessage);
}
```

- Extension always sends `lengthInstruction`, so backend does not override in normal flow.
- `determineAutoLength` is only used when `lengthInstruction` is missing (e.g. direct API).

### 2.4 Language Consistency

| Component | English | Korean | Japanese |
|-----------|---------|--------|----------|
| System prompt | ✅ | ✅ | ✅ |
| `criticalLanguageRule` | ✅ | ✅ | ✅ |
| `shortInstructions` | ✅ | ✅ | ✅ |
| `mediumInstructions` | ✅ | ✅ | ✅ |
| `longInstructions` | ✅ | ✅ | ✅ |
| `autoInstructions` | ✅ | ✅ | ✅ |
| Anti-hallucination placeholders | ✅ | ✅ | ✅ |

---

## 3. Bugs / Inconsistencies Found

### BUG 1: `languageInstruction` Key Mismatch (FIXED)

**Location:** `gmail.js` – `buildLengthInstruction`

**Issue:** `languageInstructions` used keys `en`, `ko`, `ja`, while `language` is `english`, `korean`, `japanese`. As a result, `languageInstructions[language]` was always `undefined`, and Korean/Japanese fell back to `"Write reply in English."`.

**Fix:** Use keys `english`, `korean`, `japanese` in `languageInstructions` to match `getCurrentLanguage()`.

### BUG 2: Backend `determineAutoLength` Language-Agnostic

**Location:** `server.js` – `determineAutoLength`

**Issue:** Returns English-only instructions. Only used when `lengthInstruction` is missing; extension always sends it, so impact is limited to direct API usage.

**Recommendation:** If supporting direct API with `length=auto`, pass `language` and return localized instructions.

### Minor: `detectOptimalTone` Returns `"polite"`

**Location:** `gmail.js` – `detectOptimalTone`

**Issue:** Returns `"polite"`, which is not in the backend switch. Backend `default` case maps to a polite tone, so behavior is correct.

---

## 4. EN / KO / JP Logic Alignment

| Aspect | Status |
|--------|--------|
| Tone decision logic | ✅ Shared (language-agnostic intent detection) |
| Length decision logic | ✅ Shared |
| Prompt structure | ✅ Same for all languages |
| Length instructions (short/medium/long/auto) | ✅ Localized for each language |
| System prompts | ✅ Separate but equivalent strength |
| Anti-hallucination rules | ✅ Same for all languages |

**Conclusion:** Logic is aligned across EN, KO, and JP. The only functional bug was the `languageInstruction` key mismatch, which is now fixed.

---

## 5. Exact Fixes Applied

1. **gmail.js `buildLengthInstruction`:**  
   - Changed `languageInstructions` keys from `en`/`ko`/`ja` to `english`/`korean`/`japanese`.  
   - Changed fallback from `languageInstructions.en` to `languageInstructions.english`.

---

## 6. Test Matrix

Use these scenarios to verify tone, length, Auto/manual independence, and consistency across EN/KO/JP.

### Scenario 1: Simple Thank-You Email

| Input | Tone | Length | Expected |
|-------|------|--------|----------|
| "Thanks for the update!" | Auto | Auto | Short, direct |
| "Thanks for the update!" | Auto | Manual Short | Short, AI tone |
| "Thanks for the update!" | Manual Professional | Auto | AI length, professional |
| "Thanks for the update!" | Manual Direct | Manual Short | Short, direct |

**EN/KO/JP:** Same behavior; reply language follows popup setting.

---

### Scenario 2: Scheduling Question

| Input | Tone | Length | Expected |
|-------|------|--------|----------|
| "Can we meet tomorrow at 3pm?" | Auto | Auto | Medium, professional |
| "Can we meet tomorrow at 3pm?" | Auto | Manual Long | Long, AI tone |
| "Can we meet tomorrow at 3pm?" | Manual Friendly | Auto | AI length, friendly |
| "Can we meet tomorrow at 3pm?" | Manual Professional | Manual Medium | Medium, professional |

**EN/KO/JP:** Same behavior; reply language follows popup setting.

---

### Scenario 3: Release Date / Pricing Inquiry

| Input | Tone | Length | Expected |
|-------|------|--------|----------|
| "When will the new version be released? What's the pricing?" | Auto | Auto | Medium–Long, professional |
| "When will the new version be released? What's the pricing?" | Auto | Manual Short | Short, AI tone |
| "When will the new version be released? What's the pricing?" | Manual Direct | Auto | AI length, direct |
| "When will the new version be released? What's the pricing?" | Manual Professional | Manual Long | Long, professional |

**EN/KO/JP:** Same behavior; reply language follows popup setting.

---

### Scenario 4: Missing-Information Email

| Input | Tone | Length | Expected |
|-------|------|--------|----------|
| "Please send the report by Friday." | Auto | Auto | Medium, professional |
| "Please send the report by Friday." | Auto | Manual Short | Short, AI tone |
| "Please send the report by Friday." | Manual Direct | Auto | AI length, direct |
| "Please send the report by Friday." | Manual Friendly | Manual Medium | Medium, friendly |

**Placeholder behavior:** Missing details (e.g. time, link) should use localized placeholders: `[time]`, `[시간]`, `[時間]` depending on reply language.

**EN/KO/JP:** Same behavior; placeholders localized.

---

### Scenario 5: Short Acknowledgement Email

| Input | Tone | Length | Expected |
|-------|------|--------|----------|
| "Got it, thanks!" | Auto | Auto | Short, direct |
| "Got it, thanks!" | Auto | Manual Long | Long, AI tone |
| "Got it, thanks!" | Manual Professional | Auto | AI length, professional |
| "Got it, thanks!" | Manual Direct | Manual Short | Short, direct |

**EN/KO/JP:** Same behavior; reply language follows popup setting.

---

### Verification Checklist (per scenario)

- [ ] Tone Auto: AI chooses tone
- [ ] Tone Manual: User tone used
- [ ] Length Auto: AI chooses length
- [ ] Length Manual: User length used
- [ ] Tone Auto + Length Manual: No override
- [ ] Tone Manual + Length Auto: No override
- [ ] EN: Reply in English
- [ ] KO: Reply in Korean (한국어)
- [ ] JP: Reply in Japanese (日本語)
