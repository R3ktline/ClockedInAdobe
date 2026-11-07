"""
Signal model — reference implementation. Spec: specs/signal-model.md.

Turns raw interaction signals into traits (with confidence), then traits into a
persona (dialect x need). Pure functions, no I/O except the report at the bottom.
Python because Node is not installed on this machine (2026-11-07); port to TypeScript
for babel/persona when the app exists. Every weight below is [ASSUMPTION], hand-set.

Run:  python scripts/signal_model.py
"""
import math

# ---------------------------------------------------------------- 1. constants
TIER_WEIGHT = {"B": 1.0, "S": 0.5, "C": 0.25}   # repeated behaviour, single/search, circumstantial
GROUP_CAP = 1.2          # max |logit| one correlation group can add to one trait
SINGLE_GROUP_CONF_CAP = 0.6   # one group alone is never "enough" (rule: >= 2 independent groups)
CONF_SCALE = 1.0         # evidence mass at which confidence reaches ~63 % (v1 had 1.5: too strict,
                         # two agreeing groups of moderate size could never pass the threshold)
THRESHOLD = 0.55         # below this, a trait is treated as neutral (ADR-005, team threshold)
TRAITS = ["IA", "JT", "PS", "TN", "INS", "IF", "CF"]
# IA infoAppetite · JT jargonComfort · PS priceSensitivity · TN trustNeed (= 1 - trust)
# INS inspirationAppetite · IF interactionFluency · CF confusion (transient)

# ---------------------------------------------------------------- 2. signal inventory
# id: (tier, [(trait, sign, strength, group)])
# Groups are per trait. Signals in the same group measure the same thing, so their sum
# is capped at GROUP_CAP — no double counting.
SIGNALS = {
    # circumstantial — arrival context. Device type is deliberately ABSENT: a phone says
    # nothing about the person (Matei's tier-3 defect).
    "ref_social":          ("C", [("INS", +1, 1.0, "arrival")]),
    "ref_price_compare":   ("C", [("PS", +1, 1.0, "arrival")]),
    "ref_review_site":     ("C", [("JT", +1, 1.0, "arrival"), ("IA", +1, 1.0, "arrival")]),
    "utm_intent_deal":     ("C", [("PS", +1, 1.0, "arrival")]),
    "short_session":       ("C", [("IA", -1, 1.0, "pace")]),
    # search wording — single strongest one-shot signal
    "search_jargon":       ("S", [("JT", +1, 1.5, "technical"), ("IA", +1, 0.8, "search")]),
    "search_conversational": ("S", [("JT", -1, 1.2, "technical")]),
    "search_price_words":  ("S", [("PS", +1, 1.0, "price_focus")]),
    # repeated on-page behaviour
    # v2: spec_open no longer raises JT. Opening details shows appetite, not comfort with
    # jargon (a worried visitor opens insurance exclusions too). JT comes from vocabulary.
    "spec_open":           ("B", [("IA", +1, 1.0, "detail_depth")]),
    "spec_dwell_long":     ("B", [("IA", +1, 0.8, "detail_depth")]),
    "technical_section_open": ("B", [("JT", +1, 1.0, "technical_sections")]),
    "filter_technical":    ("B", [("JT", +1, 0.8, "technical_sections"), ("IF", +1, 0.6, "control")]),
    "compare_add":         ("B", [("IA", +1, 0.8, "comparison"), ("IF", +1, 0.5, "control")]),
    "views_without_opens": ("B", [("IA", -1, 0.8, "detail_depth")]),
    "skip_detail":         ("B", [("IA", -1, 1.0, "detail_depth")]),
    "fast_add_from_list":  ("B", [("IA", -1, 1.0, "pace"), ("IF", +1, 0.8, "control")]),
    "glossary_open":       ("B", [("JT", -1, 1.0, "jargon_struggle")]),
    "price_sort":          ("B", [("PS", +1, 1.0, "price_focus")]),
    "price_filter":        ("B", [("PS", +1, 0.8, "price_focus")]),
    "price_detail_open":   ("B", [("PS", +1, 0.8, "price_detail")]),   # price history, total incl. fees
    "cheaper_alt_view":    ("B", [("PS", +1, 0.8, "price_detail")]),
    "review_first":        ("B", [("TN", +1, 1.0, "evidence_seeking")]),
    "review_sort_critical": ("B", [("TN", +1, 1.0, "evidence_seeking")]),
    "verified_filter":     ("B", [("TN", +1, 0.8, "evidence_seeking")]),
    "policy_open":         ("B", [("TN", +1, 0.9, "policy_check")]),  # returns, warranty, exclusions, security
    "repeat_visit_no_cart": ("B", [("TN", +1, 0.7, "no_commit")]),
    "many_views_no_cart":  ("B", [("TN", +1, 0.6, "no_commit")]),
    "prior_orders":        ("B", [("TN", -1, 1.0, "history")]),        # partner context: repeat buyer
    "gallery_swipe":       ("B", [("INS", +1, 1.0, "visual_engagement")]),
    "image_zoom":          ("B", [("INS", +1, 0.6, "visual_engagement")]),
    "fast_scroll":         ("B", [("INS", +1, 0.6, "browse_pace"), ("IA", -1, 0.4, "pace")]),
    "dimension_open":      ("B", [("IA", +1, 0.7, "detail_depth")]),
    "mis_tap":             ("B", [("IF", -1, 1.0, "motor")]),
    "slow_deliberate_scroll": ("B", [("IF", -1, 0.5, "pace_ui")]),
    "howto_open":          ("B", [("IF", -1, 0.7, "guidance")]),
    "phone_copy":          ("B", [("IF", -1, 0.4, "guidance"), ("TN", +1, 0.5, "human_contact")]),
    "dead_click":          ("B", [("IF", -1, 0.6, "motor"), ("CF", +1, 0.8, "friction")]),
    "back_nav":            ("B", [("CF", +1, 1.0, "bouncing")]),
    "search_refine_no_click": ("B", [("CF", +1, 1.0, "search_fail")]),
    "search_box_use":      ("B", [("IF", +1, 0.6, "control")]),
}
# Signals that feed only the categorical rules (intent stage, buyingFor)
STAGE_SIGNALS = {"add_to_cart", "reorder_click", "checkout_start", "direct_product_entry",
                 "delivery_open", "saved_item", "repeat_visit_same_items"}
