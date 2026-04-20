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
