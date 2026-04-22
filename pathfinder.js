function findShortestPath(db, fromUid, toUid) {
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
      if (db.digimon[evoUid]) neighbors.push({ uid: evoUid, edge: 'evo' });
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
function findConstrainedPath(db, fromUid, toUid, collectionStatus) {
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
      if (db.digimon[evoUid]) neighbors.push({ uid: evoUid, edge: 'evo' });
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
