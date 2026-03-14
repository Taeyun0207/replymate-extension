# Reply Generation Test Matrix

Use this matrix to verify tone, length, Auto/manual independence, and consistency across English, Korean, and Japanese.

---

## Test Scenarios

### Scenario 1: Simple Thank-You Email

**Input message:** `Thanks for the update!`

| Tone | Length | Expected Tone | Expected Length | EN | KO | JP |
|------|--------|---------------|-----------------|----|----|-----|
| Auto | Auto | direct (acknowledgement) | short | ✓ | ✓ | ✓ |
| Auto | Manual Short | AI-decided | short (strict) | ✓ | ✓ | ✓ |
| Manual Professional | Auto | professional | medium | ✓ | ✓ | ✓ |
| Manual Direct | Manual Short | direct | short | ✓ | ✓ | ✓ |

**Verify:** Reply is 1–2 sentences when Short; tone matches setting; language matches popup.

---

### Scenario 2: Scheduling Question

**Input message:** `Can we meet tomorrow at 3pm?`

| Tone | Length | Expected Tone | Expected Length | EN | KO | JP |
|------|--------|---------------|-----------------|----|----|-----|
| Auto | Auto | professional | medium | ✓ | ✓ | ✓ |
| Auto | Manual Long | AI-decided | long (6–9 sentences) | ✓ | ✓ | ✓ |
| Manual Friendly | Auto | friendly | AI-decided | ✓ | ✓ | ✓ |
| Manual Professional | Manual Medium | professional | medium (3–5 sentences) | ✓ | ✓ | ✓ |

**Verify:** Length follows manual setting when set; tone follows manual setting when set.

---

### Scenario 3: Release Date / Pricing Inquiry

**Input message:** `When will the new version be released? What's the pricing?`

| Tone | Length | Expected Tone | Expected Length | EN | KO | JP |
|------|--------|---------------|-----------------|----|----|-----|
| Auto | Auto | professional/polite | medium–long | ✓ | ✓ | ✓ |
| Auto | Manual Short | AI-decided | short (strict) | ✓ | ✓ | ✓ |
| Manual Direct | Auto | direct | AI-decided | ✓ | ✓ | ✓ |
| Manual Professional | Manual Long | professional | long | ✓ | ✓ | ✓ |

**Verify:** Multiple questions → Auto length tends to Long; manual overrides when set.

---

### Scenario 4: Missing-Information Email

**Input message:** `Please send the report by Friday.`

| Tone | Length | Expected Tone | Expected Length | EN | KO | JP |
|------|--------|---------------|-----------------|----|----|-----|
| Auto | Auto | professional | medium | ✓ | ✓ | ✓ |
| Auto | Manual Short | AI-decided | short | ✓ | ✓ | ✓ |
| Manual Direct | Auto | direct | AI-decided | ✓ | ✓ | ✓ |
| Manual Friendly | Manual Medium | friendly | medium | ✓ | ✓ | ✓ |

**Placeholder check:** Missing details (e.g. time, link) → localized placeholders:
- EN: `[time]`, `[date]`, `[link]`
- KO: `[시간]`, `[날짜]`, `[링크]`
- JP: `[時間]`, `[日付]`, `[リンク]`

---

### Scenario 5: Short Acknowledgement Email

**Input message:** `Got it, thanks!`

| Tone | Length | Expected Tone | Expected Length | EN | KO | JP |
|------|--------|---------------|-----------------|----|----|-----|
| Auto | Auto | direct | short | ✓ | ✓ | ✓ |
| Auto | Manual Long | AI-decided | long | ✓ | ✓ | ✓ |
| Manual Professional | Auto | professional | AI-decided | ✓ | ✓ | ✓ |
| Manual Direct | Manual Short | direct | short | ✓ | ✓ | ✓ |

**Verify:** Acknowledgement → Auto prefers Short; manual Long still produces long reply.

---

## Independence Checks (Critical)

| User Setting | Must NOT Override | Verify |
|--------------|-------------------|--------|
| Tone=Auto, Length=Short | Length must stay Short | Reply is 1–2 sentences |
| Tone=Professional, Length=Auto | Tone must stay Professional | Reply uses professional tone |
| Both Auto | Both AI-decided | Reasonable for context |
| Both Manual | Both followed exactly | Tone and length match |

---

## Language Consistency Checks

For each scenario, with popup language set to **Korean**:

- [ ] Reply is entirely in Korean (한국어)
- [ ] No English mixed in (except proper nouns)
- [ ] Placeholders use Korean format: `[시간]`, `[날짜]`, etc.

For each scenario, with popup language set to **Japanese**:

- [ ] Reply is entirely in Japanese (日本語)
- [ ] No English mixed in (except proper nouns)
- [ ] Placeholders use Japanese format: `[時間]`, `[日付]`, etc.

---

## Quick Manual Test Procedure

1. Open Gmail with ReplyMate extension.
2. Set popup: Language=English, Tone=Auto, Length=Short.
3. Open an email with "Thanks for the update!"
4. Click ReplyMate → Generate.
5. **Check:** Reply is 1–2 sentences, in English, direct tone.
6. Repeat with Language=Korean, then Japanese.
7. Repeat with Tone=Professional, Length=Auto.
8. Repeat with both Manual (e.g. Friendly + Long).
