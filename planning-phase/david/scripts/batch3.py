"""
Batch 3: 20 new, varied clients run through the FROZEN signal model (scripts/signal_model.py).
This file only adds data and a runner. It does not edit or monkey-patch the model.

Order of work (pre-registration):
  1. python scripts/batch3.py --spec  > the profile table with EXPECTED pages. Written and hashed first.
  2. python scripts/batch3.py         > runs the model once. No model or expectation change afterwards.

Expected pages come from the team definitions of each dialect and need (specs/signal-model.md §5 and
the glossary), NOT from the model's rules. `alt` lists a second defensible answer; a result is scored
strictly on `expected`, and `alt` is reported separately.
"""
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import signal_model as m  # noqa: E402

# id, name, age label (never seen by the model), shopping for, what they do, noise signal id or None,
# signals, declared, context, prior signals (an earlier visit) or None, expected, alt, why, tests
P = [
    (21, "Hiro", 41, "A mechanical keyboard", "Searches switch types and layouts, opens spec tables and the technical section, compares two boards, swipes one photo.",
     "gallery_swipe", {"search_jargon": 1, "spec_open": 2, "technical_section_open": 1, "filter_technical": 1, "compare_add": 2, "gallery_swipe": 1},
     {}, {}, None, ("dense", "specs"), None, "technical vocabulary plus depth", "the plain expert case"),
    (22, "Nadia", 78, "Hearing-aid batteries", "Large text is on. Presses reorder, skips detail, mis-taps once, copies the phone number, zooms one photo.",
     "image_zoom", {"reorder_click": 1, "skip_detail": 2, "mis_tap": 1, "phone_copy": 1, "slow_deliberate_scroll": 1, "image_zoom": 1},
     {}, {"os_large_text": True}, None, ("guided", "quick"), None, "already decided and needs larger, simpler controls", "accessibility setting plus a decided visitor"),
    (23, "Priya", 21, "A laptop for university", "Arrives from a price-comparison site and a deal campaign, sorts and filters by price, checks price history and cheaper options, saves two, opens one spec table.",
     "spec_open", {"ref_price_compare": 1, "utm_intent_deal": 1, "price_sort": 3, "price_filter": 2, "price_detail_open": 1, "cheaper_alt_view": 2, "search_price_words": 1, "saved_item": 2, "spec_open": 1},
     {}, {}, None, ("standard", "deals"), None, "price is the whole story", "strong price evidence with one off-pattern spec open"),
    (24, "Tomas", 56, "A used e-bike", "Reads reviews first, sorts them most critical, filters to verified sellers, opens the returns policy twice, many views and no cart, opens two spec tables, sorts by price once.",
     "price_sort", {"review_first": 1, "review_sort_critical": 2, "verified_filter": 1, "policy_open": 2, "many_views_no_cart": 4, "spec_open": 2, "price_sort": 1},
     {}, {}, None, ("standard", "reassurance"), None, "wary; persuasion would backfire", "the skeptic"),
    (25, "Sofia", 33, "A console for her nephew", "Searches in everyday words, opens the glossary twice, opens age suitability twice and gift options once, opens returns, views a few products without opening anything, filters price once.",
     "price_filter", {"search_conversational": 1, "glossary_open": 2, "suitability_open": 2, "gift_option_open": 1, "policy_open": 1, "views_without_opens": 3, "price_filter": 1},
     {}, {}, None, ("guided", "reassurance"), ("guided", "balanced"), "plain words, gift context, worried about returns", "gift buyer inferred, not declared"),
    (26, "Kwame", 44, "Laptops for a team", "Searches with model terms, opens technical sections and spec tables, uses the seat counter, checks security and policy pages, adds three to compare, returned once without buying, swipes one photo.",
     "gallery_swipe", {"search_jargon": 1, "technical_section_open": 2, "spec_open": 2, "policy_open": 2, "seat_counter": 1, "compare_add": 3, "repeat_visit_no_cart": 1, "gallery_swipe": 1},
     {}, {}, None, ("dense", "specs"), ("dense", "reassurance"), "technical buyer for a team, detail first", "B2B with two defensible needs"),
    (27, "Margit", 69, "Her usual coffee", "Has several previous orders, presses reorder, skips detail, adds from the list, uses the search box, zooms one photo.",
     "image_zoom", {"prior_orders": 4, "reorder_click": 1, "skip_detail": 3, "fast_add_from_list": 2, "search_box_use": 2, "image_zoom": 1},
     {}, {}, None, ("standard", "quick"), None, "knows what she wants; get out of the way", "repeat buyer"),
    (28, "Yusuf", 27, "Tax software", "Views five products and opens nothing, presses back six times, re-searches three times without clicking a result, clicks something dead twice, sorts by price once.",
     "price_sort", {"views_without_opens": 5, "back_nav": 6, "search_refine_no_click": 3, "dead_click": 2, "price_sort": 1},
     {}, {}, None, ("guided", "balanced"), None, "lost; needs a simpler page, never a denser one", "the lost visitor"),
    (29, "Chloe", 30, "Nothing yet", "Swipes one photo and leaves within seconds.",
     None, {"gallery_swipe": 1, "short_session": 1},
     {}, {}, None, ("standard", "balanced"), None, "almost no evidence, so do not guess", "thin evidence"),
    (30, "Jonas", 29, "A sofa, for ideas", "Arrives from a social network, saves three items, swipes the gallery five times, zooms twice, opens dimensions once, views three products without opening anything, sorts by price once.",
     "price_sort", {"ref_social": 1, "saved_item": 3, "gallery_swipe": 5, "image_zoom": 2, "dimension_open": 1, "views_without_opens": 3, "price_sort": 1},
     {}, {}, None, ("visual", "inspiration"), None, "browses by picture", "photo-led browsing"),
    (31, "Alina", 38, "A baby stroller", "Sorts and filters by price and looks at a cheaper alternative, but also reads reviews first, sorts them most critical, opens returns twice, and has come back once without buying.",
     None, {"price_sort": 2, "price_filter": 1, "cheaper_alt_view": 1, "review_first": 1, "review_sort_critical": 1, "policy_open": 2, "repeat_visit_no_cart": 1},
     {}, {}, None, ("standard", "reassurance"), ("standard", "deals"), "price matters, but a safety purchase needs reassurance first", "price against trust"),
    (32, "Mateo", 34, "A camera", "Opens three spec tables and stays long on one, opens the glossary three times, presses back four times, re-searches twice without a click, clicks something dead.",
     None, {"spec_open": 3, "spec_dwell_long": 1, "glossary_open": 3, "back_nav": 4, "search_refine_no_click": 2, "dead_click": 1},
     {}, {}, None, ("guided", "specs"), ("guided", "balanced"), "wants detail but is struggling, so simpler wording and layout", "detail hunger and confusion together"),
    (33, "Svetlana", 47, "An audio interface", "A real expert who reads spec tables closely: five opens, long dwell three times, compares two, uses the search box, opens dimensions. Never opens a technical section or uses a technical filter.",
     None, {"spec_open": 5, "spec_dwell_long": 3, "compare_add": 2, "search_box_use": 2, "dimension_open": 1},
     {}, {}, None, ("dense", "specs"), None, "an expert, shown by how closely she reads specs", "targets the known gap found with Paul"),
    (34, "Oliver", 52, "Headphones, second visit", "Last visit: arrived from a review channel, technical search, four spec opens, two technical sections, two compares. This visit: two more spec opens, one compare, one technical section, back to the same items.",
     None, {"spec_open": 2, "compare_add": 1, "technical_section_open": 1, "repeat_visit_same_items": 1},
     {}, {}, {"ref_review_site": 1, "search_jargon": 1, "spec_open": 4, "technical_section_open": 2, "compare_add": 2}, ("dense", "specs"), None, "a returning expert who keeps behaving like one", "return visit that confirms"),
    (35, "Beatrix", 60, "A mattress", "Told the chat 'just the basics', yet opens four spec tables, stays long on one, searched with technical terms, and compares two.",
     None, {"spec_open": 4, "spec_dwell_long": 1, "search_jargon": 1, "compare_add": 2},
     {"traits": {"IA": 0.15}}, {}, None, ("standard", "balanced"), None, "what she said beats what she did", "declared preference against behaviour"),
    (36, "Kofi", 22, "An e-reader", "Picked the dense view himself. Behaviour is thin: one product view, short session.",
     None, {"views_without_opens": 1, "short_session": 1},
     {"dialect": "dense"}, {}, None, ("dense", "balanced"), None, "his choice of view is honoured; nothing else is known", "declared view switch"),
    (37, "Daniel", 40, "A phone", "Declined consent. Would have opened five spec tables and compared three.",
     None, {"spec_open": 5, "compare_add": 3},
     {}, {"consent": False}, None, ("standard", "balanced"), None, "no consent means no personalisation at all", "consent denied"),
    (38, "Ruth", 70, "A monitor", "High-contrast mode is on. Searches with technical terms, opens four spec tables and two technical sections, compares two, uses the search box.",
     None, {"search_jargon": 1, "spec_open": 4, "technical_section_open": 2, "compare_add": 2, "search_box_use": 2},
     {}, {"prefers_contrast_more": True}, None, ("dense", "specs"), ("guided", "specs"), "an expert who needs high contrast, not a simpler page", "accessibility setting against expertise"),
    (39, "Vikram", 25, "Sneakers", "Arrives from a price-comparison site, through a deal campaign link and from a social network. Stays seconds.",
     None, {"ref_price_compare": 1, "utm_intent_deal": 1, "ref_social": 1, "short_session": 1},
     {}, {}, None, ("standard", "balanced"), None, "arrival details alone are not a personality", "arrival-only evidence"),
    (40, "Elodie", 45, "A dishwasher", "Returned to the same two items twice, saved two, opened returns twice, opened dimensions twice, read reviews first, opened two spec tables, searched in everyday words, came back without buying, zoomed one photo.",
     "image_zoom", {"repeat_visit_same_items": 2, "saved_item": 2, "policy_open": 2, "dimension_open": 2, "review_first": 1, "spec_open": 2, "search_conversational": 1, "repeat_visit_no_cart": 2, "image_zoom": 1},
     {}, {}, None, ("standard", "reassurance"), None, "a careful, stalled big purchase", "considered buyer"),
]


