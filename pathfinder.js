function findShortestPath(db, fromUid, toUid, blacklist) {
  if (fromUid === toUid) return [{ uid: fromUid, edge: null }];

  const visited = new Set([fromUid]);
  const queue = [[{ uid: fromUid, edge: null }]];

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1].uid;
    const digimon = db.digimon[current];
    if (!digimon) continue;

    const neighbors = [];
    for (const evoUid of (digimon.evolutions || [])) {
      if (db.digimon[evoUid] && !(blacklist && blacklist.has(evoUid))) neighbors.push({ uid: evoUid, edge: 'evo' });
    }
    for (const devoUid of (digimon.devolutions || [])) {
      if (db.digimon[devoUid]) neighbors.push({ uid: devoUid, edge: 'devo' });
    }

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.uid)) continue;
      visited.add(neighbor.uid);
      const newPath = [...path, neighbor];
      if (neighbor.uid === toUid) return newPath;
      queue.push(newPath);
    }
  }

  return null;
}

// Constrained path: devolution only allowed to seen(1) or owned(2) Digimon
// Evolution can go to any Digimon (including unseen)
function findConstrainedPath(db, fromUid, toUid, collectionStatus, blacklist) {
  if (fromUid === toUid) return [{ uid: fromUid, edge: null }];

  const visited = new Set([fromUid]);
  const queue = [[{ uid: fromUid, edge: null }]];

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1].uid;
    const digimon = db.digimon[current];
    if (!digimon) continue;

    const neighbors = [];
    for (const evoUid of (digimon.evolutions || [])) {
      if (db.digimon[evoUid] && !(blacklist && blacklist.has(evoUid))) neighbors.push({ uid: evoUid, edge: 'evo' });
    }
    for (const devoUid of (digimon.devolutions || [])) {
      // Only allow devolution to seen or owned
      const status = (collectionStatus && collectionStatus[devoUid]) || 0;
      if (db.digimon[devoUid] && status >= 1) {
        neighbors.push({ uid: devoUid, edge: 'devo' });
      }
    }

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.uid)) continue;
      visited.add(neighbor.uid);
      const newPath = [...path, neighbor];
      if (neighbor.uid === toUid) return newPath;
      queue.push(newPath);
    }
  }

  return null;
}

// Constrained path with extra seen set (for waypoint chains where prior path nodes count as seen)
function findConstrainedPathWithSeen(db, fromUid, toUid, collectionStatus, extraSeen, blacklist) {
  if (fromUid === toUid) return [{ uid: fromUid, edge: null }];

  const visited = new Set([fromUid]);
  const queue = [[{ uid: fromUid, edge: null }]];

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1].uid;
    const digimon = db.digimon[current];
    if (!digimon) continue;

    const neighbors = [];
    for (const evoUid of (digimon.evolutions || [])) {
      if (db.digimon[evoUid] && !(blacklist && blacklist.has(evoUid))) neighbors.push({ uid: evoUid, edge: 'evo' });
    }
    for (const devoUid of (digimon.devolutions || [])) {
      const status = (collectionStatus && collectionStatus[devoUid]) || 0;
      if (db.digimon[devoUid] && (status >= 1 || extraSeen.has(devoUid))) {
        neighbors.push({ uid: devoUid, edge: 'devo' });
      }
    }

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.uid)) continue;
      visited.add(neighbor.uid);
      const newPath = [...path, neighbor];
      if (neighbor.uid === toUid) return newPath;
      queue.push(newPath);
    }
  }

  return null;
}

// Find shortest path from→to passing through all waypoints (order auto-optimized)
function findPathWithWaypoints(db, fromUid, toUid, waypoints, collectionStatus, blacklist) {
  waypoints = waypoints || [];
  if (waypoints.length === 0) {
    return {
      ideal: findShortestPath(db, fromUid, toUid, blacklist),
      constrained: findConstrainedPathWithSeen(db, fromUid, toUid, collectionStatus, new Set(), blacklist)
    };
  }

  // Generate all permutations of waypoints
  function permutations(arr) {
    if (arr.length <= 1) return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of permutations(rest)) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
  }

  const perms = permutations(waypoints);

  // Ideal path (no constraints)
  let bestIdeal = null;
  for (const perm of perms) {
    const stops = [fromUid, ...perm, toUid];
    let fullPath = null;
    let valid = true;
    for (let i = 0; i < stops.length - 1; i++) {
      const seg = findShortestPath(db, stops[i], stops[i + 1], blacklist);
      if (!seg) { valid = false; break; }
      if (fullPath) {
        fullPath = fullPath.concat(seg.slice(1));
      } else {
        fullPath = seg;
      }
    }
    if (valid && fullPath && (!bestIdeal || fullPath.length < bestIdeal.length)) {
      bestIdeal = fullPath;
    }
  }

  // Constrained path (devo only to seen + dynamically accumulated seen from path)
  let bestConstrained = null;
  for (const perm of perms) {
    const stops = [fromUid, ...perm, toUid];
    let fullPath = null;
    let dynamicSeen = new Set();
    let valid = true;
    for (let i = 0; i < stops.length - 1; i++) {
      const seg = findConstrainedPathWithSeen(db, stops[i], stops[i + 1], collectionStatus, dynamicSeen, blacklist);
      if (!seg) { valid = false; break; }
      // Add all nodes in this segment to dynamicSeen
      for (const step of seg) {
        dynamicSeen.add(step.uid);
      }
      if (fullPath) {
        fullPath = fullPath.concat(seg.slice(1));
      } else {
        fullPath = seg;
      }
    }
    if (valid && fullPath && (!bestConstrained || fullPath.length < bestConstrained.length)) {
      bestConstrained = fullPath;
    }
  }

  return { ideal: bestIdeal, constrained: bestConstrained };
}

