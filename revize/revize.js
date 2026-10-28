// Revize otázek: projdi všechny otázky, označ OK / Opravit a napiš poznámku. Vše se ukládá do localStorage.
(function () {
  "use strict";
  var LS = "golfquiz.revize.v1";
  var DIFF = { 1: "lehká", 2: "střední", 3: "záludná" };
  var RULE_NAMES = { 1: "Základy hry a chování", 2: "Hřiště", 3: "Soutěž", 4: "Výstroj", 5: "Hraní kola", 6: "Hraní jamky",
    7: "Hledání míče", 8: "Hřiště hraj, jak je", 9: "Míč hraj, jak leží", 10: "Příprava na ránu, rada a nosič",
    11: "Míč v pohybu zasáhne osobu nebo věc", 12: "Bankry", 13: "Jamkoviště", 14: "Postupy při úlevě (dropnutí)",
    15: "Volné přírodní předměty a pohyblivé překážky", 16: "Abnormální stav hřiště a zabořený míč", 17: "Trestné oblasti",
    18: "Ztracený míč, mimo hřiště, provizorní míč", 19: "Nehratelný míč", 20: "Spory a rozhodnutí", 21: "Jiné formy hry na rány",
    22: "Čtyřhra", 23: "Čtyřmíčová hra", 24: "Družstva", 25: "Hráči se zdravotním postižením" };

  var bank = [], byId = {}, topics = {}, order = [], cur = null, revealed = {}, picked = {}, saveTimer = null;
  var st = load();

  function $(id) { return document.getElementById(id); }
  function load() {
    var d; try { d = JSON.parse(localStorage.getItem(LS)); } catch (e) {}
    d = d && typeof d === "object" ? d : {};
    d.items = d.items || {}; d.f = d.f || { rule: "", topic: "", status: "", sort: "rule" }; d.guess = !!d.guess;
    return d;
  }
  function persist() { try { localStorage.setItem(LS, JSON.stringify(st)); return true; } catch (e) { return false; } }

  function hash(q) {
    var s = [q.question, q.options.join("|"), q.answer, q.explanation].join("#"), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function ruleKey(r) {
    if (/^Definice/.test(r)) return { g: 99, k: [99, 0, 0, 0], label: "Definice" };
    var m = r.match(/(\d+)(?:\.(\d+))?([a-z])?(?:\((\d+)\))?/);
    if (!m) return { g: 98, k: [98, 0, 0, 0], label: "Ostatní" };
    var n = +m[1];
    return { g: n, k: [n, +(m[2] || 0), m[3] ? m[3].charCodeAt(0) : 0, +(m[4] || 0)], label: "Pravidlo " + n + (RULE_NAMES[n] ? " – " + RULE_NAMES[n] : "") };
  }
  function cmpKey(a, b) { for (var i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }

  function rec(id) { return st.items[id] || { s: "", c: "" }; }
  function isDone(id) { var r = rec(id); return !!(r.s || (r.c && r.c.trim())); }
  function hasNote(id) { var r = rec(id); return !!(r.c && r.c.trim()); }
  function isChanged(q) { var r = st.items[q.id]; return !!(r && r.h && isDone(q.id) && r.h !== hash(q)); }
  function setRec(id, patch) {
    var r = st.items[id] || { s: "", c: "" };
    for (var k in patch) r[k] = patch[k];
    r.t = Date.now(); r.h = hash(byId[id]);
    st.items[id] = r; var ok = persist();
    var now = new Date();
    $("saved").textContent = ok ? "Uloženo ✓ " + now.getHours() + ":" + ("0" + now.getMinutes()).slice(-2) : "Uložení se nepovedlo (plné úložiště?)";
    updateCounts();
  }

  function updateCounts() {
    var done = 0, ok = 0, fix = 0;
    bank.forEach(function (q) { if (isDone(q.id)) done++; var s = rec(q.id).s; if (s === "ok") ok++; if (s === "fix") fix++; });
    $("cnt-done").textContent = done + " / " + bank.length;
    $("cnt-ok").textContent = ok; $("cnt-fix").textContent = fix;
    $("progress-bar").style.width = (bank.length ? done / bank.length * 100 : 0) + "%";
  }

  // ---------- Seznam ----------
  function filtered() {
    var f = st.f;
    var list = bank.filter(function (q) {
      if (f.rule && String(q._rk.g) !== f.rule) return false;
      if (f.topic && q.topic !== f.topic) return false;
      var r = rec(q.id);
      if (f.status === "todo" && isDone(q.id)) return false;
      if (f.status === "fix" && r.s !== "fix") return false;
      if (f.status === "ok" && r.s !== "ok") return false;
      if (f.status === "note" && !hasNote(q.id)) return false;
      if (f.status === "changed" && !isChanged(q)) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (f.sort === "id") return a.id < b.id ? -1 : 1;
      if (f.sort === "topic") { var ta = topics[a.topic] || a.topic, tb = topics[b.topic] || b.topic; if (ta !== tb) return ta.localeCompare(tb, "cs"); }
      return cmpKey(a._rk.k, b._rk.k) || (a.id < b.id ? -1 : 1);
    });
    return list;
  }

  function fillFilters() {
    var groups = {}, rs = $("f-rule"), ts = $("f-topic");
    bank.forEach(function (q) { groups[q._rk.g] = groups[q._rk.g] || { label: q._rk.label, n: 0 }; groups[q._rk.g].n++; });
    rs.innerHTML = ""; addOpt(rs, "", "Všechna pravidla");
    Object.keys(groups).map(Number).sort(function (a, b) { return a - b; }).forEach(function (g) { addOpt(rs, String(g), groups[g].label + " (" + groups[g].n + ")"); });
    ts.innerHTML = ""; addOpt(ts, "", "Všechna témata");
    Object.keys(topics).forEach(function (t) { addOpt(ts, t, topics[t]); });
    rs.value = st.f.rule; ts.value = st.f.topic; $("f-status").value = st.f.status; $("f-sort").value = st.f.sort || "rule";
    if (rs.value !== st.f.rule) st.f.rule = rs.value;
    if (ts.value !== st.f.topic) st.f.topic = ts.value;
  }
  function addOpt(sel, v, t) { var o = document.createElement("option"); o.value = v; o.textContent = t; sel.appendChild(o); }

  function renderList() {
    var list = filtered(), box = $("list"), lastGroup = null;
    box.innerHTML = "";
    $("list-info").textContent = list.length === bank.length ? "Zobrazeno všech " + list.length + " otázek." : "Zobrazeno " + list.length + " z " + bank.length + " otázek.";
    list.forEach(function (q) {
      var g = st.f.sort === "topic" ? (topics[q.topic] || q.topic) : st.f.sort === "id" ? null : q._rk.label;
      if (g && g !== lastGroup) { var h = document.createElement("h3"); h.className = "rv-group"; h.textContent = g; box.appendChild(h); lastGroup = g; }
      var r = rec(q.id), b = document.createElement("button");
      b.type = "button"; b.className = "rv-row " + (r.s || ""); b.dataset.id = q.id;
      b.innerHTML = '<span class="mk"></span><span class="tx"><span class="id"></span><span class="qq"></span></span>';
      b.querySelector(".mk").textContent = r.s === "ok" ? "✓" : r.s === "fix" ? "✎" : hasNote(q.id) ? "✎" : "";
      b.querySelector(".id").textContent = q.id + " · " + q.rule + (isChanged(q) ? " · změněno" : "");
      b.querySelector(".qq").textContent = q.question;
      if (hasNote(q.id)) { var c = document.createElement("span"); c.className = "cm"; c.textContent = "💬 " + r.c; b.querySelector(".tx").appendChild(c); }
      b.addEventListener("click", function () { order = list.map(function (x) { return x.id; }); go(q.id); });
      box.appendChild(b);
    });
  }

  // ---------- Detail ----------
  function renderQ(id) {
    var q = byId[id]; cur = id;
    if (order.indexOf(id) < 0) order = filtered().map(function (x) { return x.id; }).indexOf(id) >= 0 ? filtered().map(function (x) { return x.id; }) : sortedAll();
    st.last = id; persist();
    var pos = order.indexOf(id);
    $("q-pos").textContent = (pos + 1) + " / " + order.length + (order.length !== bank.length ? " (filtr)" : "");
    $("q-id").textContent = q.id;
    $("q-topic").textContent = topics[q.topic] || q.topic;
    $("q-rule").textContent = q.rule;
    $("q-diff").textContent = (DIFF[q.difficulty] || ("obtížnost " + q.difficulty)) + (q.weight > 1 ? " · ★ častěji v testu" : "");
    $("q-changed").hidden = !isChanged(q);
    setImg($("q-img"), q.image, q.imageAlt);
    $("q-text").textContent = q.question;
    $("t-guess").checked = st.guess;
    renderOptions(q);
    var r = rec(id);
    $("comment").value = r.c || "";
    $("saved").innerHTML = "&nbsp;";
    paintStatus(r.s);
    $("btn-prev").disabled = pos <= 0;
    $("btn-next").disabled = pos >= order.length - 1;
    window.scrollTo(0, 0);
  }
  function lbl(q, i) { return q.options.length === 2 ? "„" + q.options[i] + "“" : "ABCD"[i]; }
  function setImg(el, src, alt) { if (src) { el.src = "../" + src; el.alt = alt || ""; el.hidden = false; } else { el.hidden = true; el.removeAttribute("src"); } }

  function renderOptions(q) {
    var show = !st.guess || revealed[q.id], box = $("q-options");
    box.innerHTML = ""; box.className = "options n" + q.options.length;
    q.options.forEach(function (t, i) {
      var b = document.createElement("button"); b.type = "button"; b.className = "opt";
      b.innerHTML = '<span class="key">' + "ABCD"[i] + "</span><span></span>";
      b.lastChild.textContent = t;
      if (show) {
        b.disabled = true;
        if (i === q.answer) b.classList.add("correct");
        else if (picked[q.id] === i) b.classList.add("wrong");
        else b.classList.add("dim");
      } else b.addEventListener("click", function () { picked[q.id] = i; revealed[q.id] = true; renderOptions(q); });
      box.appendChild(b);
    });
    $("btn-reveal").hidden = show;
    var fb = $("feedback");
    if (show) {
      var p = picked[q.id], guessed = st.guess && p != null;
      fb.className = "feedback " + (guessed && p !== q.answer ? "bad" : "ok");
      $("fb-title").textContent = guessed ? (p === q.answer ? "Správně" : "Špatně – správně je " + lbl(q, q.answer)) : "Správná odpověď: " + lbl(q, q.answer);
      $("fb-text").textContent = q.explanation;
      setImg($("fb-img"), q.explanationImage, q.explanationImageAlt);
      fb.hidden = false;
    } else fb.hidden = true;
  }
  function paintStatus(s) { $("s-ok").classList.toggle("on", s === "ok"); $("s-fix").classList.toggle("on", s === "fix"); }
  function setStatus(s) { flushComment(); var r = rec(cur); var ns = r.s === s ? "" : s; setRec(cur, { s: ns }); paintStatus(ns); }
  function flushComment() {
    if (!cur || !saveTimer) return;
    clearTimeout(saveTimer); saveTimer = null;
    var c = $("comment").value, r = rec(cur), patch = { c: c };
    if (c.trim() && !r.s) { patch.s = "fix"; paintStatus("fix"); }
    setRec(cur, patch);
  }
  function sortedAll() { return bank.slice().sort(function (a, b) { return cmpKey(a._rk.k, b._rk.k) || (a.id < b.id ? -1 : 1); }).map(function (q) { return q.id; }); }
  function nextTodo() {
    flushComment();
    var start = cur ? order.indexOf(cur) : -1, n = order.length;
    for (var k = 1; k <= n; k++) { var id = order[(start + k + n) % n]; if (id && !isDone(id)) return go(id); }
    var all = sortedAll();
    for (var i = 0; i < all.length; i++) if (!isDone(all[i])) { order = all; return go(all[i]); }
    alert("Všechny otázky jsou zkontrolované 🎉 Teď pošli poznámky.");
  }

  // ---------- Export / import ----------
  function exportItems() { return sortedAll().filter(function (id) { return rec(id).s === "fix" || hasNote(id); }); }
  function exportText() {
    var ids = exportItems(), d = new Date(), done = bank.filter(function (q) { return isDone(q.id); }).length;
    var ok = bank.filter(function (q) { return rec(q.id).s === "ok"; }).length;
    var out = ["Poznámky k otázkám golfového kvízu", "Datum: " + d.getDate() + ". " + (d.getMonth() + 1) + ". " + d.getFullYear(),
      "Zkontrolováno: " + done + "/" + bank.length + " · OK: " + ok + " · K opravě / s poznámkou: " + ids.length, ""];
    if (!ids.length) out.push("Zatím žádná otázka k opravě ani poznámka.");
    ids.forEach(function (id) {
      var q = byId[id], r = rec(id);
      out.push("[" + id + "] " + q.rule + (r.s === "fix" ? " · OPRAVIT" : r.s === "ok" ? " · OK, jen poznámka" : ""));
      out.push("Otázka: " + q.question);
      out.push("Správně (" + "ABCD"[q.answer] + "): " + q.options[q.answer]);
      out.push("Poznámka: " + (r.c && r.c.trim() ? r.c.trim() : "(bez poznámky)"));
      out.push("");
    });
    return out.join("\n");
  }
  function exportJson() {
    var items = {};
    Object.keys(st.items).forEach(function (id) { var r = st.items[id]; if (r.s || (r.c && r.c.trim())) { items[id] = { s: r.s || "", c: r.c || "", t: r.t || 0, h: r.h || "", otazka: byId[id] ? byId[id].question : "" }; } });
    return JSON.stringify({ app: "golf-kviz-revize", version: 1, exported: new Date().toISOString(), items: items }, null, 1);
  }
  function stamp() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function download(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type })), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function copy(text) {
    var done = function () { $("copy-info").textContent = "Zkopírováno ✓ Vlož to Golfisovi do chatu."; };
    var fallback = function () { var t = $("export-text"); t.removeAttribute("readonly"); t.select(); t.setSelectionRange(0, 1e6); try { document.execCommand("copy"); done(); } catch (e) { $("copy-info").textContent = "Kopírování se nepovedlo, označ text ručně."; } t.setAttribute("readonly", ""); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function importFile(file) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var d = JSON.parse(fr.result), items = d.items || d, n = 0;
        Object.keys(items).forEach(function (id) {
          var inc = items[id]; if (!inc || typeof inc !== "object" || !/^q\d+$/.test(id)) return;
          var mine = st.items[id];
          if (!mine || (inc.t || 0) > (mine.t || 0)) { st.items[id] = { s: inc.s === "ok" || inc.s === "fix" ? inc.s : "", c: String(inc.c || ""), t: inc.t || Date.now(), h: inc.h || "" }; n++; }
        });
        persist(); updateCounts(); $("export-text").value = exportText();
        $("import-info").textContent = "Načteno ✓ Aktualizováno: " + n + (n === 1 ? " otázka." : n >= 2 && n <= 4 ? " otázky." : " otázek.");
      } catch (e) { $("import-info").textContent = "Tohle není platná záloha (.json)."; }
    };
    fr.readAsText(file);
  }

  // ---------- Router ----------
  function showView(v) { ["list", "q", "export"].forEach(function (n) { $("view-" + n).hidden = n !== v; }); }
  function go(id) { location.hash = id; }
  function route() {
    flushComment();
    var h = decodeURIComponent(location.hash.slice(1));
    if (h === "export") { $("export-text").value = exportText(); $("copy-info").innerHTML = "&nbsp;"; showView("export"); window.scrollTo(0, 0); }
    else if (byId[h]) { showView("q"); renderQ(h); }
    else { cur = null; showView("list"); renderList(); }
  }

  // ---------- Události ----------
  ["rule", "topic", "status", "sort"].forEach(function (k) {
    $("f-" + k).addEventListener("change", function (e) { st.f[k] = e.target.value; persist(); renderList(); });
  });
  $("btn-list").addEventListener("click", function () { flushComment(); location.hash = "seznam"; });
  $("btn-prev").addEventListener("click", function () { var i = order.indexOf(cur); if (i > 0) go(order[i - 1]); });
  $("btn-next").addEventListener("click", function () { var i = order.indexOf(cur); if (i < order.length - 1) go(order[i + 1]); });
  $("btn-next-todo").addEventListener("click", nextTodo);
  $("btn-next-todo-list").addEventListener("click", function () { order = filtered().map(function (q) { return q.id; }); if (!order.length) order = sortedAll(); cur = null; nextTodo(); });
  $("t-guess").addEventListener("change", function (e) { st.guess = e.target.checked; persist(); if (cur) renderOptions(byId[cur]); });
  $("btn-reveal").addEventListener("click", function () { revealed[cur] = true; renderOptions(byId[cur]); });
  $("s-ok").addEventListener("click", function () { setStatus("ok"); });
  $("s-fix").addEventListener("click", function () { setStatus("fix"); });
  $("comment").addEventListener("input", function () { clearTimeout(saveTimer); saveTimer = setTimeout(flushComment, 400); $("saved").textContent = "Ukládám…"; });
  $("comment").addEventListener("blur", flushComment);
  window.addEventListener("pagehide", flushComment);
  document.addEventListener("visibilitychange", function () { if (document.hidden) flushComment(); });
  $("btn-export").addEventListener("click", function () { flushComment(); location.hash = "export"; });
  $("btn-export-back").addEventListener("click", function () { history.length > 1 ? history.back() : (location.hash = "seznam"); });
  if (navigator.share) $("btn-share").hidden = false;
  $("btn-share").addEventListener("click", function () { navigator.share({ title: "Poznámky ke golfovému kvízu", text: exportText() }).catch(function () {}); });
  $("btn-copy").addEventListener("click", function () { copy(exportText()); });
  $("btn-dl-txt").addEventListener("click", function () { download("golf-kviz-poznamky-" + stamp() + ".txt", exportText(), "text/plain;charset=utf-8"); });
  $("btn-dl-json").addEventListener("click", function () { download("golf-kviz-revize-" + stamp() + ".json", exportJson(), "application/json"); });
  $("import-file").addEventListener("change", function (e) { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; });
  $("btn-reset").addEventListener("click", function () {
    if (!confirm("Opravdu smazat všechny tvoje kontroly a poznámky? Nejdřív si radši stáhni zálohu.")) return;
    st.items = {}; persist(); updateCounts(); $("export-text").value = exportText(); $("import-info").textContent = "Smazáno.";
  });
  window.addEventListener("hashchange", route);

  fetch("../data/questions.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (data) {
    bank = data.questions || []; topics = data.topics || {};
    bank.forEach(function (q) { byId[q.id] = q; q._rk = ruleKey(q.rule || ""); });
    $("loading").hidden = true;
    fillFilters(); updateCounts();
    if (!location.hash && st.last && byId[st.last]) { order = filtered().map(function (q) { return q.id; }); }
    route();
  }).catch(function () { $("loading").textContent = "Nepodařilo se načíst otázky. Zkontroluj připojení a obnov stránku."; });
})();