BF_SIGNALS = {"suitability_open", "gift_option_open", "price_spread_wide", "seat_counter"}


# ---------------------------------------------------------------- 3. accumulation
def saturate(n):
    """Repeats count, with diminishing returns: 1 -> 0.5, 2 -> 0.75, 3 -> 0.875."""
    return 1 - 0.5 ** n


def accumulate(signals, prior_groups=None, carry=0.6):
    """signals: {signal_id: count}. Returns {trait: {group: logit}}.
    prior_groups: last visit's group sums from localStorage, multiplied by `carry`
    so new behaviour outweighs the old guess."""
    groups = {t: {} for t in TRAITS}
    if prior_groups:
        for t, gs in prior_groups.items():
            for g, v in gs.items():
                groups[t][g] = v * carry
    for sid, n in signals.items():
        if sid not in SIGNALS or n <= 0:
            continue
        tier, effects = SIGNALS[sid]
        for trait, sign, strength, group in effects:
            c = TIER_WEIGHT[tier] * strength * sign * saturate(n)
            groups[trait][group] = groups[trait].get(group, 0.0) + c
    for t in groups:   # cap each group
        for g in groups[t]:
            groups[t][g] = max(-GROUP_CAP, min(GROUP_CAP, groups[t][g]))
    return groups


def score(trait_groups):
    """value = sigmoid(sum of capped groups). Confidence from mass x agreement."""
    vals = list(trait_groups.values())
    L = sum(vals)
    value = 1 / (1 + math.exp(-L))
    mass = sum(abs(v) for v in vals)
    if mass == 0:
        return value, 0.0
    agreement = abs(L) / mass                      # 1 = all groups agree, 0 = they cancel
    conf = agreement * (1 - math.exp(-mass / CONF_SCALE))
    strong = [v for v in vals if abs(v) >= 0.3 and (v > 0) == (L > 0)]
    if len(strong) < 2:
        conf = min(conf, SINGLE_GROUP_CONF_CAP)
    return value, conf


