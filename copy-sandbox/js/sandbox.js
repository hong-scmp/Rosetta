/*
 * SCMP Copy Sandbox — editor engine
 * -------------------------------------------------------------
 * Generic, surface-agnostic. Drop this on any page that has:
 *   - a body[data-surface="<id>"]
 *   - one [data-canvas] element (the thing that gets screenshotted)
 *   - a [data-canvas-wrap] wrapper whose width we control
 *   - any number of .editable elements inside the canvas
 *   - toolbar controls tagged with data-* hooks (see README)
 *
 * It gives you: inline editing, live character counts, "does the
 * copy still fit?" warnings, device presets + free resize, autosave,
 * reset, and PNG export — with zero per-surface JS.
 */
(function () {
  "use strict";

  var body = document.body;
  var SURFACE = body.getAttribute("data-surface") || "surface";
  var STORE_KEY = "scmp-copy-sandbox:" + SURFACE;
  var trackedEdit = false; // fire the "someone edited" event only once per visit

  var canvas = document.querySelector("[data-canvas]");
  var wrap = document.querySelector("[data-canvas-wrap]");
  var stage = document.querySelector("[data-stage]");
  var editables = Array.prototype.slice.call(
    canvas ? canvas.querySelectorAll(".editable") : []
  );

  // Stable id per editable so saved copy survives reloads.
  editables.forEach(function (el, i) {
    if (!el.hasAttribute("data-fid")) {
      el.setAttribute("data-fid", (el.getAttribute("data-label") || "f") + "-" + i);
    }
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "false");
  });

  /* ---------- autosave / restore ---------------------------------- */
  function loadSaved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveAll() {
    var data = {};
    editables.forEach(function (el) { data[el.getAttribute("data-fid")] = el.innerHTML; });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  var saved = loadSaved();
  editables.forEach(function (el) {
    // remember the shipped default so Reset can restore it
    el.setAttribute("data-default", el.innerHTML);
    var fid = el.getAttribute("data-fid");
    if (saved[fid] != null) el.innerHTML = saved[fid];
  });

  /* ---------- character counter ----------------------------------- */
  var counter = document.createElement("div");
  counter.className = "cs-counter";
  counter.setAttribute("data-html2canvas-ignore", "true");
  document.body.appendChild(counter);
  var counterFor = null;

  function textLen(el) {
    return (el.textContent || "").replace(/ /g, " ").trim().length;
  }

  function positionCounter(el) {
    var r = el.getBoundingClientRect();
    counter.style.left = Math.max(8, r.left) + "px";
    counter.style.top = (r.top - 30) + "px";
  }

  function renderCounter(el) {
    var len = textLen(el);
    var max = parseInt(el.getAttribute("data-maxlen") || "0", 10);
    var label = el.getAttribute("data-label") || "Text";
    var over = max && len > max;
    counter.classList.toggle("is-over", !!over);
    counter.textContent = label + " · " + len + (max ? " / " + max : "") + " chars";
    positionCounter(el);
  }

  function showCounter(el) { counterFor = el; counter.classList.add("is-on"); renderCounter(el); }
  function hideCounter() { counterFor = null; counter.classList.remove("is-on"); }

  /* ---------- fit warnings ---------------------------------------- */
  // An element "doesn't fit" when its content is clipped horizontally
  // (a no-wrap pill/button/price whose text got too long) or when it
  // exceeds an author-declared max line count.
  function lineCount(el) {
    var cs = getComputedStyle(el);
    var lh = parseFloat(cs.lineHeight);
    if (!lh || isNaN(lh)) lh = parseFloat(cs.fontSize) * 1.2;
    return Math.round(el.scrollHeight / lh);
  }

  function evaluateFit() {
    // Skip while the canvas has no real width (initial paint / backgrounded
    // tab) — otherwise every wrapping line looks "overflowed" against 0px.
    if (!canvas || canvas.clientWidth < 40) return;
    var overCount = 0;
    editables.forEach(function (el) {
      var bad = false;
      // horizontal clip — only meaningful for elements that CAN'T wrap
      // (a pill / button / price). On wrapping text, content just flows to the
      // next line, and sub-pixel rounding of line widths caused false positives.
      var ws = getComputedStyle(el).whiteSpace;
      if ((ws === "nowrap" || ws === "pre") && el.scrollWidth - el.clientWidth > 2) bad = true;
      // declared max lines
      var ml = parseInt(el.getAttribute("data-maxlines") || "0", 10);
      if (ml && lineCount(el) > ml) bad = true;
      // declared max length (hard budget)
      var max = parseInt(el.getAttribute("data-maxlen") || "0", 10);
      if (max && textLen(el) > max) bad = true;
      el.classList.toggle("cs-over", bad);
      if (bad) overCount++;
    });
    var badge = document.querySelector("[data-warn-count]");
    if (badge) {
      badge.textContent = overCount ? overCount + " over" : "All fit";
      badge.classList.toggle("is-bad", overCount > 0);
    }
  }

  /* ---------- editing events -------------------------------------- */
  editables.forEach(function (el) {
    el.addEventListener("focus", function () { showCounter(el); });
    el.addEventListener("blur", function () { hideCounter(); saveAll(); evaluateFit(); });
    el.addEventListener("input", function () {
      if (!trackedEdit) { trackedEdit = true; if (window.csTrack) window.csTrack("edit-" + SURFACE); }
      if (counterFor === el) renderCounter(el);
      evaluateFit();
    });
    // keep it plain text: strip formatting on paste
    el.addEventListener("paste", function (e) {
      e.preventDefault();
      var t = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, t);
    });
    // single-line fields: Enter commits instead of inserting a break
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && el.hasAttribute("data-single")) {
        e.preventDefault();
        el.blur();
      }
    });
  });

  /* ---------- width control (presets + free resize) --------------- */
  var MAXW = 1440;
  function labelFor(w) {
    if (w < 768) return "Mobile";
    if (w < 1024) return "Tablet";
    return "Desktop";
  }
  function reportWidth() {
    var w = Math.round(canvas.getBoundingClientRect().width);
    var out = document.querySelector("[data-width-readout]");
    if (out) out.textContent = w + "px · " + labelFor(w);
    document.querySelectorAll("[data-preset]").forEach(function (b) {
      var p = b.getAttribute("data-preset");
      b.classList.toggle("is-active", p !== "full" && Math.abs(parseInt(p, 10) - w) < 2);
    });
    evaluateFit();
    if (counterFor) positionCounter(counterFor);
  }

  function setWidth(px) {
    if (px === "full") { wrap.style.width = "100%"; }
    else { wrap.style.width = Math.min(px, MAXW) + "px"; }
    reportWidth();
  }

  document.querySelectorAll("[data-preset]").forEach(function (b) {
    b.addEventListener("click", function () {
      var p = b.getAttribute("data-preset");
      setWidth(p === "full" ? "full" : parseInt(p, 10));
    });
  });

  // drag-to-resize handle
  var handle = document.querySelector("[data-resize]");
  if (handle) {
    var dragging = false, startX = 0, startW = 0;
    handle.addEventListener("pointerdown", function (e) {
      dragging = true; startX = e.clientX; startW = wrap.getBoundingClientRect().width;
      handle.setPointerCapture(e.pointerId);
      document.body.classList.add("cs-resizing");
    });
    handle.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var w = Math.max(320, Math.min(MAXW, startW + (e.clientX - startX) * 2));
      wrap.style.width = w + "px";
      reportWidth();
    });
    handle.addEventListener("pointerup", function (e) {
      dragging = false; document.body.classList.remove("cs-resizing");
    });
  }

  window.addEventListener("resize", reportWidth);

  /* ---------- warnings toggle ------------------------------------- */
  var warnToggle = document.querySelector("[data-toggle-warnings]");
  if (warnToggle) {
    var applyWarn = function () {
      body.classList.toggle("cs-show-warnings", warnToggle.checked);
      evaluateFit();
    };
    warnToggle.addEventListener("change", applyWarn);
    applyWarn();
  }

  /* ---------- reset ----------------------------------------------- */
  var resetBtn = document.querySelector("[data-reset]");
  if (resetBtn) {
    // Two-step inline confirm — no native confirm() dialog, since sandboxed
    // preview frames silently block those (the click would appear to do nothing).
    var resetLabel = resetBtn.querySelector("[data-reset-label]");
    var resetDefault = resetLabel ? resetLabel.textContent : "Reset copy";
    var armed = false, armTimer = null;
    var disarm = function () {
      armed = false; resetBtn.classList.remove("cs-armed");
      if (resetLabel) resetLabel.textContent = resetDefault;
    };
    resetBtn.addEventListener("click", function () {
      if (!armed) {
        armed = true; resetBtn.classList.add("cs-armed");
        if (resetLabel) resetLabel.textContent = "Click again to confirm";
        clearTimeout(armTimer); armTimer = setTimeout(disarm, 3500);
        return;
      }
      clearTimeout(armTimer); disarm();
      editables.forEach(function (el) { el.innerHTML = el.getAttribute("data-default"); });
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      hideCounter();
      evaluateFit();
    });
  }

  /* ---------- PNG export ------------------------------------------ */
  var dlBtn = document.querySelector("[data-download]");
  if (dlBtn) {
    dlBtn.addEventListener("click", function () {
      var w = Math.round(canvas.getBoundingClientRect().width);
      // Optional [data-export] limits the shot to one element on a transparent
      // background (e.g. the paywall card alone); default is the whole canvas.
      var exportEl = document.querySelector("[data-export]") || canvas;
      var transparent = exportEl !== canvas;
      dlBtn.disabled = true;
      var restoreLabel = dlBtn.textContent;
      dlBtn.textContent = "Rendering…";
      body.classList.add("cs-capturing"); // hides carets/outlines via CSS
      hideCounter();

      var run = function () {
        html2canvas(exportEl, {
          backgroundColor: transparent ? null : "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
        }).then(function (cnv) {
          var a = document.createElement("a");
          a.download = "scmp-" + SURFACE + "-" + w + "px.png";
          a.href = cnv.toDataURL("image/png");
          a.click();
          if (window.csTrack) window.csTrack("png-" + SURFACE);
        }).catch(function (err) {
          alert("Sorry — export failed: " + err.message);
        }).then(function () {
          body.classList.remove("cs-capturing");
          dlBtn.disabled = false;
          dlBtn.textContent = restoreLabel;
        });
      };

      if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
      else run();
    });
  }

  /* ---------- boot ------------------------------------------------ */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(reportWidth);
  }
  reportWidth();
  evaluateFit();
})();