function mergePath(base, segment) {
  if (!segment) return base;
  if (!base) return [...segment];
  return base.concat(segment.slice(1));
}

function findSkillRoutePlan(db, fromUid, toUid, waypoints, collectionStatus, blacklist, skillLearnerMap, limit) {
  const normalized = (waypoints || []).map(wp => typeof wp === 'string' ? { type: 'digimon', uid: wp } : wp).filter(Boolean);
  let requiredDigimon = normalized.filter(wp => wp.type !== 'skill' && wp.uid).map(wp => wp.uid);
  const uncovered = new Set(normalized.filter(wp => wp.type === 'skill' && wp.skill).map(wp => wp.skill));
  const segments = [];
  let currentUid = fromUid;
  let idealChain = null;
  let constrainedChain = null;
  const coveredSkills = [];
  const maxSegments = limit || (requiredDigimon.length + uncovered.size + 2);

  function skillsInPath(path) {
    const matched = [];
    const seen = new Set();
    if (!path) return matched;
    for (const step of path) {
      for (const skillName of uncovered) {
        const learners = skillLearnerMap && skillLearnerMap.get(skillName);
        if (!seen.has(skillName) && learners && learners.has(step.uid)) {
          seen.add(skillName);
          matched.push(skillName);
        }
      }
    }
    return matched;
  }

  function appendSegment(segment) {
    segments.push(segment);
    idealChain = mergePath(idealChain, segment.ideal);
    if (segments.length === 1) {
      constrainedChain = segment.constrained ? [...segment.constrained] : null;
    } else if (constrainedChain && segment.constrained) {
      constrainedChain = mergePath(constrainedChain, segment.constrained);
    } else {
      constrainedChain = null;
    }
    const idealUids = new Set((segment.ideal || []).map(step => step.uid));
    requiredDigimon = requiredDigimon.filter(uid => !idealUids.has(uid));
    for (const skillName of segment.matchedSkills) {
      if (uncovered.delete(skillName)) coveredSkills.push(skillName);
    }
    currentUid = segment.uid;
  }

  for (let step = 0; step < maxSegments && (requiredDigimon.length > 0 || uncovered.size > 0); step++) {
    if (requiredDigimon.length === 0 && uncovered.size > 0) {
      const direct = findPathWithWaypoints(db, currentUid, toUid, [], collectionStatus, blacklist);
      const directSkills = skillsInPath(direct.ideal);
      if (direct.ideal && directSkills.length === uncovered.size) break;
    }

    let best = null;
    const candidateUids = new Set(requiredDigimon);
    for (const skillName of uncovered) {
      const learners = skillLearnerMap && skillLearnerMap.get(skillName);
      if (learners) for (const uid of learners) candidateUids.add(uid);
    }

    for (const uid of candidateUids) {
      if (!db.digimon[uid]) continue;
      const path = findPathWithWaypoints(db, currentUid, uid, [], collectionStatus, blacklist);
      if (!path.ideal && !path.constrained) continue;
      const matchedSkills = skillsInPath(path.ideal);
      const requiredHit = requiredDigimon.includes(uid) || (path.ideal || []).some(step => requiredDigimon.includes(step.uid));
      if (!requiredHit && matchedSkills.length === 0) continue;

      const routeLength = (path.constrained || path.ideal).length;
      const candidate = { uid, matchedSkills, ideal: path.ideal, constrained: path.constrained, routeLength, requiredHit };
      if (!best
        || candidate.matchedSkills.length > best.matchedSkills.length
        || (candidate.matchedSkills.length === best.matchedSkills.length && candidate.requiredHit && !best.requiredHit)
        || (candidate.matchedSkills.length === best.matchedSkills.length && candidate.requiredHit === best.requiredHit && candidate.routeLength < best.routeLength)
        || (candidate.matchedSkills.length === best.matchedSkills.length && candidate.requiredHit === best.requiredHit && candidate.routeLength === best.routeLength && !!candidate.constrained && !best.constrained)
        || (candidate.matchedSkills.length === best.matchedSkills.length && candidate.requiredHit === best.requiredHit && candidate.routeLength === best.routeLength && !!candidate.constrained === !!best.constrained && db.digimon[candidate.uid].dexId < db.digimon[best.uid].dexId)) {
        best = candidate;
      }
    }

    if (!best) break;
    appendSegment(best);
  }

  const finalPath = findPathWithWaypoints(db, currentUid, toUid, [], collectionStatus, blacklist);
  if (finalPath.ideal || finalPath.constrained) {
    appendSegment({ uid: toUid, matchedSkills: skillsInPath(finalPath.ideal), ideal: finalPath.ideal, constrained: finalPath.constrained, routeLength: (finalPath.constrained || finalPath.ideal).length, final: true });
  }

  return {
    segments,
    coveredSkills,
    uncoveredSkills: [...uncovered],
    missedDigimon: requiredDigimon,
    idealChain,
    constrainedChain,
    reachedTarget: !!finalPath.ideal
  };
}

