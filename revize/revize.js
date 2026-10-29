// Revize otázek: projdi všechny otázky, označ OK / Opravit a napiš poznámku. Vše se ukládá do localStorage.
(function () {
  "use strict";
  var LS = "golfquiz.revize.v1";
  // Oficiální PDF Pravidel golfu 2023 (ČGF). Obrázky z pravidel do repa nedáváme (autorská práva), jen odkaz na stránku.
  var RULES_PDF = "http://fls.cgf.cz/DBFL/CGSRedaction/Documents/Pravidla%20golfu%202023%20-%20v230508.pdf";
  // Kola revize: data každého kola zůstávají v localStorage. Aktivní kolo je nejméně MIN_ROUND (nové kolo po zapracování poznámek).
  var MIN_ROUND = 2;
  var DIFF = { 1: "lehká", 2: "střední", 3: "záludná" };
  var RULE_NAMES = { 1: "Základy hry a chování", 2: "Hřiště", 3: "Soutěž", 4: "Výstroj", 5: "Hraní kola", 6: "Hraní jamky",
    7: "Hledání míče", 8: "Hřiště hraj, jak je", 9: "Míč hraj, jak leží", 10: "Příprava na ránu, rada a nosič",
    11: "Míč v pohybu zasáhne osobu nebo věc", 12: "Bankry", 13: "Jamkoviště", 14: "Postupy při úlevě (dropnutí)",
    15: "Volné přírodní předměty a pohyblivé překážky", 16: "Abnormální stav hřiště a zabořený míč", 17: "Trestné oblasti",
    18: "Ztracený míč, mimo hřiště, provizorní míč", 19: "Nehratelný míč", 20: "Spory a rozhodnutí", 21: "Jiné formy hry na rány",
    22: "Čtyřhra", 23: "Čtyřmíčová hra", 24: "Družstva", 25: "Hráči se zdravotním postižením" };

  var bank = [], byId = {}, topics = {}, order = [], cur = null, revealed = {}, picked = {}, saveTimer = null;
  var st = load();
  persist(); // uloží případnou migraci na kola revize

  function $(id) { return document.getElementById(id); }
  function load() {
    var d; try { d = JSON.parse(localStorage.getItem(LS)); } catch (e) {}
    d = d && typeof d === "object" ? d : {};
    d.f = d.f || { rule: "", topic: "", status: "", sort: "rule" }; d.guess = !!d.guess;
    if (!d.rounds || typeof d.rounds !== "object") {
      // Starý formát (jen d.items) = 1. kolo revize.
      d.rounds = {};
      if (d.items && Object.keys(d.items).length) d.rounds["1"] = { items: d.items, started: 0 };
    }
    delete d.items;
    var maxR = Math.max.apply(null, [0].concat(Object.keys(d.rounds).map(Number)));
    d.round = +d.round || 0;
    if (d.round < MIN_ROUND || !d.rounds[d.round]) d.round = Math.max(MIN_ROUND, maxR, d.round);
    if (!d.rounds[d.round]) { d.rounds[d.round] = { items: {}, started: Date.now() }; d.last = null; }
    Object.keys(d.rounds).forEach(function (k) { d.rounds[k].items = d.rounds[k].items || {}; });
    d.items = d.rounds[d.round].items;
    return d;
  }
  function persist() {
    var o = {}; Object.keys(st).forEach(function (k) { if (k !== "items") o[k] = st[k]; });
    try { localStorage.setItem(LS, JSON.stringify(o)); return true; } catch (e) { return false; }
  }
  function prevRounds() { return Object.keys(st.rounds).map(Number).filter(function (r) { return r !== st.round; }).sort(function (a, b) { return b - a; }); }
  function roundRec(r, id) { var it = st.rounds[r] && st.rounds[r].items[id]; return it && (it.s || (it.c && it.c.trim())) ? it : null; }
  function newRound() {
    flushComment();
    if (!confirm("Začít novou revizi č. " + (st.round + 1) + "? Kontroly a poznámky z revize č. " + st.round + " zůstanou uložené v sekci „Předchozí revize“ a půjdou dál exportovat.")) return;
    st.round = st.round + 1; st.rounds[st.round] = { items: {}, started: Date.now() }; st.items = st.rounds[st.round].items; st.last = null;
    persist(); updateCounts(); renderPrev(); location.hash = "seznam"; route();
  }

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
    $("cnt-round").textContent = "Revize " + st.round;
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
    renderPhoto(q);
    $("q-text").textContent = q.question;
    $("t-guess").checked = st.guess;
    renderOptions(q);
    var r = rec(id);
    $("comment").value = r.c || "";
    var pv = $("q-prev"); pv.innerHTML = "";
    prevRounds().forEach(function (rn) {
      var it = roundRec(rn, id); if (!it) return;
      var p = document.createElement("p"); p.textContent = "Revize " + rn + ": " + (it.s === "ok" ? "✓ OK" : "✎ Opravit") + (it.c && it.c.trim() ? " – " + it.c.trim() : "");
      pv.appendChild(p);
    });
    pv.hidden = !pv.firstChild;
    $("saved").innerHTML = "&nbsp;";
    paintStatus(r.s);
    $("btn-prev").disabled = pos <= 0;
    $("btn-next").disabled = pos >= order.length - 1;
    window.scrollTo(0, 0);
  }
  function renderPhoto(q) {
    var box = $("q-photo-box"), a = $("q-rules-fig");
    if (!q.photo) { box.hidden = true; return; }
    var im = $("q-photo"); im.src = "../" + q.photo; im.alt = "Ilustrační fotka k otázce " + q.id; box.hidden = false;
    if (q.rulesFigurePage) {
      a.href = RULES_PDF + "#page=" + q.rulesFigurePage;
      a.textContent = "Obrázek v pravidlech (str. " + q.rulesFigurePage + ")";
      a.title = q.rulesFigureTitle || ""; a.hidden = false; $("q-no-fig").hidden = true;
    } else { a.hidden = true; a.removeAttribute("href"); $("q-no-fig").hidden = false; }
  }
  function photoNote() {
    var c = $("comment");
    if (!/(^|\n)Fotka: /.test(c.value)) c.value = (c.value.trim() ? c.value.replace(/\s+$/, "") + "\n" : "") + "Fotka: ";
    c.focus(); c.setSelectionRange(c.value.length, c.value.length);
    c.dispatchEvent(new Event("input"));
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
  function exportItems(rn) { return sortedAll().filter(function (id) { var r = recIn(rn, id); return r.s === "fix" || (r.c && r.c.trim()); }); }
  function recIn(rn, id) { var it = st.rounds[rn] ? st.rounds[rn].items : {}; return it[id] || { s: "", c: "" }; }
  function exportText(rn) {
    rn = rn || st.round;
    var rec = function (id) { return recIn(rn, id); }, isDone = function (id) { var r = rec(id); return !!(r.s || (r.c && r.c.trim())); };
    var ids = exportItems(rn), d = new Date(), done = bank.filter(function (q) { return isDone(q.id); }).length;
    var ok = bank.filter(function (q) { return rec(q.id).s === "ok"; }).length;
    var out = ["Poznámky k otázkám golfového kvízu – revize č. " + rn + (rn !== st.round ? " (předchozí)" : ""), "Datum: " + d.getDate() + ". " + (d.getMonth() + 1) + ". " + d.getFullYear(),
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
  function exportJson(rn) {
    rn = rn || st.round;
    var items = {}, src = st.rounds[rn] ? st.rounds[rn].items : {};
    Object.keys(src).forEach(function (id) { var r = src[id]; if (r.s || (r.c && r.c.trim())) { items[id] = { s: r.s || "", c: r.c || "", t: r.t || 0, h: r.h || "", otazka: byId[id] ? byId[id].question : "" }; } });
    return JSON.stringify({ app: "golf-kviz-revize", version: 2, round: rn, exported: new Date().toISOString(), items: items }, null, 1);
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
        // Záloha nese číslo kola; starší zálohy bez čísla jsou z 1. kola.
        var rn = d.app === "golf-kviz-revize" ? (+d.round || 1) : st.round;
        if (!st.rounds[rn]) st.rounds[rn] = { items: {}, started: 0 };
        var tgt = st.rounds[rn].items;
        Object.keys(items).forEach(function (id) {
          var inc = items[id]; if (!inc || typeof inc !== "object" || !/^q\d+$/.test(id)) return;
          var mine = tgt[id];
          if (!mine || (inc.t || 0) > (mine.t || 0)) { tgt[id] = { s: inc.s === "ok" || inc.s === "fix" ? inc.s : "", c: String(inc.c || ""), t: inc.t || Date.now(), h: inc.h || "" }; n++; }
        });
        persist(); updateCounts(); renderPrev(); $("export-text").value = exportText();
        $("import-info").textContent = "Načteno do revize č. " + rn + (rn === st.round ? "" : " (předchozí)") + " ✓ Aktualizováno: " + n + (n === 1 ? " otázka." : n >= 2 && n <= 4 ? " otázky." : " otázek.");
      } catch (e) { $("import-info").textContent = "Tohle není platná záloha (.json)."; }
    };
    fr.readAsText(file);
  }

  // ---------- Předchozí revize ----------
  function renderPrev() {
    var box = $("prev-rounds"), list = $("prev-list"), rs = prevRounds();
    box.hidden = !rs.length; list.innerHTML = "";
    rs.forEach(function (rn) {
      var it = st.rounds[rn].items, ids = exportItems(rn), done = Object.keys(it).filter(function (id) { return roundRec(rn, id); }).length;
      var sec = document.createElement("div"); sec.className = "rv-prev-round"; sec.dataset.round = rn;
      var h = document.createElement("h4"); h.textContent = "Revize " + rn + " · zkontrolováno " + done + " · k opravě / s poznámkou " + ids.length; sec.appendChild(h);
      ids.forEach(function (id) {
        var r = it[id], p = document.createElement("p"); p.className = "rv-prev-item";
        var a = document.createElement("a"); a.href = "#" + id; a.textContent = id; p.appendChild(a);
        p.appendChild(document.createTextNode(" " + (r.s === "fix" ? "✎ " : r.s === "ok" ? "✓ " : "") + (r.c && r.c.trim() ? r.c.trim() : "(bez poznámky)")));
        sec.appendChild(p);
      });
      var b1 = document.createElement("button"); b1.type = "button"; b1.className = "btn"; b1.textContent = "Zkopírovat poznámky z revize " + rn;
      b1.addEventListener("click", function () { copy(exportText(rn)); b1.textContent = "Zkopírováno ✓"; });
      var b2 = document.createElement("button"); b2.type = "button"; b2.className = "btn"; b2.textContent = "Stáhnout zálohu revize " + rn + " (.json)";
      b2.addEventListener("click", function () { download("golf-kviz-revize" + rn + "-" + stamp() + ".json", exportJson(rn), "application/json"); });
      sec.appendChild(b1); sec.appendChild(b2); list.appendChild(sec);
    });
  }
  function renderChangelog() {
    fetch("changelog.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
      var box = $("changelog-list"); box.innerHTML = "";
      (d.entries || []).forEach(function (e) {
        var h = document.createElement("h4"); h.textContent = e.date + (e.title ? " – " + e.title : ""); box.appendChild(h);
        var ul = document.createElement("ul");
        (e.items || []).forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
        box.appendChild(ul);
      });
      $("changelog").hidden = false;
    }).catch(function () {});
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
    if (!confirm("Opravdu smazat všechny tvoje kontroly a poznámky z revize č. " + st.round + "? Předchozí revize zůstanou. Nejdřív si radši stáhni zálohu.")) return;
    st.items = st.rounds[st.round].items = {}; persist(); updateCounts(); $("export-text").value = exportText(); $("import-info").textContent = "Smazáno.";
  });
  $("btn-photo-note").addEventListener("click", photoNote);
  $("btn-new-round").addEventListener("click", newRound);
  window.addEventListener("hashchange", route);

  fetch("../data/questions.json", { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (data) {
    bank = data.questions || []; topics = data.topics || {};
    bank.forEach(function (q) { byId[q.id] = q; q._rk = ruleKey(q.rule || ""); });
    $("loading").hidden = true;
    fillFilters(); updateCounts(); renderPrev(); renderChangelog();
    if (!location.hash && st.last && byId[st.last]) { order = filtered().map(function (q) { return q.id; }); }
    route();
  }).catch(function () { $("loading").textContent = "Nepodařilo se načíst otázky. Zkontroluj připojení a obnov stránku."; });
})();