# ---------------------------------------------------------------- 4. categorical rules
def intent_stage(s):
    if s.get("add_to_cart") or s.get("reorder_click") or s.get("checkout_start"):
        return "deciding", 0.9
    if s.get("direct_product_entry") and s.get("delivery_open"):
        return "deciding", 0.8
    if s.get("compare_add", 0) >= 2 or s.get("saved_item", 0) >= 2 or s.get("repeat_visit_same_items", 0) >= 2:
        return "comparing", 0.8
    deep = s.get("spec_open", 0) + s.get("policy_open", 0) + s.get("review_first", 0) + s.get("dimension_open", 0)
    if deep >= 2:
        return "researching", 0.7
    return "browsing", 0.6


def buying_for(s, declared):
    if "buyingFor" in declared:
        return declared["buyingFor"], 1.0
    if s.get("seat_counter"):
        return "other", 0.7
    hints = sum(1 for k in ("suitability_open", "gift_option_open", "price_spread_wide") if s.get(k))
    if hints >= 2:
        return "other", 0.6
    return "unknown", 0.0          # never assume "self" from silence


# ---------------------------------------------------------------- 5. profile
def build_profile(signals, declared=None, context=None, prior_groups=None):
    declared = declared or {}
    context = context or {}
    if context.get("consent") is False:
        return {"consent": False}
    groups = accumulate(signals, prior_groups)
    traits = {}
    for t in TRAITS:
        v, c = score(groups[t])
        traits[t] = {"value": round(v, 2), "conf": round(c, 2), "source": "inferred"}
    for t, v in declared.get("traits", {}).items():     # ADR-003: declared pins the trait
        traits[t] = {"value": v, "conf": 1.0, "source": "declared"}
    stage, sconf = intent_stage(signals)
    bf, bconf = buying_for(signals, declared)
    return {"traits": traits, "stage": stage, "stage_conf": sconf,
            "buyingFor": bf, "bf_conf": bconf, "context": context, "declared": declared,
            "groups": groups}


# ---------------------------------------------------------------- 6. persona mapping
def known(p, t, op, x):
    tr = p["traits"][t]
    if tr["conf"] < THRESHOLD:
        return False
    return tr["value"] >= x if op == ">=" else tr["value"] <= x


def dialect(p):
    d, c = p["declared"], p["context"]
    if "dialect" in d:                                         return "explicit view switch", d["dialect"], 1.0
    if c.get("os_large_text") or c.get("prefers_contrast_more"):
        return "accessibility setting", "guided", 1.0
    if known(p, "IF", "<=", 0.35):                             return "low fluency", "guided", p["traits"]["IF"]["conf"]
    if known(p, "CF", ">=", 0.6):                              return "confusion", "guided", p["traits"]["CF"]["conf"]
    ins, ia = p["traits"]["INS"], p["traits"]["IA"]
    if known(p, "INS", ">=", 0.65) and ins["value"] >= ia["value"]:
        return "visual engagement", "visual", ins["conf"]
    if known(p, "JT", ">=", 0.65) and known(p, "IA", ">=", 0.65):
        return "technical + detail", "dense", min(p["traits"]["JT"]["conf"], ia["conf"])
    if known(p, "JT", "<=", 0.3) and p["traits"]["IA"]["value"] <= 0.55:
        return "plain words, moderate detail", "guided", p["traits"]["JT"]["conf"]
    return "no strong evidence", "standard", None


def need(p, dialect_name=None):
    d = p["declared"]
    if "need" in d:
        return "declared", d["need"], 1.0
    T = p["traits"]
    # quick: the visitor already decided (cart / reorder / checkout). Only blocked by
    # evidence of a hunger for detail. v1 demanded *proof* of low appetite -> missed Maria.
    if p["stage"] == "deciding" and p["stage_conf"] >= 0.8 and T["IA"]["value"] <= 0.4:
        return "already decided", "quick", p["stage_conf"]
    cands = []
    for t, n, x in (("TN", "reassurance", 0.6), ("PS", "deals", 0.65), ("IA", "specs", 0.65),
                    ("INS", "inspiration", 0.65)):
        if not known(p, t, ">=", x):
            continue
        # INS is already spent on the visual dialect; don't count one trait twice.
        if n == "inspiration" and dialect_name == "visual":
            continue
        v = T[t]["value"] + (0.05 if n == "reassurance" else 0)  # ties -> the less-commercial page
        cands.append((v, n, T[t]["conf"], t))
    if cands:
        v, n, c, t = max(cands)
        return f"strongest: {t}", n, c
    if dialect_name == "visual":
        return "visual, nothing else stands out", "inspiration", T["INS"]["conf"]
    return "no strong evidence", "balanced", None


