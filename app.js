(function () {
  'use strict';

  // ── i18n (Traditional/Simplified Chinese) ──
  const LANG_KEY = 'digimonLang';
  let currentLang = localStorage.getItem(LANG_KEY) || 'tw'; // 'tw' or 'cn'
  let toSimplified = null;
  let toTraditional = null;

  function initConverter() {
    if (window.OpenCC) {
      toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });
      toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });
    }
  }

  function t(text) {
    if (currentLang === 'cn' && toSimplified) return toSimplified(text);
    return text;
  }

  function fromInput(text) {
    if (currentLang === 'cn' && toTraditional) return toTraditional(text);
    return text;
  }

  function updateStaticText() {
    const btn = document.getElementById('langToggle');
    if (btn) btn.textContent = currentLang === 'tw' ? '繁' : '简';
    document.title = t('数码宝贝电子图鉴');
    const listLink = document.querySelector('[data-page="list"]');
    if (listLink) listLink.textContent = t('图鉴');
    const pathLink = document.querySelector('[data-page="pathfinder"]');
    if (pathLink) pathLink.textContent = t('路线查询');
    const editSpan = document.querySelector('.edit-toggle span');
    if (editSpan) editSpan.textContent = t('编辑模式');
    const menuBtn = document.getElementById('dataMenuBtn');
    if (menuBtn) menuBtn.title = t('数据管理');
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.textContent = t('导出JSON');
    const importBtn = document.getElementById('importBtn');
    if (importBtn) importBtn.textContent = t('导入JSON');
    const saveDefaultBtn = document.getElementById('saveDefaultBtn');
    if (saveDefaultBtn) saveDefaultBtn.textContent = t('保存为默认数据');
    const resetDefaultBtn = document.getElementById('resetDefaultBtn');
    if (resetDefaultBtn) resetDefaultBtn.textContent = t('重置为默认数据');
    const resetBackupBtn = document.getElementById('resetBackupBtn');
    if (resetBackupBtn) resetBackupBtn.textContent = t('重置为出厂数据');
    const addBtn = document.getElementById('addDigimonBtn');
    if (addBtn) addBtn.textContent = '+ ' + t('新增角色');
    // Pathfinder page static text
    const pfPage = document.getElementById('pathfinderPage');
    if (pfPage) {
      const h2s = pfPage.querySelectorAll('h2');
      if (h2s[0]) h2s[0].textContent = t('进化路线查询');
      if (h2s[1]) h2s[1].textContent = t('全收集路线规划');
      const labels = pfPage.querySelectorAll('.path-select label');
      labels.forEach(l => {
        if (l.htmlFor === 'pathFrom' || l.closest('.path-select')?.querySelector('#pathFrom'))
          l.textContent = t('起点');
        else if (l.htmlFor === 'pathTo' || l.closest('.path-select')?.querySelector('#pathTo'))
          l.textContent = t('终点');
        else if (l.closest('.path-select')?.querySelector('#collectStart'))
          l.textContent = t('起点（可选，留空自动选择）');
      });
      const pathFrom = document.getElementById('pathFrom');
      if (pathFrom) pathFrom.placeholder = t('搜索数码宝贝...');
      const pathTo = document.getElementById('pathTo');
      if (pathTo) pathTo.placeholder = t('搜索数码宝贝...');
      const collectStart = document.getElementById('collectStart');
      if (collectStart) collectStart.placeholder = t('搜索已拥有的数码宝贝...');
      const findBtn = document.getElementById('findPathBtn');
      if (findBtn) findBtn.textContent = t('查找路线');
      const collectBtn = document.getElementById('collectBtn');
      if (collectBtn) collectBtn.textContent = t('生成全收集路线');
      const wpBtn = document.getElementById('addWaypointBtn');
      if (wpBtn) wpBtn.textContent = '+ ' + t('添加途经点');
    }
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.innerHTML = '&larr; ' + t('返回');
    const delBtn = document.getElementById('deleteDigimonBtn');
    if (delBtn) delBtn.textContent = t('删除');
  }

  function toggleLang() {
    currentLang = currentLang === 'tw' ? 'cn' : 'tw';
    localStorage.setItem(LANG_KEY, currentLang);
    updateStaticText();
    renderStageFilter();
    navigate();
  }

  // ── Data Layer ──
  const STORAGE_KEY = 'digimonDB';

  function loadDB() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { /* fall through */ }
    }
    return JSON.parse(JSON.stringify(DEFAULT_DIGIMON_DB));
  }

  function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  let db = loadDB();
  let editMode = false;
  let currentFilter = null; // null = all stages
  let currentStatusFilter = null; // null = all, 'unseen', 'seen', 'owned', 'seen+', 'seen_only'

  // ── Collection Status ──
  // 0 = 未见过, 1 = 已见过, 2 = 已拥有
  const COLLECTION_KEY = 'digimonCollection';
  const STATUS_LABELS = ['未见过', '已见过', '已拥有'];
  const STATUS_CLASSES = ['status-unseen', 'status-seen', 'status-owned'];

  function loadCollection() {
    const saved = localStorage.getItem(COLLECTION_KEY);
    if (saved) try { return JSON.parse(saved); } catch (e) { /* fall through */ }
    return {};
  }
  function saveCollection() {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
  }
  function getStatus(uid) { return collection[uid] || 0; }
  function cycleStatus(uid) {
    collection[uid] = ((collection[uid] || 0) + 1) % 3;
    saveCollection();
  }

  let collection = loadCollection();

  // ── Helpers ──
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }

  function stageClass(stage) { return 'stage-' + stage; }

  function getSorted() {
    return Object.values(db.digimon).sort((a, b) => a.dexId - b.dexId);
  }

  function getFiltered() {
    let list = getSorted();
    if (currentFilter) list = list.filter(d => d.stage === currentFilter);
    if (currentStatusFilter === 'unseen') list = list.filter(d => getStatus(d.uid) === 0);
    else if (currentStatusFilter === 'seen_only') list = list.filter(d => getStatus(d.uid) === 1);
    else if (currentStatusFilter === 'owned') list = list.filter(d => getStatus(d.uid) === 2);
    else if (currentStatusFilter === 'seen+') list = list.filter(d => getStatus(d.uid) >= 1);
    return list;
  }

  function getNextUid() {
    const nums = Object.keys(db.digimon).map(k => parseInt(k.slice(1)));
    return 'd' + String(Math.max(0, ...nums) + 1).padStart(3, '0');
  }

  // ── Router ──
  function navigate() {
    const hash = location.hash || '#list';
    $$('.page').forEach(p => p.classList.add('hidden'));
    $$('.nav-link').forEach(l => l.classList.remove('active'));

    if (hash.startsWith('#detail/')) {
      $('#detailPage').classList.remove('hidden');
      renderDetail(hash.slice(8));
    } else if (hash === '#pathfinder') {
      $('#pathfinderPage').classList.remove('hidden');
      $('[data-page="pathfinder"]').classList.add('active');
    } else {
      $('#listPage').classList.remove('hidden');
      $('[data-page="list"]').classList.add('active');
      renderList();
    }
  }

  // ── List Page ──
  function renderStageFilter() {
    const container = $('#stageFilter');
    container.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.className = 'stage-btn' + (currentFilter === null ? ' active' : '');
    allBtn.textContent = t('全部');
    allBtn.style.background = currentFilter === null ? '#666' : '';
    allBtn.onclick = () => { currentFilter = null; renderStageFilter(); renderList(); };
    container.appendChild(allBtn);

    for (const stage of db.stages) {
      const btn = document.createElement('button');
      btn.className = 'stage-btn ' + stageClass(stage) + (currentFilter === stage ? ' active' : '');
      if (currentFilter !== stage) btn.style.background = '';
      btn.textContent = t(stage);
      btn.onclick = () => {
        currentFilter = currentFilter === stage ? null : stage;
        renderStageFilter();
        renderList();
      };
      container.appendChild(btn);
    }

    // Status filter buttons
    const statusFilters = [
      { key: null, label: '全部' },
      { key: 'unseen', label: '未见过' },
      { key: 'seen_only', label: '仅已见过' },
      { key: 'owned', label: '已拥有' },
      { key: 'seen+', label: '已见过+已拥有' },
    ];

    const sep = document.createElement('span');
    sep.className = 'filter-sep';
    sep.textContent = '|';
    container.appendChild(sep);

    for (const sf of statusFilters) {
      const btn = document.createElement('button');
      btn.className = 'status-filter-btn' + (currentStatusFilter === sf.key ? ' active' : '');
      btn.textContent = t(sf.label);
      btn.onclick = () => {
        currentStatusFilter = currentStatusFilter === sf.key ? null : sf.key;
        renderStageFilter();
        renderList();
      };
      container.appendChild(btn);
    }
  }

  function renderList() {
    // Collection stats
    const allDigimon = Object.values(db.digimon);
    const total = allDigimon.length;
    const seen = allDigimon.filter(d => getStatus(d.uid) >= 1).length;
    const owned = allDigimon.filter(d => getStatus(d.uid) >= 2).length;

    const statsEl = document.getElementById('collectionStats');
    if (statsEl) statsEl.remove();
    const statsHtml = `<span id="collectionStats" class="collection-stats">${t('总数')} <strong>${total}</strong> ｜ ${t('已见过')} <strong>${seen}</strong> ｜ ${t('已拥有')} <strong>${owned}</strong></span>`;
    $('#stageFilter').insertAdjacentHTML('beforeend', statsHtml);

    const container = $('#digimonList');
    const list = getFiltered();
    container.innerHTML = list.map(d => {
      const s = getStatus(d.uid);
      const icons = ['○', '◐', '●'];
      return `<div class="digimon-card" data-uid="${d.uid}">
        <div class="card-top-row"><span class="card-dex">No.${d.dexId}</span><span class="card-status-icon ${STATUS_CLASSES[s]}" data-uid="${d.uid}" title="${t(STATUS_LABELS[s])}">${icons[s]} ${t(STATUS_LABELS[s])}</span></div>
        <div class="card-name-cn">${t(d.nameCN)}</div>
        <div class="card-name-en">${d.nameEN}</div>
        <span class="card-stage ${stageClass(d.stage)}">${t(d.stage)}</span>
      </div>`;
    }).join('');

    container.querySelectorAll('.card-status-icon').forEach(icon => {
      icon.onclick = (e) => {
        e.stopPropagation();
        cycleStatus(icon.dataset.uid);
        renderList();
      };
    });

    container.querySelectorAll('.digimon-card').forEach(card => {
      card.onclick = () => location.hash = '#detail/' + card.dataset.uid;
    });

    $('#addDigimonBtn').classList.toggle('hidden', !editMode);
  }

  // ── Detail Page ──
  let currentDetailUid = null;

  function renderDetail(uid) {
    const d = db.digimon[uid];
    if (!d) { location.hash = '#list'; return; }
    currentDetailUid = uid;

    const container = $('#detailContent');
    const evoItems = (d.evolutions || []).map((eUid, idx, arr) => {
      const e = db.digimon[eUid];
      if (!e) return '';
      const moveButtons = editMode ? `<span class="evo-item-move">
        <button class="evo-move-btn" data-type="evo" data-idx="${idx}" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>&#9650;</button>
        <button class="evo-move-btn" data-type="evo" data-idx="${idx}" data-dir="1" ${idx === arr.length - 1 ? 'disabled' : ''}>&#9660;</button>
      </span>` : '';
      return `<div class="evo-item" data-uid="${eUid}">
        <div><div class="evo-item-name">${t(e.nameCN)}</div><div class="evo-item-stage">${t(e.stage)}</div></div>
        ${editMode ? `<span class="evo-item-actions">${moveButtons}<button class="evo-item-delete" data-type="evo" data-target="${eUid}">&times;</button></span>` : ''}
      </div>`;
    }).join('');

    const devoItems = (d.devolutions || []).map((dUid, idx, arr) => {
      const e = db.digimon[dUid];
      if (!e) return '';
      const moveButtons = editMode ? `<span class="evo-item-move">
        <button class="evo-move-btn" data-type="devo" data-idx="${idx}" data-dir="-1" ${idx === 0 ? 'disabled' : ''}>&#9650;</button>
        <button class="evo-move-btn" data-type="devo" data-idx="${idx}" data-dir="1" ${idx === arr.length - 1 ? 'disabled' : ''}>&#9660;</button>
      </span>` : '';
      return `<div class="evo-item" data-uid="${dUid}">
        <div><div class="evo-item-name">${t(e.nameCN)}</div><div class="evo-item-stage">${t(e.stage)}</div></div>
        ${editMode ? `<span class="evo-item-actions">${moveButtons}<button class="evo-item-delete" data-type="devo" data-target="${dUid}">&times;</button></span>` : ''}
      </div>`;
    }).join('');

    let dexHtml;
    if (editMode) {
      dexHtml = `<div class="detail-dex detail-dex-edit">
        No.<input type="number" id="dexInput" value="${d.dexId}" min="1">
        <button id="swapDexBtn">${t('交换')}</button>
      </div>`;
    } else {
      dexHtml = `<div class="detail-dex">No.${d.dexId}</div>`;
    }

    let nameHtml;
    if (editMode) {
      nameHtml = `<div class="detail-name-cn editable" data-field="nameCN">${d.nameCN}</div>
        <div class="detail-name-en editable" data-field="nameEN">${d.nameEN}</div>`;
    } else {
      nameHtml = `<div class="detail-name-cn">${t(d.nameCN)}</div>
        <div class="detail-name-en">${d.nameEN}</div>`;
    }

    let stageHtml;
    if (editMode) {
      const options = db.stages.map(s => `<option value="${s}" ${s === d.stage ? 'selected' : ''}>${t(s)}</option>`).join('');
      stageHtml = `<select class="stage-select" id="stageSelect">${options}</select>`;
    } else {
      stageHtml = `<span class="detail-stage ${stageClass(d.stage)}">${t(d.stage)}</span>`;
    }

    const st = getStatus(uid);
    const statusHtml = `<div class="detail-status-row"><button class="detail-status-btn ${STATUS_CLASSES[st]}" id="statusToggle">${t(STATUS_LABELS[st])}</button></div>`;

    container.innerHTML = `
      ${dexHtml}
      ${nameHtml}
      ${stageHtml}
      ${statusHtml}
      <div class="evo-section">
        <div class="evo-col devo">
          <h3>${t('退化')} (${(d.devolutions || []).filter(u => db.digimon[u]).length})</h3>
          ${devoItems || '<div class="evo-empty">' + t('无退化目标') + '</div>'}
          ${editMode ? '<button class="evo-add" data-type="devo">+ ' + t('添加退化') + '</button>' : ''}
        </div>
        <div class="evo-col evo">
          <h3>${t('进化')} (${(d.evolutions || []).filter(u => db.digimon[u]).length})</h3>
          ${evoItems || '<div class="evo-empty">' + t('无进化目标') + '</div>'}
          ${editMode ? '<button class="evo-add" data-type="evo">+ ' + t('添加进化') + '</button>' : ''}
        </div>
      </div>
    `;

    // Event: click evo items to navigate
    container.querySelectorAll('.evo-item').forEach(item => {
      item.onclick = (e) => {
        if (e.target.classList.contains('evo-item-delete') || e.target.classList.contains('evo-move-btn')) return;
        location.hash = '#detail/' + item.dataset.uid;
      };
    });

    // Event: delete evo/devo
    container.querySelectorAll('.evo-item-delete').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const target = btn.dataset.target;
        const arr = type === 'evo' ? d.evolutions : d.devolutions;
        const idx = arr.indexOf(target);
        if (idx !== -1) { arr.splice(idx, 1); saveDB(); renderDetail(uid); }
      };
    });

    // Event: move evo/devo up/down
    container.querySelectorAll('.evo-move-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const idx = parseInt(btn.dataset.idx);
        const dir = parseInt(btn.dataset.dir);
        const arr = type === 'evo' ? d.evolutions : d.devolutions;
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= arr.length) return;
        [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
        saveDB();
        renderDetail(uid);
      };
    });

    // Event: add evo/devo
    container.querySelectorAll('.evo-add').forEach(btn => {
      btn.onclick = () => showAddEvoModal(uid, btn.dataset.type);
    });

    // Event: swap dex
    if (editMode) {
      const swapBtn = $('#swapDexBtn');
      if (swapBtn) {
        swapBtn.onclick = () => {
          const newDex = parseInt($('#dexInput').value);
          if (isNaN(newDex) || newDex < 1) return;
          const other = Object.values(db.digimon).find(x => x.dexId === newDex && x.uid !== uid);
          if (other) {
            other.dexId = d.dexId;
            d.dexId = newDex;
          } else {
            d.dexId = newDex;
          }
          saveDB();
          renderDetail(uid);
        };
      }

      // Inline edit name fields
      container.querySelectorAll('.editable').forEach(el => {
        el.onclick = () => {
          if (el.querySelector('input')) return;
          const field = el.dataset.field;
          const val = d[field];
          el.innerHTML = `<input class="edit-input" type="text" value="${val}">`;
          const input = el.querySelector('input');
          input.focus();
          input.select();
          const finish = () => {
            const newVal = input.value.trim();
            if (newVal && newVal !== val) {
              d[field] = newVal;
              saveDB();
            }
            renderDetail(uid);
          };
          input.onblur = finish;
          input.onkeydown = (e) => { if (e.key === 'Enter') finish(); };
        };
      });

      // Stage select
      const sel = $('#stageSelect');
      if (sel) {
        sel.onchange = () => {
          d.stage = sel.value;
          saveDB();
          renderDetail(uid);
        };
      }
    }

    // Delete button visibility
    $('#deleteDigimonBtn').classList.toggle('hidden', !editMode);

    // Status toggle
    const statusBtn = $('#statusToggle');
    if (statusBtn) {
      statusBtn.onclick = () => {
        cycleStatus(uid);
        renderDetail(uid);
      };
    }
  }

  // ── Navigation (prev/next) ──
  function navPrevNext(dir) {
    if (!currentDetailUid) return;
    const list = getFiltered();
    const idx = list.findIndex(d => d.uid === currentDetailUid);
    if (idx === -1) return;
    const newIdx = (idx + dir + list.length) % list.length;
    location.hash = '#detail/' + list[newIdx].uid;
  }

  // Touch swipe support
  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
  document.addEventListener('touchend', (e) => {
    if ($('#detailPage').classList.contains('hidden')) return;
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 60) navPrevNext(diff > 0 ? -1 : 1);
  });

  // Keyboard nav
  document.addEventListener('keydown', (e) => {
    if ($('#detailPage').classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowLeft') navPrevNext(-1);
    if (e.key === 'ArrowRight') navPrevNext(1);
  });

  // ── Modal ──
  function showModal(title, bodyHtml) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHtml;
    $('#modal').classList.remove('hidden');
  }
  function hideModal() { $('#modal').classList.add('hidden'); }

  $('.modal-close').onclick = hideModal;
  $('#modal').onclick = (e) => { if (e.target === $('#modal')) hideModal(); };

  function showAddEvoModal(uid, type) {
    const d = db.digimon[uid];
    const existing = type === 'evo' ? d.evolutions : d.devolutions;
    showModal(type === 'evo' ? t('添加进化目标') : t('添加退化目标'),
      `<input type="text" id="modalSearch" placeholder="${t('搜索数码宝贝...')}">`
      + `<div id="modalList"></div>`);

    const search = $('#modalSearch');
    const list = $('#modalList');

    function render(query) {
      const q = query.toLowerCase();
      const qTw = fromInput(q);
      const matches = getSorted().filter(x =>
        x.uid !== uid &&
        !existing.includes(x.uid) &&
        (x.nameCN.toLowerCase().includes(qTw) || x.nameEN.toLowerCase().includes(q))
      ).slice(0, 50);
      list.innerHTML = matches.map(x =>
        `<div class="modal-list-item" data-uid="${x.uid}">${t(x.nameCN)} <small>${x.nameEN} - ${t(x.stage)}</small></div>`
      ).join('');
      list.querySelectorAll('.modal-list-item').forEach(item => {
        item.onclick = () => {
          existing.push(item.dataset.uid);
          saveDB();
          hideModal();
          renderDetail(uid);
        };
      });
    }

    search.oninput = () => render(search.value);
    render('');
    search.focus();
  }

  // ── Pathfinder Page ──
  function setupPathfinder() {
    let fromUid = null, toUid = null;

    function setupSearch(inputId, dropdownId, onSelect) {
      const input = $(inputId);
      const dropdown = $(dropdownId);

      input.onfocus = () => renderDropdown('');
      input.oninput = () => renderDropdown(input.value);
      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target))
          dropdown.classList.add('hidden');
      });

      function renderDropdown(query) {
        const q = query.toLowerCase();
        const qTw = fromInput(q);
        const matches = getSorted().filter(d =>
          d.nameCN.toLowerCase().includes(qTw) || d.nameEN.toLowerCase().includes(q)
        ).slice(0, 30);
        dropdown.innerHTML = matches.map(d =>
          `<div class="search-dropdown-item" data-uid="${d.uid}">${t(d.nameCN)} <small>${d.nameEN}</small></div>`
        ).join('');
        dropdown.classList.remove('hidden');
        dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
          item.onclick = () => {
            const uid = item.dataset.uid;
            const d = db.digimon[uid];
            input.value = t(d.nameCN);
            dropdown.classList.add('hidden');
            onSelect(uid);
          };
        });
      }
    }

    setupSearch('#pathFrom', '#pathFromDropdown', uid => { fromUid = uid; });
    setupSearch('#pathTo', '#pathToDropdown', uid => { toUid = uid; });

    // ── Waypoints ──
    const waypoints = [];
    let waypointCounter = 0;

    function renderWaypoints() {
      const container = $('#waypointList');
      container.innerHTML = waypoints.map((wp, i) => `
        <div class="waypoint-item">
          <div class="path-select">
            <label>${t("途经点")} ${i + 1}</label>
            <input type="text" id="waypoint${wp.id}" placeholder="${t("搜索数码宝贝...")}" autocomplete="off" value="${wp.uid ? t(db.digimon[wp.uid].nameCN) : ''}">
            <div id="waypointDropdown${wp.id}" class="search-dropdown hidden"></div>
          </div>
          <button class="waypoint-remove" data-idx="${i}">&times;</button>
        </div>
      `).join('');

      // Setup search for each waypoint
      waypoints.forEach((wp, i) => {
        setupSearch('#waypoint' + wp.id, '#waypointDropdown' + wp.id, uid => { wp.uid = uid; });
      });

      // Remove buttons
      container.querySelectorAll('.waypoint-remove').forEach(btn => {
        btn.onclick = () => {
          waypoints.splice(parseInt(btn.dataset.idx), 1);
          renderWaypoints();
        };
      });
    }

    $('#addWaypointBtn').onclick = () => {
      waypoints.push({ id: waypointCounter++, uid: null });
      renderWaypoints();
    };

    $('#findPathBtn').onclick = () => {
      const result = $('#pathResult');
      if (!fromUid || !toUid) {
        result.innerHTML = '<div class="path-none">' + t('请选择起点和终点') + '</div>';
        return;
      }

      const wpUids = waypoints.map(wp => wp.uid).filter(Boolean);
      const { ideal: idealPath, constrained: constrainedPath } = findPathWithWaypoints(db, fromUid, toUid, wpUids, collection);

      let html = '';

      // Check if ideal path is already achievable (all devo targets are seen/owned)
      let idealIsAchievable = false;
      if (idealPath) {
        idealIsAchievable = idealPath.every(step =>
          step.edge !== 'devo' || getStatus(step.uid) >= 1
        );
      }

      // Ideal path
      if (!idealPath) {
        html += '<div class="path-section"><h3>' + t('理想路线') + '</h3><div class="path-none">' + t('无法到达目标，没有可用的进化/退化路线') + '</div></div>';
      } else {
        html += `<div class="path-section"><h3>${t('理想路线')} (${idealPath.length - 1} ${t('步')})${idealIsAchievable ? ' ✓ ' + t('当前可行') : ''}</h3><div class="path-chain" id="idealChain"></div></div>`;
      }

      // Constrained path (only show if ideal is not already achievable)
      if (!idealIsAchievable) {
        if (!constrainedPath) {
          html += '<div class="path-section"><h3>' + t('当前可行路线') + '</h3><div class="path-none">' + t('无法到达目标（退化目标中有未见过的数码宝贝）') + '</div></div>';
        } else {
          html += `<div class="path-section"><h3>${t('当前可行路线')} (${constrainedPath.length - 1} ${t('步')})</h3><div class="path-chain" id="constrainedChain"></div></div>`;
        }
      }

      result.innerHTML = html;

      function renderChain(containerId, path) {
        const container = document.getElementById(containerId);
        if (!container || !path) return;
        path.forEach((step, i) => {
          if (i > 0) {
            const edge = document.createElement('span');
            edge.className = 'path-edge ' + step.edge;
            edge.textContent = step.edge === 'evo' ? '→ ' + t('进化') + ' →' : '→ ' + t('退化') + ' →';
            container.appendChild(edge);
          }
          const d = db.digimon[step.uid];
          const node = document.createElement('div');
          node.className = 'path-node';
          const st = getStatus(step.uid);
          node.innerHTML = `<div class="path-node-name">${t(d.nameCN)}</div><div class="path-node-stage">${t(d.stage)}</div>${st > 0 ? `<div class="path-node-status ${STATUS_CLASSES[st]}">${t(STATUS_LABELS[st])}</div>` : ''}`;
          node.onclick = () => { location.hash = '#detail/' + step.uid; };
          container.appendChild(node);
        });
      }

      renderChain('idealChain', idealPath);
      if (!idealIsAchievable) renderChain('constrainedChain', constrainedPath);
    };

    // ── Collection Route ──
    let collectStartUid = null;
    setupSearch('#collectStart', '#collectStartDropdown', uid => { collectStartUid = uid; });

    $('#collectBtn').onclick = () => {
      const result = $('#collectResult');
      const allOwned = Object.values(db.digimon).every(d => getStatus(d.uid) >= 2);
      if (allOwned) {
        result.innerHTML = '<div class="path-none">' + t('已拥有全部数码宝贝！') + '</div>';
        return;
      }

      const hasAnyOwned = Object.values(db.digimon).some(d => getStatus(d.uid) >= 2);
      if (!hasAnyOwned) {
        result.innerHTML = '<div class="path-none">' + t('请先至少标记一个数码宝贝为"已拥有"作为起点') + '</div>';
        return;
      }

      result.innerHTML = '<div class="path-none">' + t('计算中...') + '</div>';
      setTimeout(() => {
        const route = findCollectionRoute(db, collection, collectStartUid);
        let html = '';

        if (route.chains.length === 0 && route.unreachable.length === 0) {
          html = '<div class="path-none">' + t('已拥有全部数码宝贝！') + '</div>';
        } else {
          const totalNew = route.chains.reduce((sum, c) => sum + c.length - 1, 0);
          html += `<div class="collect-summary">${t('共')} ${route.chains.length} ${t('条路线，覆盖')} ${totalNew} ${t('步')}</div>`;

          route.chains.forEach((chain, idx) => {
            html += `<div class="collect-chain-section"><h4>${t('路线')} ${idx + 1}（${chain.length - 1} ${t('步')}）· ${t('起点')}：${t(db.digimon[chain[0].uid].nameCN)}</h4><div class="path-chain" id="collectChain${idx}"></div></div>`;
          });

          if (route.unreachable.length > 0) {
            html += `<div class="collect-unreachable"><h4>${t('无法到达')} (${route.unreachable.length})</h4><div class="collect-unreachable-list">`;
            for (const uid of route.unreachable) {
              const d = db.digimon[uid];
              if (d) html += `<span class="collect-unreachable-item" data-uid="${uid}">${t(d.nameCN)} <small>${t(d.stage)}</small></span>`;
            }
            html += '</div></div>';
          }
        }

        result.innerHTML = html;

        // Render chains
        route.chains.forEach((chain, idx) => {
          const container = document.getElementById('collectChain' + idx);
          if (!container) return;
          chain.forEach((step, i) => {
            if (i > 0) {
              const edge = document.createElement('span');
              edge.className = 'path-edge ' + step.edge;
              edge.textContent = step.edge === 'evo' ? '→ ' + t('进化') + ' →' : '→ ' + t('退化') + ' →';
              container.appendChild(edge);
            }
            const d = db.digimon[step.uid];
            const node = document.createElement('div');
            node.className = 'path-node' + (i === 0 ? ' path-node-start' : '');
            node.innerHTML = `<div class="path-node-name">${t(d.nameCN)}</div><div class="path-node-stage">${t(d.stage)}</div>`;
            node.onclick = () => { location.hash = '#detail/' + step.uid; };
            container.appendChild(node);
          });
        });

        // Click unreachable items
        result.querySelectorAll('.collect-unreachable-item').forEach(item => {
          item.onclick = () => { location.hash = '#detail/' + item.dataset.uid; };
        });
      }, 10);
    };
  }

  // ── Data Menu ──
  $('#dataMenuBtn').onclick = (e) => {
    e.stopPropagation();
    $('#dataMenu').classList.toggle('hidden');
  };
  document.addEventListener('click', () => $('#dataMenu').classList.add('hidden'));

  $('#exportBtn').onclick = () => {
    const exportData = { ...db, collection: collection };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'digimon_data.json';
    a.click();
  };

  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (imported.digimon && imported.stages) {
          if (imported.collection) {
            collection = imported.collection;
            saveCollection();
            delete imported.collection;
          }
          db = imported;
          saveDB();
          navigate();
          alert(t('导入成功'));
        } else {
          alert(t('无效的数据格式'));
        }
      } catch (err) { alert(t('JSON解析失败: ') + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  $('#saveDefaultBtn').onclick = () => {
    if (!confirm(t('将当前数据保存为默认数据？\n（将下载 data.js 文件，请手动替换项目中的 data.js）'))) return;
    const content = 'const DEFAULT_DIGIMON_DB = ' + JSON.stringify(db, null, 2) + ';\n';
    const blob = new Blob([content], { type: 'application/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'data.js';
    a.click();
  };

  $('#resetDefaultBtn').onclick = () => {
    if (!confirm(t('重置为默认数据？所有修改将丢失。'))) return;
    db = JSON.parse(JSON.stringify(DEFAULT_DIGIMON_DB));
    saveDB();
    navigate();
  };

  $('#resetBackupBtn').onclick = () => {
    if (!confirm(t('重置为出厂数据？所有修改将丢失。'))) return;
    db = JSON.parse(JSON.stringify(BACKUP_DIGIMON_DB));
    saveDB();
    navigate();
  };

  // ── Edit Mode Toggle ──
  $('#editModeToggle').onchange = (e) => {
    editMode = e.target.checked;
    $('#addDigimonBtn').classList.toggle('hidden', !editMode);
    navigate();
  };

  // ── Add/Delete Digimon ──
  $('#addDigimonBtn').onclick = () => {
    const uid = getNextUid();
    const maxDex = Math.max(0, ...Object.values(db.digimon).map(d => d.dexId));
    db.digimon[uid] = {
      uid,
      dexId: maxDex + 1,
      nameCN: '新數碼寶貝',
      nameEN: 'NewDigimon',
      stage: '成長期',
      evolutions: [],
      devolutions: []
    };
    saveDB();
    location.hash = '#detail/' + uid;
  };

  $('#deleteDigimonBtn').onclick = () => {
    if (!currentDetailUid) return;
    const d = db.digimon[currentDetailUid];
    if (!confirm(t(`确认删除 ${d.nameCN}？相关进化/退化引用也会被清除。`))) return;
    // Remove references from other digimon
    for (const other of Object.values(db.digimon)) {
      other.evolutions = (other.evolutions || []).filter(u => u !== currentDetailUid);
      other.devolutions = (other.devolutions || []).filter(u => u !== currentDetailUid);
    }
    delete db.digimon[currentDetailUid];
    saveDB();
    location.hash = '#list';
  };

  // ── Back/Nav Buttons ──
  $('#backBtn').onclick = () => { location.hash = '#list'; };
  $('#prevBtn').onclick = () => navPrevNext(-1);
  $('#nextBtn').onclick = () => navPrevNext(1);

  // ── Init ──
  initConverter();
  $('#langToggle').onclick = toggleLang;
  updateStaticText();
  renderStageFilter();
  setupPathfinder();
  window.addEventListener('hashchange', navigate);
  navigate();
})();
