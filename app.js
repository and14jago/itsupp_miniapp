"use strict";

(function () {
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (_e) {}
  }

  function safeText(val, maxLen) {
    var s = String(val == null ? "" : val).replace(/[\u0000-\u001F\u007F]/g, "").trim();
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  }

  var user = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
  var nameEl = document.getElementById("user-name");
  var subEl = document.getElementById("user-sub");
  var avatarEl = document.getElementById("user-avatar");
  var loggedNameEl = document.getElementById("logged-user-name");

  if (user && typeof user === "object") {
    var first = safeText(user.first_name, 64);
    var last = safeText(user.last_name, 64);
    var uid = safeText(user.id, 24);
    var uname = safeText(user.username, 64);
    var fullName = (first + " " + last).trim() || ("ID " + uid);
    var initials = ((first.charAt(0) || "T") + (last.charAt(0) || "")).toUpperCase();

    nameEl.textContent = fullName;
    loggedNameEl.textContent = fullName;
    subEl.textContent = uname ? "@" + uname + " • ID " + uid : "Telegram ID: " + uid;
    avatarEl.textContent = initials || "TG";
  } else {
    subEl.textContent = "Откройте через кнопку меню в Telegram";
  }

  var screenLogin = document.getElementById("screen-login");
  var screenDev = document.getElementById("screen-dev");

  document.getElementById("btn-login").addEventListener("click", function () {
    if (tg && tg.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred("light");
      } catch (_e) {}
    }
    screenLogin.classList.remove("active");
    screenDev.classList.add("active");
  });

  document.getElementById("btn-back").addEventListener("click", function () {
    screenDev.classList.remove("active");
    screenLogin.classList.add("active");
  });

  document.getElementById("btn-close").addEventListener("click", function () {
    if (tg && typeof tg.close === "function" && tg.initData) {
      tg.close();
    } else {
      screenDev.classList.remove("active");
      screenLogin.classList.add("active");
    }
  });
})();