def copy_register(p):
    if known(p, "JT", "<=", 0.35): return "plain"
    if known(p, "JT", ">=", 0.65): return "technical"
    return "standard"


def persona(p):
    if not p.get("traits"):
        return {"dialect": "standard", "need": "balanced", "why": "no consent"}
    dr, dl, dc = dialect(p)
    nr, nd, nc = need(p, dl)
    adapted = [c for c in (dc, nc) if c is not None]   # confidence of what we actually changed
    return {"dialect": dl, "need": nd, "dialect_why": dr, "need_why": nr,
            "confidence": round(min(adapted), 2) if adapted else 0.0, "copyRegister": copy_register(p),
            "giftContext": p["buyingFor"] == "other"}


# ---------------------------------------------------------------- 7. fixtures
# Raw signals per client, transcribed from specs/client-profiles.md ("Signals" and
# "How we measure it"). Counts are [ASSUMPTION]. `expect` = traits from client-profiles.md
# (TN = 1 - trust) and the dialect x need the team's SPEC §3.4 expects.
CLIENTS = [
    ("Tudor", {"ref_social": 1, "fast_scroll": 3, "gallery_swipe": 4, "views_without_opens": 9,
               "short_session": 1}, {}, {},
     {"IA": .15, "JT": .2, "PS": .5, "TN": .3, "stage": "browsing"}, ("visual", "inspiration")),
    ("Ana", {"ref_price_compare": 1, "price_sort": 3, "price_filter": 2, "price_detail_open": 1,
             "cheaper_alt_view": 2, "saved_item": 2}, {}, {},
     {"IA": .6, "JT": .5, "PS": .95, "TN": .5, "stage": "comparing"}, ("standard", "deals")),
    ("Mihai", {"ref_review_site": 1, "search_jargon": 1, "spec_open": 5, "spec_dwell_long": 2,
               "technical_section_open": 2, "compare_add": 3, "filter_technical": 1}, {}, {},
     {"IA": .9, "JT": .9, "PS": .4, "TN": .4, "stage": "comparing"}, ("dense", "specs")),
    ("Elena", {"prior_orders": 3, "reorder_click": 1, "fast_add_from_list": 3, "skip_detail": 4,
               "search_box_use": 3}, {}, {},
     {"IA": .1, "JT": .5, "PS": .4, "TN": .2, "stage": "deciding"}, ("standard", "quick")),
    ("Cristina", {"ref_social": 1, "gallery_swipe": 6, "image_zoom": 3, "dimension_open": 2,
                  "policy_open": 1, "repeat_visit_no_cart": 4, "repeat_visit_same_items": 4,
                  "spec_dwell_long": 1}, {}, {},
     {"IA": .7, "JT": .4, "PS": .5, "TN": .5, "stage": "comparing"}, ("visual", "reassurance")),
    ("Radu", {"search_conversational": 1, "glossary_open": 3, "policy_open": 2, "spec_open": 2,
              "repeat_visit_no_cart": 1}, {}, {},
     {"IA": .6, "JT": .05, "PS": .5, "TN": .75, "stage": "researching"}, ("standard", "reassurance")),
    ("Ioana", {"search_conversational": 1, "spec_open": 3, "spec_dwell_long": 1, "seat_counter": 1,
               "policy_open": 1, "repeat_visit_no_cart": 2, "compare_add": 1}, {}, {},
     {"IA": .8, "JT": .6, "PS": .6, "TN": .5, "stage": "researching"}, ("standard", "specs")),
    ("Victor", {"review_first": 1, "review_sort_critical": 1, "verified_filter": 1, "policy_open": 2,
                "spec_open": 3, "spec_dwell_long": 1, "many_views_no_cart": 4, "filter_technical": 1,
                "technical_section_open": 1}, {}, {},
     {"IA": .7, "JT": .6, "PS": .6, "TN": .85, "stage": "researching"}, ("dense", "reassurance")),
    ("Maria", {"mis_tap": 3, "slow_deliberate_scroll": 2, "howto_open": 1, "phone_copy": 1,
               "reorder_click": 1, "skip_detail": 2}, {}, {"os_large_text": True},
     {"IA": .15, "JT": .05, "PS": .4, "TN": .6, "stage": "deciding"}, ("guided", "quick")),
    ("Gheorghe", {"search_conversational": 2, "suitability_open": 3, "price_spread_wide": 1,
                  "policy_open": 1, "gift_option_open": 1, "glossary_open": 1, "review_first": 1},
     {"buyingFor": "other"}, {},
     {"IA": .4, "JT": .1, "PS": .4, "TN": .5, "stage": "researching"}, ("guided", "reassurance")),
]
# Held out: three visitors from specs/visitor-fixtures.md that the weights were NOT tuned on.
HELD_OUT = [
    ("H1 lost (fixtures #2)", {"views_without_opens": 7, "back_nav": 5, "search_conversational": 1,
                               "search_refine_no_click": 2}, {}, {},
     None, ("guided", "balanced")),   # the "volume is not interest" trap: must NOT get dense/specs
    ("H2 decided (fixtures #4)", {"direct_product_entry": 1, "delivery_open": 1, "add_to_cart": 1,
                                  "skip_detail": 3, "short_session": 1}, {}, {},
     None, ("standard", "quick")),
    ("H3 40 seconds (fixtures #10)", {"ref_social": 1, "fast_scroll": 3, "short_session": 1,
                                      "views_without_opens": 2}, {}, {},
     None, ("standard", "balanced")),  # too little evidence: should stay neutral, not guess "visual"
]


