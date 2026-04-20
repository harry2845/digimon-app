import json
import sys
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

# Merge duplicates: same CN name + same stage
merged = {}
order = []
for e in entries:
    key = (e["cn"], e["stage"])
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

# Build CN name -> uid map (for resolving evo/devo references)
# If multiple entries share same CN name, we need to handle carefully
cn_to_uid = {}
cn_ambiguous = set()
for u in unique:
    cn = u["cn"]
    if cn in cn_to_uid:
        cn_ambiguous.add(cn)
    else:
        cn_to_uid[cn] = u["uid"]

if cn_ambiguous:
    print(f"Warning: {len(cn_ambiguous)} ambiguous CN names (multiple stages):")
    for cn in cn_ambiguous:
        matches = [u for u in unique if u["cn"] == cn]
        print(f"  {cn}: {[(m['uid'], m['stage']) for m in matches]}")
        # For ambiguous names, keep first occurrence in map (lower stage usually)

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
        if uid:
            evo_uids.append(uid)

    devo_uids = []
    for name in u["devos"]:
        uid = resolve_name(name)
        if uid:
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
