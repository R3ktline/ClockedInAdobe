"""
Show, step by step, how the signal model scores one person. Changes nothing in the model.

Run:  python scripts/trace.py "12 Paul"      (any name from CLIENTS, HELD_OUT or BATCH_2)
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import signal_model as m  # noqa: E402

who = sys.argv[1] if len(sys.argv) > 1 else "12 Paul"
rows = [r for r in m.CLIENTS + m.HELD_OUT + m.BATCH_2 if r[0] == who]
if not rows:
    sys.exit(f"No person called {who!r}. Names: " + ", ".join(r[0] for r in m.CLIENTS + m.HELD_OUT + m.BATCH_2))
name, sig, decl, ctx, _, exp = rows[0]

print(f"=== {name} ===\n")
print("STEP 1  Evidence. Each signal -> contribution = tier weight x strength x direction x (1 - 0.5^n)")
for sid, n in sig.items():
    if sid not in m.SIGNALS:
        print(f"   {sid:24s} n={n}  (used only by the stage / buyingFor rules)")
        continue
    tier, eff = m.SIGNALS[sid]
    for t, s, st, g in eff:
        c = m.TIER_WEIGHT[tier] * st * s * m.saturate(n)
        print(f"   {sid:24s} n={n}  tier {tier}  -> {t:3s} {c:+.3f}   group '{g}'")

p = m.build_profile(sig, decl, ctx)
print("\nSTEP 2-3  Per trait: add up each group (cap +/-1.2), then value and confidence")
for t in m.TRAITS:
    gs = p["groups"][t]
    if not gs:
        continue
    vals = list(gs.values())
    L = sum(vals)
    mass = sum(abs(v) for v in vals)
    agree = abs(L) / mass if mass else 0
    raw = agree * (1 - math.exp(-mass))
    strong = [g for g, v in gs.items() if abs(v) >= 0.3 and (v > 0) == (L > 0)]
    tr = p["traits"][t]
    print(f"   {t}: groups " + ", ".join(f"{g} {v:+.2f}" for g, v in gs.items()))
    note = "  (capped at 0.60: fewer than 2 strong groups)" if len(strong) < 2 and raw > 0.6 else ""
    print(f"       value = {tr['value']:.2f}   confidence = {tr['conf']:.2f}{note}   "
          f"strong groups: {len(strong)}   -> {'USED' if tr['conf'] >= m.THRESHOLD else 'too weak, treated as neutral'}")

print(f"\nSTEP 4  Rules: stage = {p['stage']} ({p['stage_conf']}), buying for = {p['buyingFor']}")
per = m.persona(p)
print(f"\nSTEP 5  Dialect: {per['dialect']:8s} because: {per['dialect_why']}")
print(f"        Need:    {per['need']:8s} because: {per['need_why']}")
print(f"\nRESULT  {per['dialect']} x {per['need']}  (confidence {per['confidence']}, copy {per['copyRegister']})")
print(f"EXPECTED {exp[0]} x {exp[1]}  ->  {'MATCH' if (per['dialect'], per['need']) == exp else 'MISS'}")
