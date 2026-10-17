(function () {
  "use strict";
  var CFG = window.QUIZ_CONFIG;
  var LS_BEST = "golfquiz.best.v1", LS_BAND = "golfquiz.band.v1";
  var bank = null, topics = {}, quiz = [], idx = 0, score = 0, wrong = [], band = null, answered = false;

  function $(id) { return document.getElementById(id); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function show(name) { ["start", "quiz", "result"].forEach(function (s) { $("screen-" + s).hidden = s !== name; }); window.scrollTo(0, 0); }
  function load(key, def) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  // Výběr otázek podle hendikepového pásma: rozdělení podle obtížnosti, chybějící se doplní z nejbližší obtížnosti.
  function pickQuestions(all, mix, n) {
    n = Math.min(n, all.length);
    var pools = { 1: [], 2: [], 3: [] };
    shuffle(all).forEach(function (q) { (pools[q.difficulty] || pools[2]).push(q); });
    var want = { 1: Math.round(mix[1] * n), 2: Math.round(mix[2] * n), 3: 0 };
    want[3] = n - want[1] - want[2];
    var out = [];
    [1, 2, 3].forEach(function (d) { out = out.concat(pools[d].splice(0, Math.max(0, want[d]))); });
    var order = mix[3] >= mix[1] ? [3, 2, 1] : [1, 2, 3];
    while (out.length < n) { for (var k = 0; k < order.length && out.length < n; k++) { if (pools[order[k]].length) out.push(pools[order[k]].shift()); } }
    return shuffle(out);
  }

  function renderBands() {
    var saved = load(LS_BAND, CFG.bands[0].id), box = $("hcp-options");
    box.innerHTML = "";
    CFG.bands.forEach(function (b) {
      var l = document.createElement("label"); l.className = "hcp-opt";
      l.innerHTML = '<input type="radio" name="hcp" value="' + b.id + '"' + (b.id === saved ? " checked" : "") + '><span>' + b.label + "</span>";
      box.appendChild(l);
    });
  }

  function renderBest() {
    var best = load(LS_BEST, null);
    $("best").textContent = best ? "Nejlepší výsledek: " + best.score + "/" + best.total + " (" + best.pct + " %, " + best.band + ")" : "";
  }

  function start() {
    var sel = document.querySelector('input[name="hcp"]:checked');
    band = CFG.bands.filter(function (b) { return b.id === (sel ? sel.value : CFG.bands[0].id); })[0];
    save(LS_BAND, band.id);
    quiz = pickQuestions(bank, band.mix, CFG.quizLength).map(function (q) {
      var opts = q.options.map(function (t, i) { return { t: t, ok: i === q.answer }; });
      return { q: q, opts: shuffle(opts) };
    });
    idx = 0; score = 0; wrong = [];
    show("quiz"); renderQuestion();
  }

  function renderQuestion() {
    var item = quiz[idx]; answered = false;
    $("q-counter").textContent = "Otázka " + (idx + 1) + " / " + quiz.length;
    $("q-topic").textContent = topics[item.q.topic] || item.q.topic;
    $("progress-bar").style.width = (idx / quiz.length * 100) + "%";
    $("q-text").textContent = item.q.question;
    var box = $("q-options"); box.innerHTML = "";
    item.opts.forEach(function (o, i) {
      var b = document.createElement("button"); b.className = "opt"; b.type = "button";
      b.innerHTML = '<span class="key">' + "ABCD"[i] + "</span><span></span>";
      b.lastChild.textContent = o.t;
      b.addEventListener("click", function () { answer(i); });
      box.appendChild(b);
    });
    $("feedback").hidden = true; $("btn-next").hidden = true;
  }

  function answer(i) {
    if (answered) return; answered = true;
    var item = quiz[idx], btns = $("q-options").children, ok = item.opts[i].ok;
    for (var k = 0; k < btns.length; k++) {
      btns[k].disabled = true;
      if (item.opts[k].ok) btns[k].classList.add("correct");
      else if (k === i) btns[k].classList.add("wrong");
    }
    if (ok) score++; else wrong.push({ item: item, chosen: item.opts[i].t });
    $("fb-title").textContent = ok ? "Správně" : "Špatně";
    $("feedback").className = "feedback " + (ok ? "ok" : "bad");
    $("fb-text").textContent = item.q.explanation;
    $("fb-rule").textContent = item.q.rule;
    $("feedback").hidden = false;
    $("btn-next").textContent = idx === quiz.length - 1 ? "Zobrazit výsledek" : "Další otázka";
    $("btn-next").hidden = false; $("btn-next").focus();
  }

  function next() { if (idx < quiz.length - 1) { idx++; renderQuestion(); } else finish(); }

  function finish() {
    var total = quiz.length, pct = Math.round(score / total * 100), passed = score / total >= CFG.passThreshold;
    $("r-title").textContent = passed ? "Prošel jsi 🎉" : "Tentokrát to nevyšlo";
    $("r-score").textContent = score + " / " + total;
    $("r-pct").textContent = pct + " %";
    $("r-band").textContent = "Hendikepové pásmo: " + band.label;
    $("r-threshold").textContent = Math.round(CFG.passThreshold * 100);
    var best = load(LS_BEST, null);
    if (!best || pct > best.pct) save(LS_BEST, { score: score, total: total, pct: pct, band: band.label });
    $("r-wrong-title").textContent = wrong.length ? "Kde jsi chyboval" : "Bez jediné chyby!";
    var box = $("r-wrong"); box.innerHTML = "";
    wrong.forEach(function (w) {
      var d = document.createElement("div"); d.className = "review";
      var correct = w.item.opts.filter(function (o) { return o.ok; })[0].t;
      d.innerHTML = '<p class="rq"></p><p class="rbad">✗ <span></span></p><p class="rok">✓ <span></span></p><p class="rexp"></p><p class="rule">📖 <span></span></p>';
      d.querySelector(".rq").textContent = w.item.q.question;
      d.querySelector(".rbad span").textContent = w.chosen;
      d.querySelector(".rok span").textContent = correct;
      d.querySelector(".rexp").textContent = w.item.q.explanation;
      d.querySelector(".rule span").textContent = w.item.q.rule;
      box.appendChild(d);
    });
    $("progress-bar").style.width = "100%";
    show("result"); renderBest();
  }

  function initAds() {
    if (!CFG.features.ads) return; // Zatím vypnuto. Později: načíst skript poskytovatele a zobrazit sloty.
    Array.prototype.forEach.call(document.querySelectorAll(".ad-slot"), function (el) { el.hidden = false; });
  }

  $("btn-start").addEventListener("click", start);
  $("btn-next").addEventListener("click", next);
  $("btn-restart").addEventListener("click", start);
  $("btn-home").addEventListener("click", function () { show("start"); });

  renderBands(); renderBest(); initAds();
  $("btn-start").disabled = true;
  fetch(CFG.questionsUrl).then(function (r) { return r.json(); }).then(function (data) {
    bank = data.questions; topics = data.topics || {};
    $("btn-start").disabled = false;
  }).catch(function () { $("best").textContent = "Nepodařilo se načíst otázky. Zkus stránku obnovit."; });

  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
