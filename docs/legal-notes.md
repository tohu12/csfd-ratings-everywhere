# Legal notes

Internal working document (not published on the website). A risk overview from 2026-11-01, written without a lawyer. It is not legal advice. Re-check it before any monetisation, or when ČSFD or a store contacts us.

## Summary

- No criminal exposure as long as we never circumvent ČSFD's bot protection.
- The remaining exposure is civil and low for a free, open-source, clearly unofficial extension.
- The realistic worst cases are:
  - a cease-and-desist letter from ČSFD,
  - a rights-holder complaint that gets the extension removed from a store.
- Damages are unlikely: no revenue, hard-to-quantify harm. The owner is a natural person and liable personally.

## Risks, most likely first

1. **Trademark and confusion with ČSFD.** Most likely, and the cheapest to mitigate.
   - Referential use of a trademark ("works with ČSFD") is allowed: the Czech Trademark Act (441/2003 Sb.) and Art. 14 of Regulation (EU) 2017/1001. The condition is honest practice that does not suggest an official connection.
   - The name starting with "ČSFD" and the exact ČSFD red raise the risk (accepted by the owner, see STATUS.md).
   - The same facts could be argued as unfair competition: likelihood of confusion (§ 2981 of the Civil Code) or free-riding on reputation (§ 2982). Czech courts read the "competitive relationship" broadly.
   - Mitigations in place:
     - "Unofficial, not affiliated with ČSFD" in all texts,
     - the trademark notice in README and on the website,
     - an icon shape unlike the ČSFD logo.
   - Stores remove extensions on a rights-holder complaint alone, without a court.
2. **Database maker's right** (Copyright Act 121/2000 Sb., § 88 ff.; Directive 96/9/EC).
   - A single rating is a fact, not a work, but the ČSFD database as a whole is likely protected.
   - Extracting insubstantial parts is allowed, unless it is repeated and systematic and conflicts with the normal exploitation of the database.
   - CJEU *Innoweb* (C-202/12) found against a real-time meta search engine. Our VOD lookup via ČSFD search resembles it more than the link badges do.
   - CJEU *CV-Online Latvia* (C-762/19, 2021) narrowed this: infringement requires a risk to the maker's investment.
   - For us:
     - no server of ours: each browser fetches only for its own user,
     - one number per film,
     - every badge links back to ČSFD,
     - cache, per-page cap and request spacing (SPEC §4, §6).
   - Against us: users may see the rating without visiting ČSFD, so ČSFD loses an ad impression.
3. **ČSFD terms of use.** Unknown: the owner has to read them, because agents cannot open csfd.cz.
   - Look for bans on robots, automated access or reuse of ratings.
   - Contractual limits are enforceable in principle (CJEU *Ryanair*, C-30/14), but the party is the user rather than us, and browsewrap terms are weak in the EU.
4. **Modifying third-party pages** (VOD services, forums).
   - The change happens only in the user's own browser, at the user's request, like ad blockers, password managers or translation extensions. We add elements and never remove any.
   - German case law on ad blockers (Axel Springer v. Eyeo) found no unfair competition. The copyright side of that dispute (modifying a page's DOM) is still not fully settled.
   - VOD terms of service (e.g. Netflix) restrict inserting code into the service. That binds the subscriber and is not enforced in practice against rating extensions.
5. **Criminal law** (§ 230 of the Criminal Code, unauthorised access to a computer system).
   - None today.
   - It would become relevant with circumvention: PoW solving, UA spoofing, hidden tabs, or working around an explicit block by ČSFD.
   - The rules in AGENTS.md are therefore also a legal safeguard. So are the polite request limits, which rule out any claim of overloading ČSFD.
6. **Privacy (GDPR).** Low.
   - No data reaches the developer, so the developer is not a controller.
   - Sending film ids to csfd.cz is disclosed in [PRIVACY.md](PRIVACY.md) and in Firefox's `data_collection_permissions`.
7. **Warranty.** Negligible: MIT license, free of charge.

## What we do

1. **Write to ČSFD before the store submission.** The draft is in [launch-plan.md](launch-plan.md#draft-e-mail-to-čsfd).
   - Consent removes most of risks 1–3.
   - A refusal is better known before there are users.
2. The owner reads the ČSFD terms of use and records the relevant clauses here.
3. If a complaint arrives, the ČSFD red is the first thing to give up. It is the cheapest change with the biggest effect on confusion.
4. Answer any letter quickly and constructively: offer changes or removal.
5. Any monetisation (ads, a paid tier) needs a lawyer's review first, because it raises risks 1 and 2 considerably.
