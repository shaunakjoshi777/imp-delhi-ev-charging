/* EV Go Brrr site script.
   - theme toggle
   - KaTeX formulas (only if KaTeX loaded)
   - static demand map
   - the Delhi Charger Siting Explorer: precomputed layouts drawn on canvas; only the coverage figures are computed here.
   The comparison table reports each layout's figures without highlighting, sorting or ranking. */
(function () {
  const $ = (id) => document.getElementById(id);
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // ---------- theme ----------
  const root = document.documentElement;
  try { const t = localStorage.getItem("theme"); if (t === "light" || t === "dark") root.dataset.theme = t; } catch (e) {}
  const darkNow = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  const themeBtn = $("theme-btn");
  const labelTheme = () => { themeBtn.textContent = darkNow() ? "Light mode" : "Dark mode"; themeBtn.setAttribute("aria-pressed", String(darkNow())); };
  themeBtn.addEventListener("click", () => {
    root.dataset.theme = darkNow() ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch (e) {}
    labelTheme();
  });
  labelTheme();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", labelTheme);

  // ---------- formulas ----------
  function renderTex() {
    if (!window.katex) return;
    document.querySelectorAll("[data-tex]").forEach((el) => {
      try { katex.render(el.dataset.tex, el, { displayMode: el.classList.contains("formula"), throwOnError: false }); } catch (e) {}
    });
  }
  if (window.katex) renderTex(); else document.addEventListener("katex-ready", renderTex);
  window.addEventListener("load", renderTex);

  // ---------- shared state ----------
  const SIZES = ["1", "1.5", "2", "2.5", "3", "4", "5"];
  const state = { radius: 2100, link: true, rings: false, existing: false, consensus: false, grid: 4, k: 0, p: 0, cons: [] };
  let D = null, bounds = null;

  // Coverage figures for one layout: share of demand / population / area within R, demand-weighted mean distance,
  // and the distance from the worst-served cell to its nearest station.
  function metrics(st) {
    const R = state.radius, R2 = R * R;
    let wT = 0, wC = 0, pT = 0, pC = 0, aT = 0, aC = 0, dW = 0, dMax = 0;
    for (const c of D.cells) {
      const x = c[5], y = c[6];
      let q0 = Infinity;
      for (let j = 0; j < st.length; j++) { const dx = st[j][0] - x, dy = st[j][1] - y, q = dx * dx + dy * dy; if (q < q0) q0 = q; }
      const dist = Math.sqrt(q0);
      wT += c[2]; pT += c[3]; aT += c[4]; dW += c[2] * dist;
      if (q0 <= R2) { wC += c[2]; pC += c[3]; aC += c[4]; }
      if (dist > dMax) dMax = dist;
    }
    return { n: st.length, demand: 100 * wC / wT, pop: 100 * pC / pT, area: 100 * aC / aT, mean: dW / wT, max: dMax };
  }

  // ---------- drawing ----------
  function setupCanvas(cv) {
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 6, W = r.width - 2 * pad, H = r.height - 2 * pad;
    const s = Math.min(W / (bounds[2] - bounds[0]), H / (bounds[3] - bounds[1]));
    const ox = pad + (W - s * (bounds[2] - bounds[0])) / 2, oy = pad + (H - s * (bounds[3] - bounds[1])) / 2;
    return { ctx, s, X: (x) => ox + (x - bounds[0]) * s, Y: (y) => oy + (bounds[3] - y) * s, w: r.width, h: r.height };
  }

  function drawBase(m, strong) {
    const { ctx, s, X, Y } = m, rgb = css("--demand");
    ctx.clearRect(0, 0, m.w, m.h);
    for (const c of D.cells) {
      const a = strong ? Math.min(1, Math.pow(c[2] / D.wmax, 0.6)) * 0.85 + 0.05 : Math.min(1, Math.pow(c[2] / D.wmax, 0.6)) * 0.62 + 0.04;
      ctx.fillStyle = `rgba(${rgb},${a.toFixed(3)})`;
      ctx.fillRect(X(c[0] * 1000), Y((c[1] + 1) * 1000), 1000 * s + 0.4, 1000 * s + 0.4);
    }
    ctx.strokeStyle = css("--outline"); ctx.lineWidth = 1;
    ctx.beginPath();
    for (const ring of D.outline) { ring.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); ctx.closePath(); }
    ctx.stroke();
  }

  function drawScale(m) {
    const { ctx, s } = m, len = 5000 * s, x0 = 12, y0 = m.h - 14;
    ctx.strokeStyle = css("--ink-2"); ctx.fillStyle = css("--ink-2"); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x0, y0 - 4); ctx.lineTo(x0, y0); ctx.lineTo(x0 + len, y0); ctx.lineTo(x0 + len, y0 - 4); ctx.stroke();
    ctx.font = `11px ${css("--font-num")}`; ctx.fillText("5 km", x0 + len + 6, y0 + 1);
  }

  function drawStations(m, st, color) {
    const { ctx, s, X, Y } = m;
    if (state.rings) {
      ctx.fillStyle = color; ctx.globalAlpha = 0.07;
      for (const p of st) { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), state.radius * s, 0, 2 * Math.PI); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    const r = st.length > 250 ? 2.2 : st.length > 150 ? 2.8 : 3.4;
    ctx.fillStyle = color; ctx.strokeStyle = css("--plate"); ctx.lineWidth = 0.9;
    for (const p of st) { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
  }

  function drawOverlays(m) {
    const { ctx, X, Y } = m;
    if (state.existing) {
      ctx.strokeStyle = css("--existing"); ctx.lineWidth = 1.4;
      for (const p of D.existing4w) { const x = X(p[0]), y = Y(p[1]); ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke(); }
    }
    if (state.consensus) {
      ctx.strokeStyle = css("--ink"); ctx.lineWidth = 1.8;
      for (const c of state.cons) { ctx.beginPath(); ctx.arc(X(c[0]), Y(c[1]), 8, 0, 2 * Math.PI); ctx.stroke(); }
    }
  }

  // A consensus site: a grid station with a K-means station AND an MCLP station within 1 km of it.
  // Drawn at the mean position of the three stations. Recomputed whenever any slider changes.
  const AGREE_M = 1000;
  function nearest(st, x, y) {
    let bi = -1, b = Infinity;
    for (let j = 0; j < st.length; j++) { const dx = st[j][0] - x, dy = st[j][1] - y, q = dx * dx + dy * dy; if (q < b) { b = q; bi = j; } }
    return [bi, Math.sqrt(b)];
  }
  function consensusSites(G, K, M) {
    const out = [];
    for (const g of G) {
      const [ki, dk] = nearest(K, g[0], g[1]), [mi, dm] = nearest(M, g[0], g[1]);
      if (dk <= AGREE_M && dm <= AGREE_M) out.push([(g[0] + K[ki][0] + M[mi][0]) / 3, (g[1] + K[ki][1] + M[mi][1]) / 3]);
    }
    return out;
  }

  function drawGridCells(m, g) {
    const { ctx, s, X, Y } = m, size = g.size_km * 1000;
    ctx.strokeStyle = css("--grid"); ctx.globalAlpha = 0.35; ctx.lineWidth = 0.7;
    for (const c of g.cells) { if (c[2]) ctx.strokeRect(X(c[0]), Y(c[1] + size), size * s, size * s); }
    ctx.globalAlpha = 1;
  }

  // ---------- state -> view ----------
  function nearestBudget(n) {
    let bi = 0; D.budgets.forEach((b, i) => { if (Math.abs(b - n) < Math.abs(D.budgets[bi] - n)) bi = i; }); return bi;
  }
  const fmtPct = (v) => v.toFixed(1) + "%";
  const fmtM = (v) => Math.round(v).toLocaleString("en-IN") + " m";
  const km = () => state.radius / 1000 + " km";

  function statsHTML(mt) {
    return `<div class="stat"><b>${fmtPct(mt.demand)}</b><span>demand within ${km()}</span></div>
            <div class="stat"><b>${fmtPct(mt.area)}</b><span>area within ${km()}</span></div>
            <div class="stat"><b>${fmtM(mt.mean)}</b><span>mean distance</span></div>
            <div class="stat"><b>${fmtM(mt.max)}</b><span>farthest cell</span></div>`;
  }
  function summary(name, extra, mt) {
    return `${name}${extra}: ${mt.n} stations. ${fmtPct(mt.demand)} of estimated demand, ${fmtPct(mt.pop)} of population and ` +
      `${fmtPct(mt.area)} of the area are within ${km()} of a station. Demand-weighted mean distance to the nearest station ` +
      `${fmtM(mt.mean)}; the farthest cell is ${fmtM(mt.max)} away.` +
      (state.consensus ? ` Consensus sites shown: ${state.cons.length}.` : "") +
      (state.existing ? ` Existing four-wheeler chargers shown: ${D.existing4w.length}.` : "");
  }

  function drawDemandMap() {
    const m = setupCanvas($("map-demand"));
    drawBase(m, true);
    drawScale(m);
    const rgb = css("--demand");
    $("ramp-demand").style.background = `linear-gradient(90deg, rgba(${rgb},0.05), rgba(${rgb},0.9))`;
  }

  function render() {
    const g = D.grids[SIZES[state.grid]];
    if (state.link) { state.k = state.p = nearestBudget(g.n); }
    $("grid-size").value = state.grid; $("k-slider").value = state.k; $("p-slider").value = state.p;
    $("k-slider").disabled = $("p-slider").disabled = state.link;
    const kN = D.budgets[state.k], pN = D.budgets[state.p];
    $("grid-out").value = `${SIZES[state.grid]} km · ${g.n}`;
    $("k-out").value = `${kN} stations`; $("p-out").value = `${pN} stations`;
    $("grid-size").setAttribute("aria-valuetext", `${SIZES[state.grid]} km cells, ${g.n} stations`);
    $("k-slider").setAttribute("aria-valuetext", `${kN} stations`);
    $("p-slider").setAttribute("aria-valuetext", `${pN} stations`);

    const layouts = [
      { key: "grid", name: "Grid", extra: ` (${SIZES[state.grid]} km cells)`, st: g.stations, color: css("--grid") },
      { key: "kmeans", name: "Weighted K-means", extra: "", st: D.kmeans[kN], color: css("--kmeans") },
      { key: "mclp", name: "MCLP", extra: "", st: D.mclp[pN], color: css("--mclp") },
    ];
    const ms = layouts.map((L) => metrics(L.st));
    state.cons = consensusSites(layouts[0].st, layouts[1].st, layouts[2].st);
    $("cons-count").textContent = `(${state.cons.length} of ${layouts[0].st.length} grid sites)`;
    layouts.forEach((L, i) => {
      const m = setupCanvas($("map-" + L.key));
      drawBase(m, false);
      if (L.key === "grid") drawGridCells(m, g);
      drawStations(m, L.st, L.color);
      drawOverlays(m);
      $("stats-" + L.key).innerHTML = statsHTML(ms[i]);
      $("sum-" + L.key).textContent = summary(L.name, L.extra, ms[i]);
    });
    $("th-demand").textContent = `Demand within ${km()}`;
    $("th-pop").textContent = `Population within ${km()}`;
    $("th-area").textContent = `Area within ${km()}`;
    $("compare-body").innerHTML = layouts.map((L, i) =>
      `<tr><td><span class="mname"><span class="swatch" style="background:${L.color}"></span>${L.name}</span></td>` +
      `<td>${ms[i].n}</td><td>${fmtPct(ms[i].demand)}</td><td>${fmtPct(ms[i].pop)}</td><td>${fmtPct(ms[i].area)}</td>` +
      `<td>${fmtM(ms[i].mean)}</td><td>${fmtM(ms[i].max)}</td></tr>`).join("");
    const rgb = css("--demand");
    $("ramp").style.background = `linear-gradient(90deg, rgba(${rgb},0.05), rgba(${rgb},0.66))`;
  }
  const redraw = () => { drawDemandMap(); render(); };

  // ---------- wiring ----------
  function wire() {
    $("k-slider").max = $("p-slider").max = D.budgets.length - 1;
    $("grid-size").addEventListener("input", (e) => { state.grid = +e.target.value; render(); });
    $("k-slider").addEventListener("input", (e) => { state.k = +e.target.value; render(); });
    $("p-slider").addEventListener("input", (e) => { state.p = +e.target.value; render(); });
    $("link-counts").addEventListener("change", (e) => { state.link = e.target.checked; render(); });
    $("show-rings").addEventListener("change", (e) => { state.rings = e.target.checked; render(); });
    $("show-existing").addEventListener("change", (e) => { state.existing = e.target.checked; render(); });
    $("show-consensus").addEventListener("change", (e) => { state.consensus = e.target.checked; render(); });
    document.querySelectorAll("#radius-seg button").forEach((b) => b.addEventListener("click", () => {
      state.radius = +b.dataset.r;
      document.querySelectorAll("#radius-seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
    }));
    let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(redraw, 80); });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
    new MutationObserver(redraw).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  }

  fetch("explorer_data.json").then((r) => r.json()).then((data) => {
    D = data;
    D.wmax = Math.max(...D.cells.map((c) => c[2]));
    const xs = [], ys = [];
    D.outline.forEach((ring) => ring.forEach((p) => { xs.push(p[0]); ys.push(p[1]); }));
    bounds = [Math.min(...xs) - 400, Math.min(...ys) - 400, Math.max(...xs) + 400, Math.max(...ys) + 400];
    state.k = state.p = nearestBudget(104);
    wire(); redraw();
  }).catch(() => {
    $("compare-body").innerHTML = '<tr><td colspan="7" class="loading">The layout data could not be loaded. Reload the page to try again.</td></tr>';
    $("sum-demand").textContent = "The demand map could not be loaded.";
  });
})();
