# User testing kit (10 minutes per tester)

Goal: watch 2–3 people who haven't seen CanopyChain use it, note where they get stuck, fix the worst problem, and report honestly in `docs/user-testing.md`. Classmates, family or friends are fine; ideally one person who knows nothing about crypto.

## Setup
- Run it on **your** laptop with the local chain (README "How to run"), so testers don't need their own wallet or test POL. MetaMask is set to the "Hardhat" network with test account #2 imported (it's an approver in the local setup).
- Fresh start: restart the local chain, redeploy (`npm run deploy:local`), and clear `backend/data/` (or point `CANOPY_DATA_DIR` at a new folder).
- Open the landing page. Have this sheet and something to write on.

## What to say first (read it out)
> "This is a prototype, so if something is confusing, that's the prototype's fault, not yours. Please think out loud while you use it. I won't help unless you're completely stuck."

## Tasks (give one at a time; don't explain the UI)
1. "From this page, tell me in one sentence what this site does." *(30 s, landing page only)*
2. "You own a patch of rainforest. Register it." *(They need to find Register, draw a shape, name it, sign.)*
3. "Your project needs approval. You're also the approver today: approve it."
4. "Find out how many carbon credits your forest earned."
5. "Prove the report wasn't edited after it was issued."
6. "A company wants to offset 10 tonnes with your credits. Retire 10 credits for 'Acme Corp'."
7. "Imagine part of the forest gets cut down. What happens?" *(Simulate deforestation.)*
8. "Where could anyone check everything that has happened?"

For each task note: **completed?** (yes / with a hint / no), **time**, **where they hesitated or what they said**.

## Questions afterwards (1–5 scale, then one open question)
1. How easy was it to use overall? (1 very hard … 5 very easy)
2. How well did you understand what happens on the blockchain? (1 not at all … 5 completely)
3. How much would you trust a carbon credit from this system compared with a normal one? (1 much less … 5 much more)
4. What was the most confusing moment?
5. What one thing would you change?

## Afterwards
- Fix the single most common problem if it's quick, and note it under "Changes made".
- Fill in `docs/user-testing.md` using the template below. Use only what actually happened; small numbers are fine and expected for a hackathon.

---

## Template for docs/user-testing.md

```markdown
# User testing results

Date: …  ·  Testers: N (e.g. 2 university students, 1 parent with no crypto experience)  ·  Setup: local chain on the team laptop, ~10 min each

## Task results
| Task | Completed (of N) | Avg. time | Notes |
|---|---|---|---|
| 1. Explain the site | | | |
| 2. Register a forest | | | |
| 3. Approve it | | | |
| 4. Find the credits | | | |
| 5. Prove the report wasn't edited | | | |
| 6. Retire 10 credits | | | |
| 7. What happens after deforestation | | | |
| 8. Where to audit everything | | | |

## Ratings (average of N, 1–5)
Ease of use: … · Understanding of the blockchain part: … · Trust compared with a normal credit: …

## What confused people
- …

## Changes made after testing
- …

## Not changed yet (and why)
- …
```
