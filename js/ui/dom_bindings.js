/*
 * js/ui/dom_bindings.js
 *
 * DOM "gateway" (thin).
 * ONLY low-level DOM primitives live here:
 * - query/create/update (classes/text/html/attrs)
 * - events
 * - downloads
 * - timers (now/raf/setTimeout)
 *
 * NO business rules (totals/filters/pagination decisions) in this file.
 */
(function (global) {
  'use strict';

  const App = global.App = global.App || {};
  App.UI = App.UI || {};

  function q(sel, root) {
    const r = root || document;
    return r.querySelector(sel);
  }

  function qa(sel, root) {
    const r = root || document;
    return Array.prototype.slice.call(r.querySelectorAll(sel));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function create(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs && typeof attrs === 'object') {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (k === 'class' || k === 'className') el.className = String(v);
        else if (k === 'text') el.textContent = String(v);
        else if (k === 'html') el.innerHTML = String(v);
        else el.setAttribute(k, String(v));
      });
    }
    return el;
  }

  function setText(el, v) {
    if (!el) return;
    el.textContent = (v === null || v === undefined) ? '' : String(v);
  }

  function setHTML(el, v) {
    if (!el) return;
    el.innerHTML = (v === null || v === undefined) ? '' : String(v);
  }

  function addClass(el, cls) {
    if (!el || !cls) return;
    el.classList.add(cls);
  }

  function removeClass(el, cls) {
    if (!el || !cls) return;
    el.classList.remove(cls);
  }

  function toggleClass(el, cls, force) {
    if (!el || !cls) return;
    if (force === undefined) el.classList.toggle(cls);
    else el.classList.toggle(cls, !!force);
  }

  function setAttr(el, name, value) {
    if (!el || !name) return;
    if (value === null || value === undefined) el.removeAttribute(name);
    else el.setAttribute(name, String(value));
  }

  function setProp(el, name, value) {
    if (!el || !name) return;
    el[name] = value;
  }

  // Event helper: returns an "off" function
  function on(el, eventName, cb, opts) {
    if (!el || !eventName || !cb) return function () {};
    el.addEventListener(eventName, cb, opts || false);
    return function off() {
      try { el.removeEventListener(eventName, cb, opts || false); } catch (_) {}
    };
  }

  function once(el, eventName, cb, opts) {
    if (!el || !eventName || !cb) return;
    const o = Object.assign({}, (opts || {}), { once: true });
    el.addEventListener(eventName, cb, o);
  }

  // Small delegation helper (optional but handy)
  function onDelegate(root, eventName, selector, cb, opts) {
    if (!root || !eventName || !selector || !cb) return function () {};
    function handler(ev) {
      const target = ev.target && ev.target.closest ? ev.target.closest(selector) : null;
      if (target && root.contains(target)) cb(ev, target);
    }
    root.addEventListener(eventName, handler, opts || false);
    return function off() {
      try { root.removeEventListener(eventName, handler, opts || false); } catch (_) {}
    };
  }

  function downloadBlob(blob, filename) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) {
      // noop
    }
  }

  // DOM tree helpers (still gateway-level)
  function append(parent, child) {
    try {
      if (!parent || !child) return;
      parent.appendChild(child);
    } catch (_) {}
  }

  function prepend(parent, child) {
    try {
      if (!parent || !child) return;
      parent.insertBefore(child, parent.firstChild || null);
    } catch (_) {}
  }

  function now() { return Date.now(); }
  function raf(cb) { return requestAnimationFrame(cb); }
  function caf(id) { return cancelAnimationFrame(id); }
  function wait(ms, cb) { return setTimeout(cb, ms); }
  function clearWait(id) { return clearTimeout(id); }

  // Optional: ready helper
  function ready(cb) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb, { once: true });
    } else {
      cb();
    }
  }

  App.UI.dom = {
    q: q,
    qa: qa,
    byId: byId,
    create: create,
    setText: setText,
    setHTML: setHTML,
    addClass: addClass,
    removeClass: removeClass,
    toggleClass: toggleClass,
    setAttr: setAttr,
    setProp: setProp,
    on: on,
    once: once,
    onDelegate: onDelegate,
    append: append,
    prepend: prepend,
    downloadBlob: downloadBlob,
    now: now,
    raf: raf,
    caf: caf,
    wait: wait,
    clearWait: clearWait,
    ready: ready
  };
})(window);