def spec_table():
    print("| # | Who (label only) | Shopping for | What they do | Off-pattern click | Tests | Expected | Also acceptable | Why |")
    print("|---|---|---|---|---|---|---|---|---|")
    for (i, n, age, shop, does, noise, sig, decl, ctx, prior, exp, alt, why, tests) in P:
        extra = []
        if decl: extra.append("declared: " + json.dumps(decl))
        if ctx: extra.append("context: " + json.dumps(ctx))
        d = does + (" [" + "; ".join(extra) + "]" if extra else "")
        print(f"| {i} | {n}, {age} | {shop} | {d} | {noise or '-'} | {tests} | `{exp[0]}` x `{exp[1]}` | "
              f"{('`%s` x `%s`' % alt) if alt else '-'} | {why} |")


def run_one(sig, decl, ctx, prior):
    prior_groups = m.build_profile(prior)["groups"] if prior else None
    p = m.build_profile(sig, decl, ctx, prior_groups=prior_groups)
    return p, m.persona(p)


def robustness(runs=300, jitter=0.25, seed=7):
    rng = random.Random(seed)
    original = {k: (tier, list(eff)) for k, (tier, eff) in m.SIGNALS.items()}
    keep = {r[0]: 0 for r in P}
    for _ in range(runs):
        for k, (tier, eff) in original.items():
            m.SIGNALS[k] = (tier, [(t, s, st * rng.uniform(1 - jitter, 1 + jitter), g) for t, s, st, g in eff])
        for (i, n, age, shop, does, noise, sig, decl, ctx, prior, exp, alt, why, tests) in P:
            _, per = run_one(sig, decl, ctx, prior)
            keep[i] += (per["dialect"], per["need"]) == exp
    m.SIGNALS.update(original)
    return {i: round(100 * v / runs, 1) for i, v in keep.items()}


