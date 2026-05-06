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
      const blLabel = pfPage.querySelector('.blacklist-label');
      if (blLabel) blLabel.textContent = t('进化黑名单');
      const blHint = pfPage.querySelector('.blacklist-hint');
      if (blHint) blHint.textContent = '（' + t('路线将避免进化到这些角色，但可以退化') + '）';
      const blInput = document.getElementById('blacklistInput');
      if (blInput) blInput.placeholder = t('搜索数码宝贝...');
      const blBtn = document.getElementById('addBlacklistBtn');
      if (blBtn) blBtn.textContent = '+ ' + t('添加');
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
    if (window._refreshPathTabs) window._refreshPathTabs();
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
  const PATH_TABS_KEY = 'digimonPathTabs';
  const PATH_PRESETS_KEY = 'digimonPathPresets';
  const BLACKLIST_KEY = 'digimonEvoBlacklist';

  function loadBlacklist() {
    try {
      const saved = JSON.parse(localStorage.getItem(BLACKLIST_KEY));
      if (Array.isArray(saved)) return saved;
    } catch (e) { /* fall through */ }
    return [];
  }
  function saveBlacklist(list) {
    localStorage.setItem(BLACKLIST_KEY, JSON.stringify(list));
  }

  function newTab(name) {
    return { name: name || (t('标签') + ' 1'), fromUid: null, toUid: null, waypoints: [], comments: {}, resultHtml: null };
  }

  function loadPathTabs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PATH_TABS_KEY));
      if (saved && saved.tabs && saved.tabs.length > 0) return saved;
    } catch (e) { /* fall through */ }
    return { activeTab: 0, tabs: [newTab()] };
  }

  function savePathTabs(data) {
    localStorage.setItem(PATH_TABS_KEY, JSON.stringify(data));
  }

  function loadPathPresets() {
    try {
      const saved = JSON.parse(localStorage.getItem(PATH_PRESETS_KEY));
      if (Array.isArray(saved)) return saved;
    } catch (e) { /* fall through */ }
    return [];
  }

  function savePathPresets(presets) {
    localStorage.setItem(PATH_PRESETS_KEY, JSON.stringify(presets));
  }

  function setupPathfinder() {
    let tabData = loadPathTabs();
    let presets = loadPathPresets();
    let blacklist = loadBlacklist();
    let waypointCounter = 0;

    // Current tab accessors
    function cur() { return tabData.tabs[tabData.activeTab]; }

    function setupSearch(inputId, dropdownId, onSelect) {
      const input = $(inputId);
      const dropdown = $(dropdownId);
      if (!input || !dropdown) return;

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

    // ── Tab Bar ──
    function renderTabBar() {
      const bar = $('#pathTabBar');
      let html = '';

      tabData.tabs.forEach((tab, i) => {
        const active = i === tabData.activeTab ? ' active' : '';
        const closeBtn = tabData.tabs.length > 1
          ? `<button class="path-tab-close" data-idx="${i}">&times;</button>` : '';
        html += `<div class="path-tab${active}" data-idx="${i}">
          <span class="path-tab-name" data-idx="${i}">${tab.name}</span>${closeBtn}
        </div>`;
      });

      if (tabData.tabs.length < 10) {
        html += `<button class="path-tab-add" id="tabAddBtn">+</button>`;
      }

      html += `<div class="path-tab-actions">
        <button class="path-tab-action" id="tabSaveBtn">${t('保存')}</button>
        <button class="path-tab-action" id="tabLoadBtn" style="position:relative">${t('加载')}<div id="presetDropdown" class="preset-dropdown hidden"></div></button>
      </div>`;

      bar.innerHTML = html;

      // Tab click to switch
      bar.querySelectorAll('.path-tab').forEach(el => {
        el.onclick = (e) => {
          if (e.target.classList.contains('path-tab-close')) return;
          const idx = parseInt(el.dataset.idx);
          if (idx !== tabData.activeTab) switchTab(idx);
        };
      });

      // Tab double-click to rename
      bar.querySelectorAll('.path-tab-name').forEach(el => {
        el.ondblclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(el.dataset.idx);
          const tab = tabData.tabs[idx];
          const input = document.createElement('input');
          input.className = 'path-tab-rename-input';
          input.value = tab.name;
          el.textContent = '';
          el.appendChild(input);
          input.focus();
          input.select();
          const finish = () => {
            const val = input.value.trim();
            if (val) tab.name = val;
            savePathTabs(tabData);
            renderTabBar();
          };
          input.onblur = finish;
          input.onkeydown = (ev) => { if (ev.key === 'Enter') finish(); };
        };
      });

      // Close tab
      bar.querySelectorAll('.path-tab-close').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx);
          tabData.tabs.splice(idx, 1);
          if (tabData.activeTab >= tabData.tabs.length) tabData.activeTab = tabData.tabs.length - 1;
          else if (tabData.activeTab > idx) tabData.activeTab--;
          savePathTabs(tabData);
          renderTabBar();
          restoreForm();
        };
      });

      // Add tab
      const addBtn = document.getElementById('tabAddBtn');
      if (addBtn) {
        addBtn.onclick = () => {
          saveCurrentTab();
          const n = tabData.tabs.length + 1;
          tabData.tabs.push(newTab(t('标签') + ' ' + n));
          tabData.activeTab = tabData.tabs.length - 1;
          savePathTabs(tabData);
          renderTabBar();
          restoreForm();
        };
      }

      // Save preset
      const saveBtn = document.getElementById('tabSaveBtn');
      if (saveBtn) {
        saveBtn.onclick = () => {
          saveCurrentTab();
          const name = prompt(t('请输入标签名称：'), cur().name);
          if (!name) return;
          if (presets.length >= 10) {
            alert(t('最多保存 10 个标签'));
            return;
          }
          const c = cur();
          presets.push({ name, fromUid: c.fromUid, toUid: c.toUid, waypoints: [...c.waypoints], comments: { ...(c.comments || {}) } });
          savePathPresets(presets);
          alert(t('已保存'));
        };
      }

      // Load preset
      const loadBtn = document.getElementById('tabLoadBtn');
      const dropdown = document.getElementById('presetDropdown');
      if (loadBtn && dropdown) {
        loadBtn.onclick = (e) => {
          e.stopPropagation();
          if (presets.length === 0) {
            dropdown.innerHTML = '<div class="preset-empty">' + t('暂无保存的标签') + '</div>';
          } else {
            dropdown.innerHTML = presets.map((p, i) =>
              `<div class="preset-item" data-idx="${i}">
                <span>${p.name}</span>
                <button class="preset-item-delete" data-idx="${i}">&times;</button>
              </div>`
            ).join('');
          }
          dropdown.classList.toggle('hidden');

          dropdown.querySelectorAll('.preset-item').forEach(item => {
            item.onclick = (e) => {
              if (e.target.classList.contains('preset-item-delete')) return;
              const p = presets[parseInt(item.dataset.idx)];
              const c = cur();
              c.name = p.name;
              c.fromUid = p.fromUid;
              c.toUid = p.toUid;
              c.waypoints = [...p.waypoints];
              c.comments = { ...(p.comments || {}) };
              c.resultHtml = null;
              savePathTabs(tabData);
              dropdown.classList.add('hidden');
              renderTabBar();
              restoreForm();
            };
          });

          dropdown.querySelectorAll('.preset-item-delete').forEach(btn => {
            btn.onclick = (e) => {
              e.stopPropagation();
              presets.splice(parseInt(btn.dataset.idx), 1);
              savePathPresets(presets);
              dropdown.classList.add('hidden');
            };
          });
        };

        document.addEventListener('click', (e) => {
          if (!loadBtn.contains(e.target)) dropdown.classList.add('hidden');
        });
      }
    }

    // ── Save current form state to tab data ──
    function saveCurrentTab() {
      const c = cur();
      c.resultHtml = $('#pathResult').innerHTML || null;
      savePathTabs(tabData);
    }

    // ── Switch to tab ──
    function switchTab(idx) {
      saveCurrentTab();
      tabData.activeTab = idx;
      savePathTabs(tabData);
      renderTabBar();
      restoreForm();
    }

    // ── Restore form from tab data ──
    function restoreForm() {
      const c = cur();
      waypointCounter = 0;

      // Restore from/to inputs
      const fromInput = $('#pathFrom');
      const toInput = $('#pathTo');
      if (c.fromUid && db.digimon[c.fromUid]) {
        fromInput.value = t(db.digimon[c.fromUid].nameCN);
      } else {
        fromInput.value = '';
        c.fromUid = null;
      }
      if (c.toUid && db.digimon[c.toUid]) {
        toInput.value = t(db.digimon[c.toUid].nameCN);
      } else {
        toInput.value = '';
        c.toUid = null;
      }

      // Restore waypoints
      renderWaypointsFromData();

      // Restore result
      const resultEl = $('#pathResult');
      if (c.resultHtml) {
        resultEl.innerHTML = c.resultHtml;
        if (!c.comments) c.comments = {};
        // Re-attach click and contextmenu handlers on path nodes
        resultEl.querySelectorAll('.path-node').forEach(node => {
          const uid = node.dataset.uid;
          if (uid) {
            node.onclick = () => { location.hash = '#detail/' + uid; };
            node.oncontextmenu = (e) => {
              e.preventDefault();
              const d = db.digimon[uid];
              if (!d) return;
              const existing = c.comments[uid] || '';
              const input = prompt(t('备注') + ' - ' + t(d.nameCN), existing);
              if (input === null) return;
              if (input.trim()) {
                c.comments[uid] = input.trim();
              } else {
                delete c.comments[uid];
              }
              savePathTabs(tabData);
              const commentEl = node.querySelector('.path-node-comment');
              if (c.comments[uid]) {
                if (commentEl) {
                  commentEl.textContent = c.comments[uid];
                } else {
                  const newComment = document.createElement('div');
                  newComment.className = 'path-node-comment';
                  newComment.textContent = c.comments[uid];
                  node.appendChild(newComment);
                }
              } else if (commentEl) {
                commentEl.remove();
              }
              c.resultHtml = resultEl.innerHTML;
              savePathTabs(tabData);
              renderWaypointsFromData();
            };
          }
        });
      } else {
        resultEl.innerHTML = '';
      }
    }

    // ── Waypoints ──
    function renderWaypointsFromData() {
      const c = cur();
      if (!c.comments) c.comments = {};
      const container = $('#waypointList');
      waypointCounter = c.waypoints.length;
      container.innerHTML = c.waypoints.map((wpUid, i) => {
        const d = wpUid ? db.digimon[wpUid] : null;
        const comment = (wpUid && c.comments[wpUid]) || '';
        return `
        <div class="waypoint-item">
          <div class="path-select">
            <label>${t("途经点")} ${i + 1}</label>
            <input type="text" id="waypoint${i}" placeholder="${t("搜索数码宝贝...")}" autocomplete="off" value="${d ? t(d.nameCN) : ''}">
            <div id="waypointDropdown${i}" class="search-dropdown hidden"></div>
          </div>
          <input type="text" class="waypoint-comment" data-idx="${i}" placeholder="${t("备注...")}" value="${comment.replace(/"/g, '&quot;')}">
          <button class="waypoint-remove" data-idx="${i}">&times;</button>
        </div>`;
      }).join('');

      // Setup search for each waypoint
      c.waypoints.forEach((wpUid, i) => {
        setupSearch('#waypoint' + i, '#waypointDropdown' + i, uid => {
          cur().waypoints[i] = uid;
          savePathTabs(tabData);
        });
      });

      // Remove buttons
      container.querySelectorAll('.waypoint-remove').forEach(btn => {
        btn.onclick = () => {
          const idx = parseInt(btn.dataset.idx);
          const removedUid = cur().waypoints[idx];
          cur().waypoints.splice(idx, 1);
          if (removedUid && cur().comments[removedUid]) delete cur().comments[removedUid];
          savePathTabs(tabData);
          renderWaypointsFromData();
        };
      });

      // Comment inputs
      container.querySelectorAll('.waypoint-comment').forEach(input => {
        input.oninput = () => {
          const idx = parseInt(input.dataset.idx);
          const uid = cur().waypoints[idx];
          if (!uid) return;
          if (!cur().comments) cur().comments = {};
          if (input.value.trim()) {
            cur().comments[uid] = input.value.trim();
          } else {
            delete cur().comments[uid];
          }
          savePathTabs(tabData);
        };
      });
    }

    // Setup from/to search (these DOM elements are static, so only bind once)
    setupSearch('#pathFrom', '#pathFromDropdown', uid => {
      cur().fromUid = uid;
      savePathTabs(tabData);
    });
    setupSearch('#pathTo', '#pathToDropdown', uid => {
      cur().toUid = uid;
      savePathTabs(tabData);
    });

    $('#addWaypointBtn').onclick = () => {
      cur().waypoints.push(null);
      savePathTabs(tabData);
      renderWaypointsFromData();
    };

    // ── Blacklist UI ──
    let pendingBlacklistUid = null;

    function renderBlacklist() {
      const container = $('#blacklistList');
      if (!container) return;
      container.innerHTML = blacklist.map(uid => {
        const d = db.digimon[uid];
        if (!d) return '';
        return `<span class="blacklist-tag" data-uid="${uid}">${t(d.nameCN)}<button data-uid="${uid}">&times;</button></span>`;
      }).join('');
      container.querySelectorAll('.blacklist-tag button').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          blacklist = blacklist.filter(u => u !== btn.dataset.uid);
          saveBlacklist(blacklist);
          renderBlacklist();
        };
      });
    }

    setupSearch('#blacklistInput', '#blacklistDropdown', uid => {
      pendingBlacklistUid = uid;
      if (!blacklist.includes(uid)) {
        blacklist.push(uid);
        saveBlacklist(blacklist);
        renderBlacklist();
      }
      $('#blacklistInput').value = '';
      pendingBlacklistUid = null;
    });

    $('#addBlacklistBtn').onclick = () => {
      if (pendingBlacklistUid && !blacklist.includes(pendingBlacklistUid)) {
        blacklist.push(pendingBlacklistUid);
        saveBlacklist(blacklist);
        renderBlacklist();
        $('#blacklistInput').value = '';
        pendingBlacklistUid = null;
      }
    };

    renderBlacklist();

    $('#findPathBtn').onclick = () => {
      const c = cur();
      const result = $('#pathResult');
      if (!c.fromUid || !c.toUid) {
        result.innerHTML = '<div class="path-none">' + t('请选择起点和终点') + '</div>';
        return;
      }

      const wpUids = c.waypoints.filter(Boolean);
      const blacklistSet = new Set(blacklist);

      // Try with blacklist first
      let { ideal: idealPath, constrained: constrainedPath } = findPathWithWaypoints(db, c.fromUid, c.toUid, wpUids, collection, blacklistSet);

      // Check if blacklist filtering removed all results — fallback to unfiltered
      let blacklistFallback = false;
      if (!idealPath && blacklist.length > 0) {
        const unfiltered = findPathWithWaypoints(db, c.fromUid, c.toUid, wpUids, collection, null);
        if (unfiltered.ideal || unfiltered.constrained) {
          blacklistFallback = true;
          idealPath = unfiltered.ideal;
          constrainedPath = unfiltered.constrained;
        }
      }

      let html = '';

      if (blacklistFallback) {
        const names = blacklist.map(uid => db.digimon[uid] ? t(db.digimon[uid].nameCN) : uid).join('、');
        html += `<div class="path-blacklist-warning">${t('无法避开进化黑名单中的角色')}（${names}），${t('以下为未过滤的结果')}</div>`;
      }

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

      function renderChain(containerId, path, waypointSet) {
        const container = document.getElementById(containerId);
        if (!container || !path) return;
        const c = cur();
        if (!c.comments) c.comments = {};
        path.forEach((step, i) => {
          if (i > 0) {
            const edge = document.createElement('span');
            edge.className = 'path-edge ' + step.edge;
            edge.textContent = step.edge === 'evo' ? '→ ' + t('进化') + ' →' : '→ ' + t('退化') + ' →';
            container.appendChild(edge);
          }
          const d = db.digimon[step.uid];
          const node = document.createElement('div');
          node.className = 'path-node' + (waypointSet && waypointSet.has(step.uid) ? ' path-node-waypoint' : '');
          node.dataset.uid = step.uid;
          const st = getStatus(step.uid);
          const comment = c.comments[step.uid] || '';
          node.innerHTML = `<div class="path-node-name">${t(d.nameCN)}</div><div class="path-node-stage">${t(d.stage)}</div>${st > 0 ? `<div class="path-node-status ${STATUS_CLASSES[st]}">${t(STATUS_LABELS[st])}</div>` : ''}${comment ? `<div class="path-node-comment">${comment}</div>` : ''}`;
          node.onclick = () => { location.hash = '#detail/' + step.uid; };
          node.oncontextmenu = (e) => {
            e.preventDefault();
            const existing = c.comments[step.uid] || '';
            const input = prompt(t('备注') + ' - ' + t(d.nameCN), existing);
            if (input === null) return;
            if (input.trim()) {
              c.comments[step.uid] = input.trim();
            } else {
              delete c.comments[step.uid];
            }
            savePathTabs(tabData);
            // Update the comment display on this node
            const commentEl = node.querySelector('.path-node-comment');
            if (c.comments[step.uid]) {
              if (commentEl) {
                commentEl.textContent = c.comments[step.uid];
              } else {
                const newComment = document.createElement('div');
                newComment.className = 'path-node-comment';
                newComment.textContent = c.comments[step.uid];
                node.appendChild(newComment);
              }
            } else if (commentEl) {
              commentEl.remove();
            }
            // Update cached html
            c.resultHtml = $('#pathResult').innerHTML;
            savePathTabs(tabData);
            // Also update waypoint form if this uid is a waypoint
            renderWaypointsFromData();
          };
          container.appendChild(node);
        });
      }

      const wpSet = new Set(wpUids);
      renderChain('idealChain', idealPath, wpSet);
      if (!idealIsAchievable) renderChain('constrainedChain', constrainedPath, wpSet);

      // Cache result
      c.resultHtml = result.innerHTML;
      savePathTabs(tabData);
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

    // ── Initial render ──
    renderTabBar();
    restoreForm();

    // Expose refresh for language toggle
    window._refreshPathTabs = () => { renderTabBar(); restoreForm(); renderBlacklist(); };
  }

  // ── Data Menu ──
  $('#dataMenuBtn').onclick = (e) => {
    e.stopPropagation();
    $('#dataMenu').classList.toggle('hidden');
  };
  document.addEventListener('click', () => $('#dataMenu').classList.add('hidden'));

  $('#exportBtn').onclick = () => {
    const exportData = { ...db, collection: collection };
    // Include path tabs and presets
    try {
      const savedTabs = JSON.parse(localStorage.getItem(PATH_TABS_KEY));
      if (savedTabs) exportData.pathTabs = savedTabs;
    } catch (e) { /* skip */ }
    try {
      const savedPresets = JSON.parse(localStorage.getItem(PATH_PRESETS_KEY));
      if (savedPresets) exportData.pathPresets = savedPresets;
    } catch (e) { /* skip */ }
    try {
      const savedBlacklist = JSON.parse(localStorage.getItem(BLACKLIST_KEY));
      if (savedBlacklist) exportData.evoBlacklist = savedBlacklist;
    } catch (e) { /* skip */ }
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
          if (imported.pathTabs) {
            localStorage.setItem(PATH_TABS_KEY, JSON.stringify(imported.pathTabs));
            delete imported.pathTabs;
          }
          if (imported.pathPresets) {
            localStorage.setItem(PATH_PRESETS_KEY, JSON.stringify(imported.pathPresets));
            delete imported.pathPresets;
          }
          if (imported.evoBlacklist) {
            localStorage.setItem(BLACKLIST_KEY, JSON.stringify(imported.evoBlacklist));
            delete imported.evoBlacklist;
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
