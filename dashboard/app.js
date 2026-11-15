// Token Radar dashboard: no framework, no network. All data comes from window.RADAR
// (data.js, written by main.ts from the same board as board.json), so the page and the
// board can never disagree. Deep links: #detail=<slug> opens a protocol, #filter=category:X,
// #filter=watchlist and #filter=search:<text> pre-apply a filter.
(function () {
  'use strict';
  var D = window.RADAR;
  var rows = D.rows;
  var watch = {};
  D.watchlist.forEach(function (s) { watch[s] = true; });
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  var state = { q: '', cat: '', chain: '', urg: '', sort: 'implied', watchOnly: false, limit: 50 };
  var PAGE = 50;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pct(v) {
    if (v == null) return '<span class="muted">—</span>';
    var cls = v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted';
    return '<span class="' + cls + '">' + (v > 0 ? '+' : '') + v.toFixed(1) + '%</span>';
  }
  function age(v) {
    if (v == null) return '<span class="muted">—</span>';
    if (v < 30) return v + 'd';
    if (v < 365) return Math.round(v / 30) + 'mo';
    return (v / 365).toFixed(1) + 'y';
  }
  function urgBadge(u) {
    if (u === 'Farm now') return '<span class="badge b-now">Farm now</span>';
    if (u === 'Farm steadily') return '<span class="badge b-steady">Farm steadily</span>';
    return '<span class="badge b-early">Early</span>';
  }
  function ignCell(r) {
    return '<span class="ign"><i><b style="width:' + r.ignition_score + '%"></b></i>' + r.ignition_score + '</span>';
  }

  // ---- header ----
  var top = rows[0];
  $('heroTop').textContent = top ? top.name + ' — ' + money(top.implied_value_usd) : '—';
  var totalTvl = rows.reduce(function (a, r) { return a + r.tvl_usd; }, 0);
  $('stats').innerHTML =
    '<div><dt>Protocols tracked</dt><dd>' + D.board_size + ' pre-token</dd></div>' +
    '<div><dt>Watchlist covered</dt><dd>' + D.watchlist_size + ' / ' + D.watchlist_size + '</dd></div>' +
    '<div><dt>Board TVL</dt><dd>' + money(totalTvl) + '</dd></div>' +
    '<div><dt>Top implied value</dt><dd>' + money(top ? top.implied_value_usd : 0) + '</dd></div>';
  $('asof').textContent = 'Snapshot: DefiLlama protocols as of ' + D.as_of + ' · watchlist floor ' +
    money(D.floor_usd) + ' TVL · model ' + D.model_version + ' · ' + D.source;

  // ---- filter options ----
  var cats = {}, chains = {};
  rows.forEach(function (r) {
    if (r.category) cats[r.category] = true;
    r.chains.forEach(function (c) { chains[c] = true; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    $('fCat').insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>');
  });
  Object.keys(chains).sort().forEach(function (c) {
    $('fChain').insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>');
  });

  // ---- board ----
  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.watchOnly && !watch[r.slug]) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (state.urg && r.urgency !== state.urg) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      return true;
    });
    var by = {
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      ignition: function (a, b) { return b.ignition_score - a.ignition_score || b.implied_value_usd - a.implied_value_usd; },
      velocity: function (a, b) { return b.velocity_usd_per_day - a.velocity_usd_per_day; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d == null ? -999 : b.change_7d) - (a.change_7d == null ? -999 : a.change_7d); },
      age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); },
    }[state.sort];
    return list.sort(by);
  }

  function renderBoard() {
    var list = filtered();
    var shown = list.slice(0, state.limit);
    $('count').textContent = 'Showing ' + shown.length + ' of ' + list.length + ' protocols' +
      (list.length !== rows.length ? ' (filtered from ' + rows.length + ')' : '') +
      ' · ranked by implied launch value';
    $('rows').innerHTML = shown.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td>' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' +
        '<span class="sub">' + esc(r.category || 'Uncategorized') + ' · ' + esc(r.chains.slice(0, 3).join(', ')) + '</span></td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td>' + ignCell(r) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b></td>' +
        '<td>' + urgBadge(r.urgency) + '</td></tr>';
    }).join('');
    $('more').style.display = list.length > state.limit ? '' : 'none';
  }

  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.getAttribute('data-slug'));
  });
  $('more').addEventListener('click', function () { state.limit += PAGE; renderBoard(); });
  $('q').addEventListener('input', function () { state.q = this.value; state.limit = PAGE; renderBoard(); });
  $('fCat').addEventListener('change', function () { state.cat = this.value; state.limit = PAGE; renderBoard(); });
  $('fChain').addEventListener('change', function () { state.chain = this.value; state.limit = PAGE; renderBoard(); });
  $('fUrg').addEventListener('change', function () { state.urg = this.value; state.limit = PAGE; renderBoard(); });
  $('fSort').addEventListener('change', function () { state.sort = this.value; state.limit = PAGE; renderBoard(); });
  $('fWatch').addEventListener('change', function () { state.watchOnly = this.checked; state.limit = PAGE; renderBoard(); });

  // ---- detail drawer ----
  function factorBars(r) {
    var m = D.model;
    var sector = Math.min(1, r.sector_multiple / Math.max(D.sector_max, 0.01));
    var growthPct = r.change_7d == null ? 0 : Math.min(m.growth_cap, Math.max(m.growth_floor, r.change_7d));
    var momentum = Math.min(1, Math.max(0, (growthPct - m.momentum_lo) / (m.momentum_hi - m.momentum_lo)));
    var maturity = Math.min(1, (r.age_days == null ? m.unknown_age_days : r.age_days) / m.maturity_days);
    var breadth = Math.min(1, r.chains.length / (m.breadth_max_extra + 1));
    function bar(label, v) {
      return '<div class="bar-row"><span>' + label + '</span><span class="bar"><b style="width:' + Math.round(v * 100) + '%"></b></span><span>' + Math.round(v * 100) + '</span></div>';
    }
    return bar('Sector', sector) + bar('Momentum', momentum) + bar('Maturity', maturity) + bar('Breadth', breadth);
  }

  function openDetail(slug) {
    var r = bySlug[slug];
    if (!r) return;
    var m = D.model;
    var growthPct = r.change_7d == null ? 0 : Math.min(m.growth_cap, Math.max(m.growth_floor, r.change_7d));
    var growthMult = 1 + (growthPct / 100) * m.growth_weight;
    var ageFor = r.age_days == null ? m.unknown_age_days : r.age_days;
    var maturityMult = m.maturity_floor + (Math.min(ageFor, m.maturity_days) / m.maturity_days) * m.maturity_range;
    var breadthMult = 1 + Math.min(Math.max(r.chains.length - 1, 0), m.breadth_max_extra) * m.breadth_per_chain;
    var steps = (r.farm_steps || []).map(function (s) {
      var parts = s.split(' Cost: ');
      var head = parts[0] || s;
      var rest = parts[1] ? parts[1].split(' Time: ') : [];
      var cost = rest[0] || '';
      var time = rest[1] ? rest[1].replace(/\.$/, '') : '';
      return '<li><p>' + esc(head) + '</p><small>Cost: ' + esc(cost) + ' · Time: ' + esc(time) + '</small></li>';
    }).join('');
    $('detail').innerHTML =
      '<div class="detail">' +
      '<p class="eyebrow">RANK #' + r.rank + ' · ' + esc(r.urgency.toUpperCase()) + '</p>' +
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="cat">' + esc(r.category || 'Uncategorized') + ' · ' + esc(r.chains.join(', ')) + '</p>' +
      '<dl class="kv">' +
      '<div><dt>Implied value</dt><dd>' + moneyFull(r.implied_value_usd) + '</dd></div>' +
      '<div><dt>Ignition score</dt><dd>' + r.ignition_score + ' / 100</dd></div>' +
      '<div><dt>TVL</dt><dd>' + moneyFull(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day change</dt><dd>' + (r.change_7d == null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(2) + '%') + '</dd></div>' +
      '<div><dt>Age</dt><dd>' + (r.age_days == null ? 'unknown' : r.age_days + ' days') + '</dd></div>' +
      '<div><dt>Value per day</dt><dd>' + money(r.velocity_usd_per_day) + ' / day</dd></div>' +
      '</dl>' +
      '<p class="warn">This protocol records no token in the snapshot — that is DefiLlama\u2019s record, not proof it has none. The implied value is this radar\u2019s own claim, not a prediction that a token will be issued.</p>' +
      '<div class="model-box"><h3>How the value is built</h3><table>' +
      '<tr><td>TVL</td><td>' + moneyFull(r.tvl_usd) + '</td></tr>' +
      '<tr><td>&times; sector multiple (' + esc(r.category || 'Uncategorized') + ')</td><td>' + r.sector_multiple.toFixed(3) + '&times;</td></tr>' +
      '<tr><td>&times; growth (' + growthPct.toFixed(1) + '% in 7d)</td><td>' + growthMult.toFixed(3) + '&times;</td></tr>' +
      '<tr><td>&times; maturity (' + ageFor + ' days)</td><td>' + maturityMult.toFixed(3) + '&times;</td></tr>' +
      '<tr><td>&times; breadth (' + r.chains.length + ' chains)</td><td>' + breadthMult.toFixed(3) + '&times;</td></tr>' +
      '<tr><td><b>= implied value</b></td><td><b>' + moneyFull(r.implied_value_usd) + '</b></td></tr>' +
      '</table>' + factorBars(r) + '</div>' +
      '<h3>Farm plan — 7 steps</h3><ol class="steps">' + steps + '</ol></div>';
    $('drawer').hidden = false;
    if (history.replaceState) history.replaceState(null, '', '#detail=' + slug);
  }
  function closeDetail() {
    $('drawer').hidden = true;
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  }
  $('drawerClose').addEventListener('click', closeDetail);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });

  // ---- live tokens ----
  $('liveRows').innerHTML = D.live.map(function (p) {
    var ratio = p.mcap_usd && p.tvl_usd ? (p.mcap_usd / p.tvl_usd).toFixed(2) + '&times;' : '—';
    return '<tr><td><span class="name">' + esc(p.name) + '</span>' +
      '<span class="sub">' + esc(p.category || 'Uncategorized') + ' · ' + esc(p.chains.slice(0, 3).join(', ')) + '</span></td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + ratio + '</td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  // ---- model tab: the market's price list ----
  $('sectorRows').innerHTML = D.sectors.map(function (s) {
    return '<tr><td>' + esc(s.sector) + '</td><td class="num"><b>' + s.multiple.toFixed(3) + '&times;</b></td>' +
      '<td class="num">' + s.live_count + (s.fallback ? ' (global median — too few live tokens)' : '') + '</td></tr>';
  }).join('');

  // ---- tabs ----
  var tabs = document.querySelectorAll('.tab');
  function showTab(name) {
    tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tab') === name); });
    ['board', 'live', 'model'].forEach(function (n) { $('tab-' + n).classList.toggle('hidden', n !== name); });
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showTab(t.getAttribute('data-tab')); });
  });

  // ---- deep links: #detail=<slug> or #filter=category:X | watchlist | search:<text> ----
  function applyHash() {
    var h = location.hash || '';
    if (h.indexOf('#detail=') === 0) { openDetail(decodeURIComponent(h.slice(8))); return; }
    if (h.indexOf('#filter=') === 0) {
      var f = decodeURIComponent(h.slice(8));
      if (f === 'watchlist') { state.watchOnly = true; $('fWatch').checked = true; }
      else if (f.indexOf('category:') === 0) { state.cat = f.slice(9); $('fCat').value = state.cat; }
      else if (f.indexOf('search:') === 0) { state.q = f.slice(7); $('q').value = state.q; }
      renderBoard();
    }
  }

  renderBoard();
  applyHash();
})();
