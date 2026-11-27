/* Shared behaviour for pages without the explorer: theme toggle, theme-aware logos and the phone menu. */
(function () {
  'use strict';
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function setThemeLabel() {
    var dark = document.documentElement.dataset.theme !== 'light';
    $$('[data-theme-toggle]').forEach(function (b) { b.textContent = dark ? 'Light theme' : 'Dark theme'; b.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); });
    $$('img[data-dark]').forEach(function (i) { i.src = dark ? i.dataset.dark : i.dataset.light; });
  }

  function init() {
    setThemeLabel();
    $$('[data-theme-toggle]').forEach(function (tb) { tb.addEventListener('click', function () {
      var r = document.documentElement, t = r.dataset.theme === 'light' ? 'dark' : 'light'; r.dataset.theme = t;
      try { localStorage.setItem('theme', t); } catch (e) {}
      setThemeLabel();
    }); });
    var menu = document.getElementById('menu'), nav = document.getElementById('nav');
    if (menu && nav) {
      menu.addEventListener('click', function () { var o = !nav.classList.contains('open'); nav.classList.toggle('open', o); menu.setAttribute('aria-expanded', o); });
      $$('#nav a').forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); }); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
