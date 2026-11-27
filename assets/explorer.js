/* Delhi EV Charger Siting explorer.
   Reads data/explorer_data.json (exported from ev_siting_final.ipynb). The page never moves a station:
   it only draws the saved layouts and works out distances from them. */
(function () {
  'use strict';
  var METHODS = ['grid', 'kmeans', 'mclp'];
  var NAME = { grid: 'Grid', kmeans: 'K-means', mclp: 'MCLP' };
  var LONG = { grid: 'Grid (policy rule)', kmeans: 'Weighted K-means', mclp: 'MCLP (optimisation)' };
  var DEFAULT = { s: 'A', n: 104, g: 3, r: 2100, c: 206, v: 'one', m: 'grid', tab: 'fig', L: 'gkm', d: 1, ring: 0, ex: 0 };
  var N_OPTS = { A: [104, 157, 178, 206, 404], B: [59, 104] };
  var GRID_N = { 3: 104, 2: 157, 1: 404 };
  var N_GRID = { 104: 3, 157: 2, 404: 1 };

  var D = null, st = {}, view = { cx: 0, cy: 0, z: 1 }, colors = {}, plates = [], demandPlate = null;
  var sharedIdx = null, selected = null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (v, d) { return v.toLocaleString('en-IN', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  /* ---------- state and URL ---------- */
  function readHash() {
    st = Object.assign({}, DEFAULT);
    var h = new URLSearchParams(location.hash.replace(/^#?/, ''));
    if (!h.has('s')) return;
    ['s', 'v', 'm', 'tab', 'L'].forEach(function (k) { if (h.has(k)) st[k] = h.get(k); });
    ['n', 'g', 'r', 'c', 'd', 'ring', 'ex'].forEach(function (k) { if (h.has(k) && !isNaN(+h.get(k))) st[k] = +h.get(k); });
    if (st.s !== 'A' && st.s !== 'B') st.s = 'A';
    if (METHODS.indexOf(st.m) < 0) st.m = 'grid';
    if (['one', 'side', 'shared'].indexOf(st.v) < 0) st.v = 'one';
    if (['fig', 'shared', 'list'].indexOf(st.tab) < 0) st.tab = 'fig';
    if ([1500, 2100, 3000].indexOf(st.r) < 0) st.r = 2100;
  }
  function writeHash() {
    var p = new URLSearchParams();
    ['s', 'n', 'g', 'r', 'c', 'v', 'm', 'tab', 'L', 'd', 'ring', 'ex'].forEach(function (k) { p.set(k, st[k]); });
    history.replaceState(null, '', '#' + p.toString());
  }
  function layerOn(m) { return st.L.indexOf(m[0]) >= 0; }

  /* fix combinations that are not in the data, and say why */
  function normalise() {
    var why = [];
    if (N_OPTS[st.s].indexOf(st.n) < 0) st.n = st.s === 'A' ? 104 : 59;
    if (st.s === 'A') {
      if (N_GRID[st.n]) st.g = N_GRID[st.n];
      if (st.n !== 104 && st.c === 206) { st.c = 1570; }
      if (st.n !== 104) why.push('MCLP on the 206 grid points was solved for 104 stations only, so other numbers use the 1,570 square centres.');
      if (!N_GRID[st.n]) why.push('The grid rule gives 104, 157 or 404 stations (3, 2 or 1 km squares), so there is no grid layout for ' + st.n + '.');
    } else {
      st.g = 3; st.c = 206;
      why.push('Scenario B uses the 3 km grid and adds MCLP sites from the 206 grid points.');
      if (st.n === 104) why.push('In Scenario B the grid rule adds 59 stations, so there is no grid layout for 104 new stations.');
    }
    if (st.c === 1570 && st.r !== 2100) why.push('MCLP on the 1,570 square centres was solved for 2.1 km; other distances change the figures, not the sites.');
    return why;
  }

  function layoutKey(m) {
    if (st.s === 'A') {
      if (m === 'grid') return N_GRID[st.n] ? 'A_grid_' + st.n : null;
      if (m === 'kmeans') return 'A_kmeans_' + st.n;
      if (st.c === 206) return st.n === 104 ? 'A_mclp_104_c206' + (st.r === 2100 ? '' : '_R' + st.r) : null;
      return 'A_mclp_' + st.n + '_c1570';
    }
    if (m === 'grid') return st.n === 59 ? 'B_grid_59' : null;
    return 'B_' + m + '_' + st.n;
  }
  function layout(m) { var k = layoutKey(m); return k && D.layouts[k] ? D.layouts[k] : null; }
  function sharedDefined() { return st.s === 'A' && st.n === 104 && st.c === 206; }
  function sharedList() { return sharedDefined() ? (D.shared[String(st.r)] || []) : []; }

  /* ---------- figures ---------- */
  function figures(m) {
    var L = layout(m); if (!L) return null;
    var S = L.stations.slice(); if (st.s === 'B') S = S.concat(D.existing);
    var R = st.r / 1000, cells = D.cells, n = cells.length, d = new Float64Array(n);
    var tw = 0, tp = 0, ta = 0, cw = 0, cp = 0, ca = 0, sd = 0, far = -1, farI = 0;
    for (var i = 0; i < n; i++) {
      var c = cells[i], dmin = Infinity;
      for (var j = 0; j < S.length; j++) { var dx = c[2] - S[j].x, dy = c[3] - S[j].y, q = dx * dx + dy * dy; if (q < dmin) dmin = q; }
      dmin = Math.sqrt(dmin); d[i] = dmin;
      tw += c[4]; tp += c[5]; ta += c[6]; sd += c[4] * dmin;
      if (dmin <= R + 1e-9) { cw += c[4]; cp += c[5]; ca += c[6]; }
      if (dmin > far) { far = dmin; farI = i; }
    }
    var order = []; for (var oi = 0; oi < n; oi++) order.push(oi); order.sort(function (a, b) { return d[a] - d[b]; });
    var acc = 0, p95 = d[order[order.length - 1]];
    for (var k = 0; k < order.length; k++) { acc += cells[order[k]][4] / tw; if (acc >= 0.95) { p95 = d[order[k]]; break; } }
    return { L: L, count: L.stations.length, demand: 100 * cw / tw, pop: 100 * cp / tp, area: 100 * ca / ta, mean: sd / tw, p95: p95, far: far, farWard: D.wards[cells[farI][7]] };
  }

  /* shared flags per station of the current layouts */
  function sharedFlags(m) {
    var L = layout(m); if (!L) return null;
    if (!sharedDefined()) return null;
    var flags = L.stations.map(function () { return false; });
    sharedList().forEach(function (s) {
      var bi = -1, bd = Infinity;
      L.stations.forEach(function (p, i) { var q = Math.hypot(p.x - s.x, p.y - s.y); if (q < bd) { bd = q; bi = i; } });
      if (m === 'kmeans' ? bd <= 1.0001 : bd < 0.01) flags[bi] = true;
    });
    return flags;
  }

  /* ---------- colours ---------- */
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    ['bg', 'surface', 'raised', 'border', 'ink', 'ink-2', 'accent', 'grid', 'kmeans', 'mclp', 'existing', 'consensus',
      'demand-1', 'demand-2', 'demand-3', 'demand-4', 'demand-5'].forEach(function (k) { colors[k] = cs.getPropertyValue('--' + k).trim(); });
    if (colors.consensus.indexOf('var(') === 0 || !colors.consensus) colors.consensus = colors.ink;
  }

  /* ---------- map plate ---------- */
  var outlinePath = null, cellIndex = {}, binEdges = [], bounds = null;
  function prepGeometry() {
    outlinePath = new Path2D(D.outline.replace(/L/g, ' L ').replace(/M/g, ' M ').replace(/Z/g, ' Z ').replace(/,/g, ' '));
    var xs = [], ys = [];
    D.cells.forEach(function (c, i) { cellIndex[Math.round(c[0]) + ',' + Math.round(c[1])] = i; xs.push(c[0], c[0] + 1); ys.push(c[1], c[1] + 1); });
    bounds = { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), y0: Math.min.apply(null, ys), y1: Math.max.apply(null, ys) };
    var ws = D.cells.map(function (c) { return c[4]; }).sort(function (a, b) { return a - b; });
    binEdges = [0.2, 0.4, 0.6, 0.8].map(function (q) { return ws[Math.floor(q * (ws.length - 1))]; });
    fitView();
  }
  function fitView() { view.cx = (bounds.x0 + bounds.x1) / 2; view.cy = (bounds.y0 + bounds.y1) / 2; view.z = 1; }
  function bin(w) { var b = 0; while (b < 4 && w > binEdges[b]) b++; return b; }

  function Plate(host, opts) {
    this.opts = opts; this.host = host;
    var el = document.createElement('div'); el.className = 'plate'; this.el = el;
    var cv = document.createElement('canvas'); cv.tabIndex = 0; cv.setAttribute('role', 'img'); this.cv = cv; el.appendChild(cv);
    if (opts.title) { var t = document.createElement('div'); t.className = 'plate-title'; t.innerHTML = opts.title; el.appendChild(t); }
    if (!opts.noZoom) {
      var z = document.createElement('div'); z.className = 'zoom';
      z.innerHTML = '<button class="dx-btn" type="button" data-z="in" aria-label="Zoom in">+</button><button class="dx-btn" type="button" data-z="out" aria-label="Zoom out">−</button><button class="dx-btn" type="button" data-z="fit" aria-label="Show all of Delhi">⤢</button>';
      el.appendChild(z);
      z.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var a = b.dataset.z; if (a === 'fit') fitView(); else zoomBy(a === 'in' ? 1.5 : 1 / 1.5); redrawAll(); });
    }
    this.legend = document.createElement('div'); this.legend.className = 'legend'; el.appendChild(this.legend);
    this.scale = document.createElement('div'); this.scale.className = 'scalebar'; el.appendChild(this.scale);
    this.tip = document.createElement('div'); this.tip.className = 'tip'; el.appendChild(this.tip);
    host.appendChild(el);
    this.bind();
  }
  Plate.prototype.metrics = function () {
    var r = this.cv.getBoundingClientRect(), W = r.width, H = r.height;
    var fit = Math.min(W / (bounds.x1 - bounds.x0), H / (bounds.y1 - bounds.y0)) * 0.94;
    return { W: W, H: H, s: fit * view.z };
  };
  Plate.prototype.toPx = function (x, y, M) { return [M.W / 2 + (x - view.cx) * M.s, M.H / 2 - (y - view.cy) * M.s]; };
  Plate.prototype.toKm = function (px, py, M) { return [view.cx + (px - M.W / 2) / M.s, view.cy - (py - M.H / 2) / M.s]; };
  Plate.prototype.methods = function () {
    var o = this.opts; if (o.methods) return o.methods;
    return METHODS.filter(layerOn);
  };
  Plate.prototype.draw = function () {
    var dpr = window.devicePixelRatio || 1, M = this.metrics(), cv = this.cv;
    if (!M.W) return;
    cv.width = Math.round(M.W * dpr); cv.height = Math.round(M.H * dpr);
    var ctx = cv.getContext('2d'); this.M = M;
    var shareView = !this.opts.static && st.v === 'shared';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = colors.surface; ctx.fillRect(0, 0, M.W, M.H);
    var T = [dpr * M.s, 0, 0, -dpr * M.s, dpr * (M.W / 2 - view.cx * M.s), dpr * (M.H / 2 + view.cy * M.s)];
    var showDemand = this.opts.static ? true : !!st.d;
    if (showDemand) {
      ctx.save(); ctx.setTransform.apply(ctx, T); ctx.clip(outlinePath, 'evenodd');
      var ramp = ['demand-1', 'demand-2', 'demand-3', 'demand-4', 'demand-5'];
      for (var b = 0; b < 5; b++) {
        ctx.fillStyle = colors[ramp[b]]; ctx.beginPath();
        D.cells.forEach(function (c) { if (bin(c[4]) === b) ctx.rect(c[0], c[1], 1.002, 1.002); });
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.save(); ctx.setTransform.apply(ctx, T); ctx.lineWidth = 1.5 / M.s; ctx.strokeStyle = colors['ink-2']; ctx.stroke(outlinePath); ctx.restore();
    var self = this, ms = this.methods(), pts = [];
    if (this.opts.static) { this.hits = []; this.overlay(M, []); return; }
    // coverage rings
    if (st.ring) {
      ms.forEach(function (m) {
        var L = layout(m); if (!L) return;
        ctx.strokeStyle = colors[m]; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
        L.stations.forEach(function (p) { var q = self.toPx(p.x, p.y, M); ctx.beginPath(); ctx.arc(q[0], q[1], st.r / 1000 * M.s, 0, 7); ctx.stroke(); });
        ctx.globalAlpha = 1;
      });
    }
    // existing chargers as ×
    var showEx = st.ex || st.s === 'B';
    if (showEx) {
      ctx.strokeStyle = colors.existing; ctx.lineWidth = 2;
      D.existing.forEach(function (p) {
        var q = self.toPx(p.x, p.y, M), a = 4.5;
        ctx.beginPath(); ctx.moveTo(q[0] - a, q[1] - a); ctx.lineTo(q[0] + a, q[1] + a); ctx.moveTo(q[0] + a, q[1] - a); ctx.lineTo(q[0] - a, q[1] + a); ctx.stroke();
        pts.push({ kind: 'existing', p: p, x: q[0], y: q[1] });
      });
    }
    // stations
    var rad = this.opts.small ? 4 : 5;
    ms.forEach(function (m) {
      var L = layout(m); if (!L) return;
      var fl = sharedFlags(m);
      ctx.globalAlpha = shareView ? 0.25 : 1;
      L.stations.forEach(function (p, i) {
        var q = self.toPx(p.x, p.y, M);
        ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, 7); ctx.fillStyle = colors[m]; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = colors.surface; ctx.stroke();
        pts.push({ kind: 'station', m: m, p: p, x: q[0], y: q[1], shared: fl ? fl[i] : null });
      });
      ctx.globalAlpha = 1;
    });
    // shared sites
    if (shareView && sharedDefined()) {
      sharedList().forEach(function (p) {
        var q = self.toPx(p.x, p.y, M);
        ctx.lineWidth = 4; ctx.strokeStyle = colors.surface;
        [5, 9].forEach(function (r) { ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7); ctx.stroke(); });
        ctx.lineWidth = 1.75; ctx.strokeStyle = colors.consensus;
        [5, 9].forEach(function (r) { ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7); ctx.stroke(); });
        pts.push({ kind: 'shared', p: p, x: q[0], y: q[1] });
      });
    }
    if (selected) {
      var q = self.toPx(selected.x, selected.y, M);
      ctx.lineWidth = 2.5; ctx.strokeStyle = colors.accent; ctx.beginPath(); ctx.arc(q[0], q[1], 14, 0, 7); ctx.stroke();
    }
    this.hits = pts;
    this.overlay(M, ms, shareView, showEx);
  };
  Plate.prototype.overlay = function (M, ms, shareView, showEx) {
    // scale bar 5 km
    this.scale.innerHTML = '<div>5 km</div><div class="bar" style="width:' + Math.round(5 * M.s) + 'px"></div>';
    var h = '';
    if (ms.length && !this.opts.small) {
      h += '<div class="row">' + ms.filter(function (m) { return layout(m); }).map(function (m) { return '<span class="item"><span class="dx-dot ' + m + '"></span>' + NAME[m] + '</span>'; }).join('');
      if (showEx) h += '<span class="item"><span class="dx-x" aria-hidden="true">×</span>Existing charger location</span>';
      if (shareView && sharedDefined()) h += '<span class="item"><span class="dx-ring" aria-hidden="true"></span>Shared site</span>';
      h += '</div>';
    }
    if (this.opts.static || st.d) h += '<div class="ramp-row"><span>Lower</span><span class="ramp">' + [1, 2, 3, 4, 5].map(function (i) { return '<span style="background:var(--demand-' + i + ')"></span>'; }).join('') + '</span><span>Higher estimated demand</span></div>';
    this.legend.innerHTML = h; this.legend.style.display = h ? '' : 'none';
    var label = this.opts.static ? 'Map of estimated charging demand across Delhi’s 1,570 one-kilometre squares inside the study area.' : summaryText(ms);
    this.cv.setAttribute('aria-label', label);
  };
  Plate.prototype.hit = function (px, py) {
    var dmin = null, bd = 10;
    (this.hits || []).forEach(function (h) { var d = Math.hypot(h.x - px, h.y - py); if (d < bd) { bd = d; dmin = h; } });
    if (dmin) return dmin;
    var km = this.toKm(px, py, this.M), key = Math.floor(km[0]) + ',' + Math.floor(km[1]);
    var i = cellIndex[key];
    if (i !== undefined && (this.opts.static || st.d)) return { kind: 'cell', c: D.cells[i], x: px, y: py };
    return null;
  };
  Plate.prototype.showTip = function (h) {
    if (!h) { this.tip.style.display = 'none'; return; }
    var rows;
    if (h.kind === 'station') rows = [['Method', '<span class="dx-row" style="gap:6px"><span class="dx-dot ' + h.m + '"></span>' + NAME[h.m] + '</span>'], ['Site ID', h.p.id], ['Area', esc(D.wards[h.p.ward])], ['Shared', h.shared === null ? 'Not worked out for these settings' : (h.shared ? 'Yes' : 'No')]];
    else if (h.kind === 'existing') rows = [['Existing charger location', 'Four-wheeler'], ['Site ID', h.p.id], ['Area', esc(D.wards[h.p.ward])]];
    else if (h.kind === 'shared') rows = [['Shared site', h.p.stable === null ? 'Stability tested at 2.1 km only' : (h.p.stable ? 'Stable' : 'Not stable in repeated runs')], ['Area', esc(D.wards[h.p.ward])], ['K-means station', fmt(h.p.kmeans_dist_m) + ' m away']];
    else rows = [['Demand weight', fmt(h.c[4], 2) + ' of 1,000'], ['Population', '≈ ' + fmt(h.c[5])], ['Ward', esc(D.wards[h.c[7]])]];
    this.tip.innerHTML = '<div class="dx-tip" role="tooltip"><dl>' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl></div>';
    this.tip.style.display = 'block';
    var M = this.M, tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
    var x = h.x + 14, y = h.y + 14;
    if (x + tw > M.W - 4) x = h.x - tw - 14; if (y + th > M.H - 4) y = h.y - th - 14;
    this.tip.style.left = Math.max(4, x) + 'px'; this.tip.style.top = Math.max(4, y) + 'px';
  };
  Plate.prototype.bind = function () {
    var self = this, cv = this.cv, drag = null, moved = false;
    function pos(e) { var r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener('pointerdown', function (e) { cv.setPointerCapture(e.pointerId); drag = pos(e); moved = false; });
    cv.addEventListener('pointermove', function (e) {
      var p = pos(e);
      if (drag) {
        var dx = p[0] - drag[0], dy = p[1] - drag[1];
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        if (moved) { view.cx -= dx / self.M.s; view.cy += dy / self.M.s; drag = p; self.showTip(null); redrawAll(); }
        return;
      }
      if (e.pointerType === 'mouse') self.showTip(self.hit(p[0], p[1]));
    });
    cv.addEventListener('pointerup', function (e) { var p = pos(e); if (!moved) self.showTip(self.hit(p[0], p[1])); drag = null; });
    cv.addEventListener('pointerleave', function () { if (!drag) self.showTip(null); });
    cv.addEventListener('wheel', function (e) {
      e.preventDefault(); var p = pos(e), M = self.M, before = self.toKm(p[0], p[1], M);
      zoomBy(e.deltaY < 0 ? 1.25 : 0.8); var M2 = self.metrics(), after = self.toKm(p[0], p[1], M2);
      view.cx += before[0] - after[0]; view.cy += before[1] - after[1]; redrawAll();
    }, { passive: false });
    cv.addEventListener('keydown', function (e) {
      var step = 40 / self.M.s, k = e.key, done = true;
      if (k === 'ArrowLeft') view.cx -= step; else if (k === 'ArrowRight') view.cx += step;
      else if (k === 'ArrowUp') view.cy += step; else if (k === 'ArrowDown') view.cy -= step;
      else if (k === '+' || k === '=') zoomBy(1.5); else if (k === '-') zoomBy(1 / 1.5); else if (k === '0') fitView(); else done = false;
      if (done) { e.preventDefault(); redrawAll(); }
    });
  };
  function zoomBy(f) { view.z = Math.min(14, Math.max(1, view.z * f)); }

  function buildPlates() {
    var host = $('#maps'); host.innerHTML = ''; plates = [];
    host.classList.toggle('side', st.v === 'side');
    if (st.v === 'side') {
      METHODS.forEach(function (m) {
        plates.push(new Plate(host, { methods: [m], small: true, noZoom: false, title: '<span class="dx-dot ' + m + '"></span>' + NAME[m] }));
      });
    } else plates.push(new Plate(host, {}));
  }
  function redrawAll() { plates.forEach(function (p) { p.draw(); }); if (demandPlate) demandPlate.draw(); }

  function summaryText(ms) {
    var parts = ms.filter(function (m) { return layout(m); }).map(function (m) { return layout(m).stations.length + ' ' + NAME[m]; });
    var t = 'Map of Delhi’s study area, Scenario ' + st.s + (st.s === 'B' ? ' (the 98 existing charger locations stay open and are drawn as ×)' : '') + '. ';
    t += parts.length ? 'Showing ' + parts.join(', ') + ' stations' + (st.v === 'shared' && sharedDefined() ? ', with the ' + sharedList().length + ' shared sites marked' : '') + '. ' : 'No method layers are switched on. ';
    t += st.d ? 'Demand layer on. ' : '';
    return t + 'The site list gives every station as text.';
  }

  /* ---------- controls ---------- */
  function setSeg(name, val, disabled) {
    $$('[data-ctrl="' + name + '"] button').forEach(function (b) {
      var on = String(b.dataset.v) === String(val);
      b.setAttribute('aria-checked', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
      var dis = disabled && disabled[b.dataset.v]; b.disabled = !!dis; b.title = dis || '';
    });
  }
  function renderControls(why) {
    var nseg = $('[data-ctrl="n"]');
    nseg.innerHTML = N_OPTS[st.s].map(function (v) { return '<button role="radio" data-v="' + v + '">' + (st.s === 'B' ? '98 + ' + v + ' new' : v) + '</button>'; }).join('');
    setSeg('s', st.s); setSeg('n', st.n); setSeg('r', st.r); setSeg('v', st.v); setSeg('m', st.m);
    setSeg('g', st.s === 'A' && N_GRID[st.n] ? st.g : (st.s === 'B' ? 3 : ''), st.s === 'B' ? { 2: 'Scenario B uses the 3 km grid', 1: 'Scenario B uses the 3 km grid' } : null);
    setSeg('c', st.c, st.s === 'B' ? { 1570: 'Scenario B adds new sites from the 206 grid points' } : (st.n !== 104 ? { 206: 'Solved for 104 stations only' } : null));
    $$('.dx-chip[data-layer]').forEach(function (b) {
      var m = b.dataset.layer, has = !!layout(m);
      b.setAttribute('aria-pressed', layerOn(m) && has ? 'true' : 'false'); b.disabled = !has;
      b.title = has ? '' : 'No ' + NAME[m] + ' layout for these settings';
    });
    $('#t-demand').checked = !!st.d; $('#t-rings').checked = !!st.ring; $('#t-existing').checked = !!st.ex || st.s === 'B';
    $('#t-existing').disabled = st.s === 'B';
    var extra = [];
    if (st.v === 'shared' && !sharedDefined()) extra.push('Shared sites are worked out for Scenario A, 104 stations and 206 MCLP candidate sites.');
    $('#reason').textContent = why.concat(extra).join(' ');
    $('#sheet-sum').textContent = 'Scenario ' + st.s + ' · ' + (st.s === 'B' ? '98 + ' + st.n + ' new' : st.n + ' stations') + ' · ' + (st.r / 1000) + ' km';
    $$('[role="tab"]').forEach(function (t) { var on = t.dataset.tab === st.tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !on; });
    $('#method-pick').hidden = st.tab === 'shared';
    $('#foot-extra').textContent = st.c === 1570 && st.s === 'A' ? 'MCLP runs on the 1,570 square centres stop at a solver time limit for some station numbers, so those layouts are near-optimal rather than proven optimal.' : '';
  }

  function onSeg(e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return;
    var name = b.parentElement.dataset.ctrl, v = b.dataset.v;
    if (name === 'n' || name === 'r' || name === 'c' || name === 'g') v = +v;
    if (name === 'g') { st.g = v; st.n = GRID_N[v]; }
    else st[name] = v;
    if (name === 's') { st.n = v === 'A' ? 104 : 59; }
    if (name === 'v' && v === 'shared' && st.tab !== 'list') st.tab = 'shared';
    update(name === 'v');
  }
  function segKeys(e) {
    var seg = e.target.closest('.dx-seg'); if (!seg || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) < 0) return;
    var bs = $$('button:not(:disabled)', seg), i = bs.indexOf(e.target), d = (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 1;
    if (i < 0) return; e.preventDefault(); var name = seg.dataset.ctrl; bs[(i + d + bs.length) % bs.length].click();
    var f = $('[data-ctrl="' + name + '"] button[aria-checked="true"]'); if (f) f.focus();
  }

  /* ---------- panel ---------- */
  function renderFigures() {
    var m = st.m, f = figures(m), el = $('#p-fig');
    if (!f) { el.innerHTML = '<p class="panel-text">There is no ' + NAME[m] + ' layout for these settings. ' + esc($('#reason').textContent) + '</p>'; return; }
    var R = (st.r / 1000).toFixed(1);
    var cnt = st.s === 'B' ? '98 + ' + f.count : fmt(f.count);
    var desc = LONG[m] + (f.L.grid_km ? ', ' + f.L.grid_km + ' km squares' : '') + (f.L.candidates ? ', ' + fmt(f.L.candidates) + ' candidate sites' : '') + ' · Scenario ' + st.s;
    var tiles = [
      [cnt, st.s === 'B' ? 'stations: existing + new' : 'stations'],
      [fmt(f.demand, 1) + '%', 'of estimated demand within ' + R + ' km'],
      [fmt(f.pop, 1) + '%', 'of population within ' + R + ' km'],
      [fmt(f.area, 1) + '%', 'of study area within ' + R + ' km'],
      [fmt(f.mean, 2) + ' km', 'mean distance to a station, weighted by demand'],
      [fmt(f.p95, 2) + ' km', '95% of demand is within this distance'],
      [fmt(f.far, 1) + ' km', 'farthest square from any station (' + esc(f.farWard) + ')']
    ];
    el.innerHTML = '<div class="fig-head"><span class="dx-dot ' + m + '"></span>' + esc(desc) + '</div><div class="fig-grid">' +
      tiles.map(function (t) { return '<div class="dx-stat"><span class="dx-stat-fig">' + t[0] + '</span><span class="dx-stat-cap">' + t[1] + '</span></div>'; }).join('') +
      '</div><p class="dx-note">Straight-line distances from each 1 km square’s centre to its nearest station' + (st.s === 'B' ? ', counting the 98 existing charger locations' : '') + '.</p>';
  }
  function renderShared() {
    var el = $('#shared-body');
    if (!sharedDefined()) {
      el.innerHTML = '<p class="panel-text">Shared sites are worked out for Scenario A with 104 stations and MCLP on the 206 grid points. <span class="dx-tbd">[TBD: how shared sites are defined when the station count or grid size changes, to confirm from the code]</span></p>';
      return;
    }
    var list = sharedList(), tested = st.r === 2100, km = (st.r / 1000).toFixed(1);
    var stable = list.filter(function (s) { return s.stable; }).length;
    var rows = list.slice().sort(function (a, b) { return D.wards[a.ward].localeCompare(D.wards[b.ward]); });
    el.innerHTML = '<div class="dx-stats"><div class="dx-stat"><span class="dx-stat-fig">' + list.length + '</span><span class="dx-stat-cap">shared sites at 104 stations, ' + km + ' km</span></div>' +
      (tested ? '<div class="dx-stat"><span class="dx-stat-fig">' + stable + '</span><span class="dx-stat-cap">of them also stable</span></div>' : '') + '</div>' +
      '<p class="dx-note">' + (tested ? 'Stable: the site also reappears in repeated runs with changed demand weights (K-means in at least 50% of runs, MCLP in at least 80%).'
        : 'At ' + km + ' km, MCLP uses its own layout solved for that distance; grid and K-means stay the same. The repeated-run stability test was only run at 2.1 km.') + ' Select a row to centre the map on it.</p>' +
      '<ul class="shared-list">' + rows.map(function (s) {
        return '<li><button type="button" data-x="' + s.x + '" data-y="' + s.y + '"><span>' + esc(D.wards[s.ward]) + '</span><span class="meta">' + (s.stable ? '<span class="dx-shared"><span class="dx-ring" aria-hidden="true"></span>Stable</span>' : 'Shared') + '</span></button></li>';
      }).join('') + '</ul>';
  }
  var listRows = [];
  function renderList() {
    var m = st.m, L = layout(m), tb = $('#site-table tbody'), q = ($('#search').value || '').trim().toLowerCase();
    if (!L) { listRows = []; tb.innerHTML = ''; $('#list-note').textContent = 'There is no ' + NAME[m] + ' layout for these settings.'; return; }
    var fl = sharedFlags(m);
    listRows = L.stations.map(function (p, i) { return { p: p, area: D.wards[p.ward], shared: fl ? (fl[i] ? 'Yes' : 'No') : 'n/a' }; })
      .sort(function (a, b) { return a.p.id < b.p.id ? -1 : 1; });
    var shown = listRows.filter(function (r) { return !q || r.p.id.toLowerCase().indexOf(q) >= 0 || r.area.toLowerCase().indexOf(q) >= 0; });
    $('#list-note').textContent = shown.length + ' of ' + listRows.length + ' ' + NAME[m] + ' stations' + (st.s === 'B' ? ' (new sites; the 98 existing charger locations stay open)' : '') + (fl ? '' : '. Shared is n/a: shared sites are worked out for Scenario A, 104 stations, 206 candidate sites') + '.';
    tb.innerHTML = shown.map(function (r) { return '<tr><td>' + r.p.id + '</td><td>' + esc(r.area) + '</td><td class="num">' + r.p.lat.toFixed(5) + '</td><td class="num">' + r.p.lon.toFixed(5) + '</td><td>' + r.shared + '</td></tr>'; }).join('');
  }
  function downloadCSV() {
    var m = st.m, L = layout(m); if (!L) return;
    var o = D.meta.origin_utm, lines = ['site_id,method,scenario,ward_or_area,latitude,longitude,x_epsg32643,y_epsg32643,new_or_existing,shared'];
    listRows.forEach(function (r) {
      lines.push([r.p.id, NAME[m], st.s, '"' + r.area.replace(/"/g, '""') + '"', r.p.lat, r.p.lon, Math.round(o[0] + r.p.x * 1000), Math.round(o[1] + r.p.y * 1000), 'new', r.shared].join(','));
    });
    if (st.s === 'B') D.existing.forEach(function (p) { lines.push([p.id, 'Existing', 'B', '"' + D.wards[p.ward].replace(/"/g, '""') + '"', p.lat, p.lon, Math.round(o[0] + p.x * 1000), Math.round(o[1] + p.y * 1000), 'existing', 'n/a'].join(',')); });
    var blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'delhi-ev-sites_scenario-' + st.s + '_' + m + '_' + st.n + (m === 'mclp' ? '_c' + st.c : '') + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function update(rebuild) {
    var why = normalise();
    renderControls(why);
    if (rebuild || !plates.length) buildPlates();
    redrawAll(); renderFigures(); renderShared(); renderList();
    $('#summary').textContent = summaryText(METHODS.filter(layerOn));
    writeHash();
  }

  /* ---------- theme ---------- */
  function setThemeLabel() {
    var dark = document.documentElement.dataset.theme !== 'light';
    $$('[data-theme-toggle]').forEach(function (b) { b.textContent = dark ? 'Light theme' : 'Dark theme'; b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); });
    $$('img[data-dark]').forEach(function (i) { i.src = dark ? i.dataset.dark : i.dataset.light; });
  }

  function wire() {
    $$('.dx-seg[data-ctrl]').forEach(function (s) { s.addEventListener('click', onSeg); s.addEventListener('keydown', segKeys); });
    $$('.dx-chip[data-layer]').forEach(function (b) {
      b.addEventListener('click', function () { var c = b.dataset.layer[0]; st.L = layerOn(b.dataset.layer) ? st.L.replace(c, '') : st.L + c; update(false); });
    });
    $('#t-demand').addEventListener('change', function (e) { st.d = e.target.checked ? 1 : 0; update(false); });
    $('#t-rings').addEventListener('change', function (e) { st.ring = e.target.checked ? 1 : 0; update(false); });
    $('#t-existing').addEventListener('change', function (e) { st.ex = e.target.checked ? 1 : 0; update(false); });
    $('#reset').addEventListener('click', function () { st = Object.assign({}, DEFAULT); selected = null; $('#search').value = ''; fitView(); update(true); });
    $$('[role="tab"]').forEach(function (t) {
      t.addEventListener('click', function () { st.tab = t.dataset.tab; update(false); });
      t.addEventListener('keydown', function (e) {
        var ts = $$('[role="tab"]'), i = ts.indexOf(t);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var n = ts[(i + (e.key === 'ArrowRight' ? 1 : -1) + ts.length) % ts.length]; n.click(); n.focus(); }
      });
    });
    $('#search').addEventListener('input', renderList);
    $('#csv').addEventListener('click', downloadCSV);
    $('#shared-body').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-x]'); if (!b) return;
      selected = { x: +b.dataset.x, y: +b.dataset.y }; view.cx = selected.x; view.cy = selected.y; view.z = Math.max(view.z, 4);
      if (st.v === 'side') { st.v = 'one'; update(true); } else redrawAll();
      $('#maps').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    });
    $$('[data-theme-toggle]').forEach(function (tb) { tb.addEventListener('click', function () {
      var r = document.documentElement, t = r.dataset.theme === 'light' ? 'dark' : 'light'; r.dataset.theme = t;
      try { localStorage.setItem('theme', t); } catch (e) {}
      setThemeLabel(); readColors(); redrawAll();
    }); });
    $('#menu').addEventListener('click', function () { var n = $('#nav'), o = !n.classList.contains('open'); n.classList.toggle('open', o); this.setAttribute('aria-expanded', o); });
    $$('#nav a').forEach(function (a) { a.addEventListener('click', function () { $('#nav').classList.remove('open'); $('#menu').setAttribute('aria-expanded', 'false'); }); });
    var sheet = $('#controls');
    $('#sheet-open').addEventListener('click', function () { sheet.classList.add('open'); this.setAttribute('aria-expanded', 'true'); var f = $('button[aria-checked="true"]', sheet); if (f) f.focus(); });
    $('#sheet-close').addEventListener('click', function () { sheet.classList.remove('open'); $('#sheet-open').setAttribute('aria-expanded', 'false'); $('#sheet-open').focus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet.classList.contains('open')) $('#sheet-close').click(); });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(redrawAll, 80); });
  }

  function renderMath() {
    $$('.formula[data-tex]').forEach(function (el) {
      if (window.katex) { try { katex.render(el.dataset.tex, el, { displayMode: true, throwOnError: false }); return; } catch (e) {} }
      el.textContent = el.dataset.tex;
    });
  }

  function init() {
    readHash(); readColors(); setThemeLabel(); wire(); renderMath();
    fetch('data/explorer_data.json?v=4').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
      D = data; prepGeometry();
      demandPlate = new Plate($('#demand-map'), { static: true, methods: [], noZoom: true });
      update(true);
    }).catch(function (err) {
      $('#maps').innerHTML = '<div class="dx-panel"><p class="panel-text">The explorer data could not load (' + esc(err.message) + '). If you opened this file directly, run a local server from the site folder: <code>python3 -m http.server 8000</code>, then open http://localhost:8000.</p></div>';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
