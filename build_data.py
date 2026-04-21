import json
import sys
from collections import Counter
sys.stdout.reconfigure(encoding='utf-8')

entries = []
with open("D:/repos/test/digimon_guide.txt", "r", encoding="utf-8") as f:
    header = next(f)
    for line in f:
        parts = line.strip().split("\t")
        if len(parts) < 4:
            continue
        seq = int(parts[0])
        cn = parts[1]
        en = parts[2]
        stage = parts[3]
        evo_str = parts[4] if len(parts) > 4 else ""
        devo_str = parts[5] if len(parts) > 5 else ""
        evos = [x.strip() for x in evo_str.split("、") if x.strip()] if evo_str else []
        devos = [x.strip() for x in devo_str.split("、") if x.strip()] if devo_str else []
        entries.append({
            "seq": seq, "cn": cn, "en": en, "stage": stage,
            "evos": evos, "devos": devos
        })

# Filter out stage "9" entries (these are duplicates of existing entries with bad stage data)
entries = [e for e in entries if e["stage"] != "9"]

# Find names that appear with multiple stages - these need disambiguation
name_stages = {}
for e in entries:
    name_stages.setdefault(e["cn"], set()).add(e["stage"])
ambiguous_names = {cn for cn, stages in name_stages.items() if len(stages) > 1}

if ambiguous_names:
    print(f"Disambiguating {len(ambiguous_names)} names with stage suffix:")
    for cn in ambiguous_names:
        print(f"  {cn}: {sorted(name_stages[cn])}")

# Add stage suffix to ambiguous names (both in cn and in evo/devo references)
def disambiguate_name(cn, stage):
    if cn in ambiguous_names:
        return f"{cn}（{stage}）"
    return cn

# Update entry names and evo/devo references
# First pass: build a map from (old_cn) -> [(stage, new_cn)] for ambiguous names
# We need to figure out which stage an evo/devo reference points to
# Build a lookup: for ambiguous names, find all (cn, stage) combos
ambiguous_lookup = {}
for e in entries:
    if e["cn"] in ambiguous_names:
        ambiguous_lookup.setdefault(e["cn"], []).append(e["stage"])

# Rename entries
for e in entries:
    e["cn_original"] = e["cn"]
    e["cn"] = disambiguate_name(e["cn"], e["stage"])

# For evo/devo references to ambiguous names, we need to resolve which stage variant
# Strategy: look at what stage the reference likely points to
# We can infer from the evolution direction and the source's stage
# But simpler: build a map from original cn -> list of (new_cn, stage) and match
# For now, since only 多路暴龍獸 is ambiguous, handle by checking evo/devo context

# Build reverse map: for each original entry, what are its evo/devo targets by original name+stage
# We need to update evo/devo name references to use disambiguated names
for e in entries:
    new_evos = []
    for evo_name in e["evos"]:
        if evo_name in ambiguous_names:
            # Find which stage variant this refers to by checking all entries
            # that have this name and could be an evolution target
            variants = [x for x in entries if x["cn_original"] == evo_name]
            if len(variants) == 1:
                new_evos.append(variants[0]["cn"])
            else:
                # Pick the one whose devolutions include us (by original name)
                matched = [v for v in variants if e["cn_original"] in v["devos"]]
                if len(matched) == 1:
                    new_evos.append(matched[0]["cn"])
                else:
                    # Default: pick higher stage variant for evolution
                    stage_order = ["幼年期I", "幼年期II", "成長期", "成熟期", "完全體", "究極體", "超究極體"]
                    variants.sort(key=lambda v: stage_order.index(v["stage"]) if v["stage"] in stage_order else 99, reverse=True)
                    new_evos.append(variants[0]["cn"])
        else:
            new_evos.append(evo_name)
    e["evos"] = new_evos

    new_devos = []
    for devo_name in e["devos"]:
        if devo_name in ambiguous_names:
            variants = [x for x in entries if x["cn_original"] == devo_name]
            if len(variants) == 1:
                new_devos.append(variants[0]["cn"])
            else:
                matched = [v for v in variants if e["cn_original"] in v["evos"]]
                if len(matched) == 1:
                    new_devos.append(matched[0]["cn"])
                else:
                    # Default: pick lower stage variant for devolution
                    stage_order = ["幼年期I", "幼年期II", "成長期", "成熟期", "完全體", "究極體", "超究極體"]
                    variants.sort(key=lambda v: stage_order.index(v["stage"]) if v["stage"] in stage_order else 99)
                    new_devos.append(variants[0]["cn"])
        else:
            new_devos.append(devo_name)
    e["devos"] = new_devos

