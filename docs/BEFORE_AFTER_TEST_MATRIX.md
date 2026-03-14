# Before/After Test Matrix: Reply Quality Improvements

Use this matrix to verify that outputs differ more clearly across tone, length, and language after the prompt improvements.

---

## Expected Output Differences

### 1. Length: Short vs Medium vs Long

**Input:** "Can we reschedule the meeting to next week?"

| Mode | Before (vague) | After (clear difference) |
|------|----------------|--------------------------|
| **Short** | 2–3 sentences, similar to medium | 1–2 sentences, ~20 words max. "Sure, next week works. Which day?" |
| **Medium** | 3–4 sentences | 3–5 sentences, 25–70 words. Brief acknowledgment + main point + natural closing. |
| **Long** | 4–5 sentences, barely longer | 6–9 sentences, 70–150 words. Context, detail, appreciation, polished closing. |

**Verification:** Short should feel noticeably minimal; Long should feel noticeably complete.

---

### 2. Tone: Polite vs Professional vs Direct vs Friendly

**Input:** "Thanks for sending the report."

| Tone | Before | After |
|------|--------|-------|
| **Polite** | Similar to others | Respectful, warm, courteous. "Thank you so much for sending the report. I really appreciate you taking the time." |
| **Professional** | Similar to others | Work-appropriate, clear, composed. "Thank you for the report. I've received it and will review it shortly." |
| **Direct** | Similar to others | Concise, no padding. "Got it, thanks." |
| **Friendly** | Similar to others | Warm, approachable, conversational. "Thanks a lot for sending that over! Really helpful." |

**Verification:** Each tone should feel distinctly different when compared side by side.

---

### 3. Auto Mode: Intentional vs Generic

**Input A:** "Thanks!"  
**Expected Auto:** Short + Direct. Brief and done.

**Input B:** "When will the new version be released? What's the pricing? Can we get a demo?"  
**Expected Auto:** Long + Professional. Full, thoughtful reply addressing each point.

**Input C:** "Can we meet tomorrow at 3pm?"  
**Expected Auto:** Medium + Professional. Balanced reply.

**Verification:** Auto should feel like the right choice for each situation—not a one-size-fits-all reply.

---

### 4. Language: English vs Korean vs Japanese

**Input:** "Thank you for your help with the project."

| Language | Before | After |
|----------|---------|-------|
| **English** | Natural | Natural, idiomatic. No stiff or translated feel. |
| **Korean** | Sometimes stiff/translated | Natural Korean with appropriate 존댓말. Native-speaker quality. |
| **Japanese** | Sometimes stiff/translated | Natural Japanese with appropriate 敬語. Native-speaker quality. |

**Verification:** Korean and Japanese should feel as strong and natural as English.

---

## Quick Verification Checklist

- [ ] **Short** feels very brief (1–2 sentences, ~20 words)
- [ ] **Long** feels full and thoughtful (6–9 sentences)
- [ ] **Direct** tone is noticeably more concise than Polite
- [ ] **Friendly** tone is noticeably warmer than Professional
- [ ] **Auto** on "Thanks!" → Short, Direct
- [ ] **Auto** on multi-question email → Long, Professional
- [ ] **Korean** reply feels natural, not translated
- [ ] **Japanese** reply feels natural, not translated

---

## Test Scenarios

| Scenario | Input | Tone Auto | Length Auto | Expected |
|---------|-------|-----------|-------------|----------|
| Thank-you | "Thanks for the update!" | direct | short | 1–2 sentences, direct |
| Scheduling | "Can we meet tomorrow at 3pm?" | professional | medium | 3–5 sentences, professional |
| Inquiry | "When is the release? What's the price?" | professional | long | 6–9 sentences, full reply |
| Request | "Please send the report by Friday." | polite | medium | 3–5 sentences, polite |
| Acknowledgement | "Got it, thanks!" | direct | short | 1–2 sentences, direct |
