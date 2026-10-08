/* ==========================================================================
   ChainBreaker — clinical console
   --------------------------------------------------------------------------
   The clinician's surface. Deliberately given an anonymised client code and
   nothing else identifying, and deliberately unable to leave while a session
   is open. Both are enforced here, in the open, rather than hoped for.
   ========================================================================== */

(function () {
  "use strict";

  var CB = window.ChainBreaker;
  if (!CB) return;

  var doc = document;

  var loginView = doc.getElementById("clinLogin");
  var consoleView = doc.getElementById("clinConsole");
  var whoBox = doc.getElementById("clinWho");
  var whoName = doc.getElementById("clinName");
  var loginForm = doc.getElementById("clinForm");
  var nameInput = doc.getElementById("clinNameInput");
  var emailInput = doc.getElementById("clinEmail");
  var codeInput = doc.getElementById("clinCode");
  var signOutBtn = doc.getElementById("clinSignOut");
  var refreshBtn = doc.getElementById("clinRefresh");
  var dot = doc.getElementById("clinDot");
  var stateEl = doc.getElementById("clinState");
  var stateMeta = doc.getElementById("clinStateMeta");
  var clientEl = doc.getElementById("clinClient");
  var withheldEl = doc.getElementById("clinWithheld");
  var threadEl = doc.getElementById("clinThread");
  var composer = doc.getElementById("clinComposer");
  var input = doc.getElementById("clinInput");
  var endBtn = doc.getElementById("clinEnd");
  var lockEl = doc.getElementById("clinLock");
  var lockText = doc.getElementById("clinLockText");

  function esc(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function fmtTime(ts) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function showLogin() {
    loginView.hidden = false;
    consoleView.hidden = true;
    whoBox.hidden = true;
  }

  function showConsole() {
    var a = CB.loadTherapistAuth();
    loginView.hidden = true;
    consoleView.hidden = false;
    whoBox.hidden = false;
    whoName.textContent = (a && a.name) || "Clinician";
    render();
  }

  /* ======================================================================
     Rendering
     ====================================================================== */

  function render() {
    var session = CB.loadSession();
    var recovery = CB.loadRecovery();
    var profile = CB.loadProfile() || {};
    var active = Boolean(session.active);

    // ---- session strip
    dot.classList.toggle("is-live", active);
    stateEl.textContent = active ? "Session in progress" : "No active session";
    stateMeta.textContent = active
      ? "Opened " + fmtTime(session.startedAt)
      : "Waiting for a client to open a session.";

    // ---- client card. Only anonymised values ever reach this.
    var code = CB.anonId(profile);
    var rows = [
      ["Client code", code, true],
      ["Age band", CB.ageBand(profile), false],
      ["Working on", profile.goal || "Not shared", false],
      ["Messages in thread", String((recovery.messages || []).length), false],
    ];

    clientEl.innerHTML = "";
    rows.forEach(function (row) {
      var wrap = doc.createElement("div");
      var k = doc.createElement("span");
      k.className = "k";
      k.textContent = row[0];
      var v = doc.createElement("span");
      v.className = "v" + (row[2] ? " is-code" : "");
      v.textContent = row[1];
      wrap.appendChild(k);
      wrap.appendChild(v);
      clientEl.appendChild(wrap);
    });

    // ---- withheld list
    var withheld = [
      "Full name",
      "Exact age",
      "Phone or email",
      "Kivd conversations",
      "Mood and tracking history",
    ];
    withheldEl.innerHTML = withheld
      .map(function (w) {
        return (
          '<li><svg class="icon" viewBox="0 0 24 24"><use href="#i-lock"></use></svg>' +
          esc(w) +
          "</li>"
        );
      })
      .join("");

    renderThread(recovery, code);

    // ---- the lock. Enforced, not just described.
    endBtn.disabled = active;
    endBtn.textContent = active ? "End session" : "Close console";
    signOutBtn.disabled = active;
    lockEl.classList.toggle("is-open", !active);
    lockText.textContent = active
      ? "You cannot leave while a session is open. The client ends it, not you."
      : "No session open. You can leave at any time.";
  }

  function renderThread(recovery, code) {
    var messages = recovery.messages || [];
    threadEl.innerHTML = "";

    if (!messages.length) {
      var empty = doc.createElement("p");
      empty.className = "clin-empty";
      empty.textContent = messages.length
        ? ""
        : "Nothing written yet. When your client writes in their Safe Space, it appears here.";
      threadEl.appendChild(empty);
      return;
    }

    var tail = code.slice(-2);

    messages.forEach(function (m) {
      var mine = m.role === "therapist";
      var article = doc.createElement("article");
      article.className = "msg " + (mine ? "is-user" : "is-ai");
      article.innerHTML =
        '<div class="msg-avatar" aria-hidden="true"></div>' +
        '<div class="msg-body"><div class="msg-name"></div><div class="msg-content"></div></div>';

      var a = CB.loadTherapistAuth();
      article.querySelector(".msg-avatar").textContent = mine
        ? (((a && a.name) || "C").trim()[0] || "C").toUpperCase()
        : tail;
      article.querySelector(".msg-name").textContent = mine ? "You" : "Client " + code;
      article.querySelector(".msg-content").textContent = m.text;
      threadEl.appendChild(article);
    });

    threadEl.scrollTop = threadEl.scrollHeight;
  }

  /* ======================================================================
     Wiring
     ====================================================================== */

  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var name = (nameInput && nameInput.value ? nameInput.value : "").trim();
      var email = (emailInput && emailInput.value ? emailInput.value : "").trim();
      var code = (codeInput && codeInput.value ? codeInput.value : "").trim();

      if (!name && !email && !code) {
        if (nameInput) nameInput.focus();
        // Nothing to verify against yet, so anything at all gets you in.
        name = "Clinician";
      }

      CB.saveTherapistAuth({ name: name, email: email, code: code, at: Date.now() });
      showConsole();
    });
  }

  signOutBtn.addEventListener("click", function () {
    // Belt and braces: the button is already disabled while a session is open.
    if (CB.loadSession().active) return;
    CB.clearTherapistAuth();
    showLogin();
  });

  if (refreshBtn) refreshBtn.addEventListener("click", render);

  if (endBtn) {
    endBtn.addEventListener("click", function () {
      if (CB.loadSession().active) return;
      CB.clearTherapistAuth();
      showLogin();
    });
  }

  if (composer) {
    composer.addEventListener("submit", function (event) {
      event.preventDefault();

      var value = (input && input.value ? input.value : "").trim();
      if (!value) return;

      var recovery = CB.loadRecovery();
      recovery.messages.push({ role: "therapist", text: value, at: Date.now() });
      CB.saveRecovery(recovery);

      input.value = "";
      input.style.height = "auto";
      render();
    });
  }

  if (input) {
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 160) + "px";
    });
  }

  // The client may be in another tab, so keep an eye out.
  var tick = null;

  function startTicking() {
    if (tick) return;
    tick = window.setInterval(function () {
      if (consoleView.hidden) return;
      render();
    }, 4000);
  }

  doc.addEventListener("visibilitychange", function () {
    if (!doc.hidden && !consoleView.hidden) render();
  });

  /* ======================================================================
     Boot
     ====================================================================== */

  if (CB.loadTherapistAuth()) {
    showConsole();
    startTicking();
  } else {
    showLogin();
  }
})();