# Merge duplicates: same CN name + same stage (after disambiguation, cn is already unique per stage)
merged = {}
order = []
for e in entries:
    key = e["cn"]
    if key in merged:
        m = merged[key]
        for ev in e["evos"]:
            if ev not in m["evos"]:
                m["evos"].append(ev)
        for dv in e["devos"]:
            if dv not in m["devos"]:
                m["devos"].append(dv)
    else:
        merged[key] = dict(e)
        order.append(key)

unique = [merged[k] for k in order]
print(f"After merge: {len(unique)} unique entries (from {len(entries)})")

# Assign UIDs
for i, u in enumerate(unique):
    u["uid"] = f"d{i+1:03d}"

# Build CN name -> uid map
cn_to_uid = {}
for u in unique:
    cn_to_uid[u["cn"]] = u["uid"]

# Resolve evo/devo names to UIDs
unresolved = set()
def resolve_name(name):
    if name in cn_to_uid:
        return cn_to_uid[name]
    unresolved.add(name)
    return None

digimon = {}
for u in unique:
    evo_uids = []
    for name in u["evos"]:
        uid = resolve_name(name)
        if uid and uid != u["uid"]:  # exclude self-references
            evo_uids.append(uid)

    devo_uids = []
    for name in u["devos"]:
        uid = resolve_name(name)
        if uid and uid != u["uid"]:  # exclude self-references
            devo_uids.append(uid)

    digimon[u["uid"]] = {
        "uid": u["uid"],
        "dexId": u["seq"],
        "nameCN": u["cn"],
        "nameEN": u["en"],
        "stage": u["stage"],
        "evolutions": evo_uids,
        "devolutions": devo_uids
    }

if unresolved:
    print(f"\nUnresolved evo/devo names ({len(unresolved)}):")
    for name in sorted(unresolved):
        print(f"  {name}")

# Fix asymmetry: if A evolves to B, ensure B devolves to A (and vice versa)
fixes = 0
for uid, d in digimon.items():
    for evo_uid in d["evolutions"]:
        if evo_uid in digimon and uid not in digimon[evo_uid]["devolutions"]:
            digimon[evo_uid]["devolutions"].append(uid)
            fixes += 1
    for devo_uid in d["devolutions"]:
        if devo_uid in digimon and uid not in digimon[devo_uid]["evolutions"]:
            digimon[devo_uid]["evolutions"].append(uid)
            fixes += 1
print(f"Fixed {fixes} asymmetric evo/devo relationships")

# Reassign dexId sequentially (1-based)
sorted_entries = sorted(digimon.values(), key=lambda x: x["dexId"])
for i, entry in enumerate(sorted_entries):
    entry["dexId"] = i + 1

stages = ["幼年期I", "幼年期II", "成長期", "成熟期", "完全體", "究極體", "超究極體"]

db = {
    "digimon": digimon,
    "stages": stages
}

# Write data.js
js_content = "const DEFAULT_DIGIMON_DB = " + json.dumps(db, ensure_ascii=False, indent=2) + ";\n"

with open("D:/repos/test/digimon-app/data.js", "w", encoding="utf-8") as f:
    f.write(js_content)

# Write backup copy
with open("D:/repos/test/digimon-app/data_backup.js", "w", encoding="utf-8") as f:
    f.write("const BACKUP_DIGIMON_DB = " + json.dumps(db, ensure_ascii=False, indent=2) + ";\n")

print(f"\nGenerated data.js with {len(digimon)} entries")
print(f"Generated data_backup.js as factory backup")
