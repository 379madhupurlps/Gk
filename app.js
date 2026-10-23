(function () {
  const $ = (s) => document.querySelector(s);
  const COLORS = ["#6c3df4", "#f43f8e", "#1fa45a", "#f59e0b", "#0ea5e9", "#ef4444", "#14b8a6", "#8b5cf6", "#84cc16", "#f97316"];
  const LS_USED = "gkquiz_used";
  const LS_EXTRA = "gkquiz_extra";

  // ---------- প্ৰশ্ন ভাণ্ডাৰ ----------
  let extra = [];
  try { extra = JSON.parse(localStorage.getItem(LS_EXTRA) || "[]"); } catch (e) {}
  const ALL = [...window.QUESTIONS, ...extra];

  const getUsed = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_USED) || "[]")); } catch (e) { return new Set(); } };
  const saveUsed = (set) => { try { localStorage.setItem(LS_USED, JSON.stringify([...set])); } catch (e) {} };

  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- অৱস্থা ----------
  let S = null; // খেলৰ অৱস্থা
  let timer = null, paused = false;

  function show(id) {
    ["setup", "game", "end"].forEach((x) => $("#" + x).classList.toggle("hidden", x !== id));
    window.scrollTo(0, 0);
  }

  // ---------- সেটআপ ----------
  function renderNames() {
    const n = Math.max(2, Math.min(10, +$("#groupCount").value || 2));
    const box = $("#groupNames");
    const old = [...box.querySelectorAll("input")].map((i) => i.value);
    box.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const l = document.createElement("label");
      l.textContent = "দল " + (i + 1);
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = old[i] || "দল " + (i + 1);
      l.appendChild(inp);
      box.appendChild(l);
    }
  }

  function renderCats() {
    const counts = {};
    ALL.forEach((q) => { counts[q.c || "সাধাৰণ"] = (counts[q.c || "সাধাৰণ"] || 0) + 1; });
    const box = $("#cats");
    box.innerHTML = "";
    Object.keys(counts).forEach((c) => {
      const l = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox"; cb.value = c; cb.checked = true;
      cb.addEventListener("change", updatePoolInfo);
      l.appendChild(cb);
      l.appendChild(document.createTextNode(" " + c + " (" + counts[c] + ")"));
      box.appendChild(l);
    });
    updatePoolInfo();
  }

  function selectedCats() { return [...document.querySelectorAll("#cats input:checked")].map((i) => i.value); }

  function buildPool() {
    const cats = selectedCats();
    const used = $("#noRepeat").checked ? getUsed() : new Set();
    const pool = [];
    ALL.forEach((q, i) => { if (cats.includes(q.c || "সাধাৰণ") && !used.has(i)) pool.push(i); });
    return pool;
  }

  function updatePoolInfo() {
    $("#poolInfo").textContent = "মুঠ প্ৰশ্ন: " + ALL.length + " • এতিয়া উপলব্ধ: " + buildPool().length;
  }

  // ---------- খেল আৰম্ভ ----------
  function start() {
    const names = [...document.querySelectorAll("#groupNames input")].map((i) => i.value.trim() || "দল");
    const pool = shuffle(buildPool());
    if (!pool.length) { alert("কোনো প্ৰশ্ন উপলব্ধ নাই। বিষয় বাছনি কৰক বা সোধা প্ৰশ্নৰ তালিকা মচক।"); return; }
    const count = Math.min(pool.length, Math.max(1, +$("#qCount").value || 10));
    S = {
      groups: names.map((n) => ({ name: n, score: 0 })),
      time: Math.max(5, +$("#timeLimit").value || 30),
      full: +$("#fullMarks").value || 0,
      pass: +$("#passMarks").value || 0,
      pool: pool.slice(0, count),
      i: 0, start: 0, cur: 0, tried: 0, done: false, left: 0
    };
    show("game");
    showQ();
  }

  function showQ() {
    const q = ALL[S.pool[S.i]];
    S.start = S.i % S.groups.length;
    S.cur = S.start; S.tried = 0; S.done = false;
    S.opts = shuffle(q.o.map((t, k) => ({ t, ok: k === q.a })));
    $("#qNo").textContent = "প্ৰশ্ন " + (S.i + 1) + " / " + S.pool.length;
    $("#qCat").textContent = q.c || "সাধাৰণ";
    $("#question").textContent = q.q;
    $("#message").textContent = ""; $("#message").className = "message";
    $("#nextBtn").classList.add("hidden");
    $("#passBtn").classList.remove("hidden");
    renderOptions(); renderGroups(); startTimer();
  }

  function renderOptions() {
    const box = $("#options");
    box.innerHTML = "";
    S.opts.forEach((o, idx) => {
      const b = document.createElement("button");
      b.className = "opt";
      b.textContent = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"][idx] + ") " + o.t;
      b.addEventListener("click", () => pick(idx, b));
      box.appendChild(b);
    });
  }

  function renderGroups() {
    const box = $("#groups");
    box.innerHTML = "";
    S.groups.forEach((g, i) => {
      const d = document.createElement("div");
      d.className = "g" + (i === S.cur && !S.done ? " active" : "") + (S.triedSet && S.triedSet.has(i) ? " tried" : "");
      d.style.borderColor = i === S.cur && !S.done ? COLORS[i % 10] : "transparent";
      d.innerHTML = '<div class="name"></div><div class="score"></div>';
      d.querySelector(".name").textContent = g.name;
      d.querySelector(".name").style.color = COLORS[i % 10];
      d.querySelector(".score").textContent = g.score;
      box.appendChild(d);
    });
    $("#turnText").textContent = S.done ? "" : "👉 " + S.groups[S.cur].name + " ৰ পাল";
  }

  // ---------- সময় ----------
  function startTimer() {
    clearInterval(timer);
    if (!S.triedSet || S.tried === 0) S.triedSet = new Set();
    S.left = S.time; paused = false; $("#pauseBtn").textContent = "⏸";
    drawTimer();
    timer = setInterval(() => {
      if (paused) return;
      S.left--;
      drawTimer();
      if (S.left <= 0) { beep(); passTurn("⏰ সময় শেষ!"); }
    }, 1000);
  }

  function drawTimer() {
    $("#timerNum").textContent = S.left;
    const f = $("#timerFill");
    f.style.width = (S.left / S.time) * 100 + "%";
    f.style.background = S.left <= 5 ? "#e03a3a" : S.left <= S.time / 2 ? "#f59e0b" : "#1fa45a";
  }

  function beep() {
    try {
      const c = new (window.AudioContext || window.webkitAudioContext)();
      const o = c.createOscillator(); o.frequency.value = 520; o.connect(c.destination);
      o.start(); setTimeout(() => { o.stop(); c.close(); }, 350);
    } catch (e) {}
  }

  // ---------- খেলৰ যুক্তি ----------
  function passTurn(reason) {
    if (S.done) return;
    S.triedSet.add(S.cur);
    S.tried++;
    if (S.tried >= S.groups.length) {
      reveal(null, reason + " কোনো দলে শুদ্ধ উত্তৰ দিব নোৱাৰিলে।");
      return;
    }
    S.cur = (S.cur + 1) % S.groups.length;
    S.left = S.time;
    drawTimer();
    renderGroups();
    msg(reason + " এতিয়া " + S.groups[S.cur].name + " ৰ পাল।", "bad");
  }

  function pick(idx, btn) {
    if (S.done || btn.disabled) return;
    if (S.opts[idx].ok) {
      const marks = S.tried === 0 ? S.full : S.pass;
      S.groups[S.cur].score += marks;
      reveal(S.cur, "✅ শুদ্ধ উত্তৰ! " + S.groups[S.cur].name + " এ " + marks + " নম্বৰ পালে।");
    } else {
      btn.disabled = true; btn.classList.add("wrong");
      passTurn("❌ ভুল উত্তৰ!");
    }
  }

  function reveal(winner, text) {
    S.done = true;
    clearInterval(timer);
    document.querySelectorAll("#options .opt").forEach((b, i) => {
      b.disabled = true;
      if (S.opts[i].ok) { b.classList.remove("wrong"); b.classList.add("right"); }
    });
    msg(text + " (শুদ্ধ উত্তৰ: " + S.opts.find((o) => o.ok).t + ")", winner === null ? "bad" : "ok");
    $("#passBtn").classList.add("hidden");
    $("#nextBtn").classList.remove("hidden");
    $("#nextBtn").textContent = S.i + 1 >= S.pool.length ? "ফলাফল চাওক 🏁" : "পৰৱৰ্তী প্ৰশ্ন ➜";
    const used = getUsed(); used.add(S.pool[S.i]); saveUsed(used);
    S.triedSet = null;
    renderGroups();
  }

  function msg(t, cls) { const m = $("#message"); m.textContent = t; m.className = "message " + (cls || ""); }

  function next() {
    S.i++;
    if (S.i >= S.pool.length) return finish();
    S.triedSet = null;
    showQ();
  }

  function finish() {
    clearInterval(timer);
    const sorted = S.groups.slice().sort((a, b) => b.score - a.score);
    const top = sorted[0].score;
    const winners = sorted.filter((g) => g.score === top).map((g) => g.name);
    $("#winner").textContent = "🥇 বিজয়ী: " + winners.join(" ও ") + " (" + top + " নম্বৰ)";
    const ol = $("#finalBoard");
    ol.innerHTML = "";
    sorted.forEach((g) => { const li = document.createElement("li"); li.textContent = g.name + " — " + g.score + " নম্বৰ"; ol.appendChild(li); });
    show("end");
  }

  // ---------- প্ৰশ্ন আমদানি ----------
  function importQ(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const arr = JSON.parse(r.result);
        const ok = arr.filter((x) => x && x.q && Array.isArray(x.o) && x.o.length >= 2 && Number.isInteger(x.a) && x.a >= 0 && x.a < x.o.length);
        if (!ok.length) throw new Error("no valid");
        const cur = JSON.parse(localStorage.getItem(LS_EXTRA) || "[]").concat(ok);
        localStorage.setItem(LS_EXTRA, JSON.stringify(cur));
        alert(ok.length + "টা প্ৰশ্ন যোগ হ'ল। পৃষ্ঠা পুনৰ লোড কৰি আছোঁ।");
        location.reload();
      } catch (e) { alert("JSON ফাইল শুদ্ধ নহয়। README চাওক।"); }
    };
    r.readAsText(file);
  }

  // ---------- ইভেণ্ট ----------
  $("#groupCount").addEventListener("input", renderNames);
  $("#noRepeat").addEventListener("change", updatePoolInfo);
  $("#startBtn").addEventListener("click", start);
  $("#passBtn").addEventListener("click", () => passTurn("⏭ পাছ কৰা হ'ল।"));
  $("#nextBtn").addEventListener("click", next);
  $("#pauseBtn").addEventListener("click", () => { paused = !paused; $("#pauseBtn").textContent = paused ? "▶" : "⏸"; });
  $("#endEarly").addEventListener("click", () => { if (confirm("খেল শেষ কৰিব নেকি?")) finish(); });
  $("#againBtn").addEventListener("click", () => { renderCats(); show("setup"); });
  $("#resetUsed").addEventListener("click", () => { saveUsed(new Set()); updatePoolInfo(); alert("তালিকা মচা হ'ল।"); });
  $("#importFile").addEventListener("change", (e) => { if (e.target.files[0]) importQ(e.target.files[0]); });

  renderNames();
  renderCats();
})();