// Collection route planner: find chain(s) to own all un-owned Digimon
function findCollectionRoute(db, collectionStatus, startUid) {
  const seen = new Set();
  const owned = new Set();

  for (const uid of Object.keys(db.digimon)) {
    const s = (collectionStatus && collectionStatus[uid]) || 0;
    if (s >= 1) seen.add(uid);
    if (s >= 2) owned.add(uid);
  }

  const allUids = Object.keys(db.digimon);
  if (allUids.every(u => owned.has(u))) {
    return { chains: [], unreachable: [] };
  }

  function getNeighbors(uid) {
    const d = db.digimon[uid];
    if (!d) return [];
    const neighbors = [];
    for (const evoUid of (d.evolutions || [])) {
      if (db.digimon[evoUid]) neighbors.push({ uid: evoUid, edge: 'evo' });
    }
    for (const devoUid of (d.devolutions || [])) {
      if (db.digimon[devoUid] && seen.has(devoUid)) {
        neighbors.push({ uid: devoUid, edge: 'devo' });
      }
    }
    return neighbors;
  }

  function score(uid) {
    const d = db.digimon[uid];
    if (!d) return 0;
    let s = 0;
    for (const evoUid of (d.evolutions || [])) {
      if (db.digimon[evoUid] && !owned.has(evoUid)) s++;
    }
    for (const devoUid of (d.devolutions || [])) {
      if (db.digimon[devoUid] && !owned.has(devoUid) && seen.has(devoUid)) s++;
    }
    return s;
  }

  function findBridgeToUnowned(fromUid, visitedInChain) {
    const bfsVisited = new Set([fromUid]);
    const queue = [[{ uid: fromUid, edge: null }]];

    while (queue.length > 0) {
      const path = queue.shift();
      if (path.length > 8) continue;
      const current = path[path.length - 1].uid;
      const neighbors = getNeighbors(current);

      for (const n of neighbors) {
        if (bfsVisited.has(n.uid)) continue;
        bfsVisited.add(n.uid);
        const newPath = [...path, n];
        if (!owned.has(n.uid)) return newPath;
        queue.push(newPath);
      }
    }
    return null;
  }

  function buildChain(start) {
    const chain = [{ uid: start, edge: null }];
    let current = start;
    const visitedInChain = new Set([start]);

    while (true) {
      const neighbors = getNeighbors(current);
      const unownedNeighbors = neighbors.filter(n => !owned.has(n.uid) && !visitedInChain.has(n.uid));

      if (unownedNeighbors.length === 0) {
        const bridge = findBridgeToUnowned(current, visitedInChain);
        if (bridge) {
          for (let i = 1; i < bridge.length; i++) {
            visitedInChain.add(bridge[i].uid);
            seen.add(bridge[i].uid);
            owned.add(bridge[i].uid);
            chain.push(bridge[i]);
          }
          current = bridge[bridge.length - 1].uid;
          continue;
        }
        break;
      }

      unownedNeighbors.sort((a, b) => score(b.uid) - score(a.uid));
      const next = unownedNeighbors[0];
      visitedInChain.add(next.uid);
      seen.add(next.uid);
      owned.add(next.uid);
      chain.push(next);
      current = next.uid;
    }

    return chain;
  }

  // Auto-pick start
  let start = null;
  if (startUid && owned.has(startUid)) {
    start = startUid;
  } else {
    let bestScore = -1;
    for (const uid of owned) {
      const s = score(uid);
      if (s > bestScore) { bestScore = s; start = uid; }
    }
  }

  if (!start) {
    return { chains: [], unreachable: allUids.filter(u => !owned.has(u)) };
  }

  const chain = buildChain(start);
  const chains = chain.length > 1 ? [chain] : [];
  const unreachable = allUids.filter(u => !owned.has(u));
  return { chains, unreachable };
}