# Batch 2: written AFTER the model was frozen (blob b0fdc91). Expected personas come from the
# team spec's dialect/need definitions, fixed in specs/client-profiles-2.md before the first run.
# Each has 1-2 noise signals (marked). Model code was NOT changed after seeing these results.
BATCH_2 = [
    ("11 Andreea", {"ref_social": 1, "gallery_swipe": 3, "review_first": 1, "policy_open": 1,
                    "price_sort": 1}, {}, {}, None, ("visual", "reassurance")),          # noise: price_sort
    ("12 Paul", {"search_jargon": 1, "spec_open": 4, "compare_add": 2, "price_sort": 2,
                 "price_filter": 1, "fast_scroll": 1}, {}, {}, None, ("dense", "specs")),  # noise: fast_scroll
    ("13 Irina", {"search_conversational": 1, "spec_open": 3, "spec_dwell_long": 1,
                  "search_box_use": 3, "gallery_swipe": 1}, {}, {}, None, ("standard", "specs")),  # noise: swipe
    ("14 Sorin", {"ref_price_compare": 1, "price_sort": 1, "add_to_cart": 1, "skip_detail": 2,
                  "short_session": 1, "image_zoom": 1}, {}, {}, None, ("standard", "quick")),  # noise: zoom
    ("15 Lavinia", {"views_without_opens": 1, "short_session": 1}, {}, {}, None, ("standard", "balanced")),
    ("16 Dan", {"search_conversational": 1, "spec_open": 2, "spec_dwell_long": 1, "glossary_open": 2,
                "price_filter": 1}, {}, {}, None, ("standard", "specs")),                # noise: price_filter
    ("17 Bianca", {"ref_social": 1, "gallery_swipe": 8, "image_zoom": 4, "fast_scroll": 3,
                   "views_without_opens": 15, "price_sort": 1}, {}, {}, None, ("visual", "inspiration")),  # noise: sort
    ("18 Florin", {"search_jargon": 1, "spec_open": 3, "technical_section_open": 2, "compare_add": 2,
                   "filter_technical": 1, "policy_open": 1}, {}, {}, None, ("dense", "specs")),  # noise: policy
    ("19 Corina", {"views_without_opens": 6, "back_nav": 4, "search_refine_no_click": 2, "mis_tap": 1,
                   "gallery_swipe": 1}, {}, {}, None, ("guided", "balanced")),          # noise: swipe
    ("20 Emil", {"repeat_visit_same_items": 3, "repeat_visit_no_cart": 3, "review_sort_critical": 1,
                 "policy_open": 1, "price_detail_open": 1, "price_sort": 2, "spec_open": 1},
     {}, {}, None, ("standard", "reassurance")),                                         # noise: spec_open
]


