# Mode: contacto -- LinkedIn Power Move

## Maxim Apply Integration

When this Career-Ops fork is being used as Maxim Apply, use the local Maxim networking layer before ad hoc research:

```powershell
npm run maxim:linkedin-find -- --company "<company>" --role "<role>"
npm run maxim:linkedin-find -- --from-store --limit-jobs 5
```

If the user has pasted public/LinkedIn people-search snippets into a local text file, parse them without logging in or sending messages:

```powershell
npm run maxim:linkedin-find -- --company "<company>" --role "<role>" --results data\maxim\linkedin_people_results.txt --store-results
```

To create job-specific networking targets from discovered/local contacts:

```powershell
npm run maxim:linkedin-find -- --from-store --limit-jobs 5 --results data\maxim\linkedin_people_results.txt --store-results --queue
```

Then use the Maxim research-gated draft flow:

```powershell
npm run maxim:message-drafts -- research <target_id> --text "Approved public/person research note"
npm run maxim:message-drafts -- from-target <target_id> --require-research
```

Hard boundaries:

- Do not log in to LinkedIn on the user's behalf.
- Do not send LinkedIn messages.
- Do not scrape hidden/authenticated LinkedIn data.
- Do not bypass CAPTCHA, rate limits, or access controls.
- Treat all discovered people as candidates requiring manual verification.

1. **Identify targets** via WebSearch:
   - Hiring manager of the team
   - Assigned recruiter
   - 2-3 team peers (people with similar roles)
   - Interviewer (if the candidate already has a scheduled interview)

2. **Classify contact type** -- ask the candidate or infer from context:
   - **Recruiter** -- person whose role is talent acquisition, sourcing, or recruiting
   - **Hiring Manager** -- the person who leads the hiring team
   - **Peer** -- someone with a similar role in the team (indirect referral)
   - **Interviewer** -- someone who will interview the candidate (known date)

3. **Select primary target**: the person who would benefit most from the candidate being there

4. **Generate message** with a 3-sentence framework adapted to the contact type:

   ### Recruiter
   - **Sentence 1 (Fit)**: Direct match criteria -- role, relevant experience, availability, or location
   - **Sentence 2 (Proof)**: Data that answers their screening questions before they ask them (e.g., "5 years building ML pipelines, currently in Berlin, available immediately")
   - **Sentence 3 (CTA)**: "Happy to share my CV if this aligns with what you're looking for"

   ### Hiring Manager
   - **Sentence 1 (Hook)**: Specific challenge their team is facing (extracted from the JD, company blog, or news)
   - **Sentence 2 (Proof)**: Candidate's greatest quantifiable achievement showing they have solved similar problems
   - **Sentence 3 (CTA)**: "Would love to hear how your team is approaching [specific challenge]"

   ### Peer (referral)
   - **Sentence 1 (Interest)**: Genuine reference to their work -- blog post, talk, open-source project, or publication
   - **Sentence 2 (Connection)**: Something the candidate is doing in the same space (NOT a job pitch)
   - **Sentence 3 (CTA)**: "I've been working on similar problems at [company], would love to hear your take on [topic]"
   - **Note**: DO NOT ask for a job. The referral happens naturally if the conversation flows.

   ### Interviewer (pre-interview)
   - **Sentence 1 (Research)**: Reference to something specific from their work or trajectory
   - **Sentence 2 (Context)**: Light connection to the candidate's experience in that area
   - **Sentence 3 (CTA)**: "Looking forward to our conversation on [date]"
   - **Note**: Light tone, not desperate. The goal is to show that you prepared.

5. **Versions**:
   - EN (default)
   - ES (if Spanish company)

6. **Alternative targets** with justification for why they are good second choices

**Message rules:**
- Maximum 300 characters (LinkedIn connection request limit)
- NO corporate-speak
- NO "I'm passionate about..."
- Something that makes them want to respond
- NEVER share phone number
- The contact type changes the EMPHASIS, not the structure