def main():
    rob = robustness()
    hits = alt_only = 0
    out = []
    print("id  name       chose                     expected                  alt-ok  stable  conf  note")
    for (i, n, age, shop, does, noise, sig, decl, ctx, prior, exp, alt, why, tests) in P:
        p, per = run_one(sig, decl, ctx, prior)
        got = (per["dialect"], per["need"])
        ok = got == exp
        alt_ok = (not ok) and alt is not None and got == alt
        hits += ok
        alt_only += alt_ok
        conf = per.get("confidence", 0.0)
        mark = "OK  " if ok else ("ALT " if alt_ok else "MISS")
        print(f"{mark}{i} {n:9s} {got[0]:8s} x {got[1]:11s}  {exp[0]:8s} x {exp[1]:11s}  {'yes' if alt_ok else '-':6s}  {rob[i]:5.1f}%  {conf:.2f}  {tests}")
        tr = p.get("traits") or {}
        if tr:
            print("      " + "  ".join(f"{t} {tr[t]['value']:.2f}/{tr[t]['conf']:.2f}" for t in m.TRAITS) +
                  f"  stage {p['stage']}  for {p['buyingFor']}  dialect:{per['dialect_why']}  need:{per['need_why']}")
        out.append({"id": i, "name": n, "got": list(got), "expected": list(exp), "alt": list(alt) if alt else None,
                    "match": ok, "alt_match": alt_ok, "stability": rob[i], "confidence": conf})
    print(f"\n--> strict match {hits}/{len(P)}   plus alternate-only {alt_only}   total acceptable {hits + alt_only}/{len(P)}")
    path = os.environ.get("BATCH3_OUT")
    if path:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=1)


if __name__ == "__main__":
    spec_table() if "--spec" in sys.argv else main()