def band(v):
    return "low" if v < 0.35 else "high" if v > 0.65 else "mid"


def run(rows, title):
    print(f"\n=== {title} ===")
    hits = 0
    trait_ok = trait_total = trait_unknown = 0
    for name, sig, decl, ctx, exp_traits, (exp_d, exp_n) in rows:
        p = build_profile(sig, decl, ctx)
        per = persona(p)
        ok = per["dialect"] == exp_d and per["need"] == exp_n
        hits += ok
        print(f"{'OK ' if ok else 'MISS'} {name:28s} -> {per['dialect']:8s} x {per['need']:11s} "
              f"(conf {per['confidence']:.2f}; expected {exp_d} x {exp_n}) "
              f"register={per['copyRegister']} gift={per['giftContext']}")
        line = []
        for t in TRAITS:
            tr = p["traits"][t]
            mark = ""
            if exp_traits and t in exp_traits:
                if tr["conf"] < THRESHOLD:
                    trait_unknown += 1
                    mark = "?"
                else:
                    trait_total += 1
                    if band(tr["value"]) == band(exp_traits[t]):
                        trait_ok += 1
                    else:
                        mark = "!"
            line.append(f"{t} {tr['value']:.2f}/{tr['conf']:.2f}{mark}")
        stage_mark = "" if not exp_traits else ("" if p["stage"] == exp_traits["stage"] else "!")
        print("      " + "  ".join(line) + f"  stage {p['stage']}{stage_mark}  for {p['buyingFor']}")
    print(f"--> persona {hits}/{len(rows)} match")
    if trait_total or trait_unknown:
        print(f"--> traits with enough evidence: {trait_ok}/{trait_total} in the expected band; "
              f"{trait_unknown} left neutral (not enough evidence)")
    return hits


def sensitivity(rows, runs=300, jitter=0.25, seed=7):
    """Multiply every signal strength by a random factor in [1-jitter, 1+jitter] and
    count how often each visitor keeps the expected persona. Low = fragile."""
    import random
    rng = random.Random(seed)
    original = {k: (tier, list(eff)) for k, (tier, eff) in SIGNALS.items()}
    keep = {r[0]: 0 for r in rows}
    for _ in range(runs):
        for k, (tier, eff) in original.items():
            SIGNALS[k] = (tier, [(t, s, st * rng.uniform(1 - jitter, 1 + jitter), g) for t, s, st, g in eff])
        for name, sig, decl, ctx, _, (ed, en) in rows:
            per = persona(build_profile(sig, decl, ctx))
            keep[name] += per["dialect"] == ed and per["need"] == en
    SIGNALS.update(original)
    print(f"\n=== Robustness: every weight shaken +/-{int(jitter*100)} %, {runs} runs ===")
    for name, k in keep.items():
        print(f"  {name:28s} keeps its persona in {100 * k / runs:5.1f} % of runs")


if __name__ == "__main__":
    print("value/confidence per trait. ! = wrong band, ? = below threshold -> treated as neutral")
    run(CLIENTS, "10 client profiles (weights hand-set with these in view: NOT independent)")
    run(HELD_OUT, "3 held-out visitors (weights not tuned on these)")
    cold = persona(build_profile({}))
    print(f"\nCold start, no signals -> {cold['dialect']} x {cold['need']} (conf {cold['confidence']})")
    print("No consent ->", persona(build_profile({"spec_open": 5}, context={"consent": False})))
    # Return visit: last visit's group sums carried at 0.6, then new contradicting evidence.
    last = build_profile(CLIENTS[2][1])["groups"]           # Mihai's first visit
    again = build_profile({"skip_detail": 3, "views_without_opens": 3}, prior_groups=last)
    print("Return visit, prior=Mihai, today skips all detail -> IA",
          again["traits"]["IA"], "->", persona(again)["dialect"], "x", persona(again)["need"])
    sensitivity(CLIENTS + HELD_OUT)
    run(BATCH_2, "Batch 2: 10 new profiles, model frozen, expectations fixed in advance")
    sensitivity(BATCH_2)
