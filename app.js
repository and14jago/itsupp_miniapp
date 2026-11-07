"use strict";

(function () {
  var tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  if (tg) {
    try {
      tg.ready();
      tg.expand();
    } catch (_e) {}
  }

  // Принудительный сброс кэша CSS в iOS Telegram WKWebView при открытии и возврате в окно
  function refreshLiveStylesheet() {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href") || "";
      if (href.indexOf("styles.css") !== -1) {
        links[i].setAttribute("href", "./styles.css?v=20261108-05&_t=" + Date.now());
      }
    }
  }
  refreshLiveStylesheet();
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      refreshLiveStylesheet();
    }
  });

  var DATA = window.ITSUPP_DATA || { companies: [], employees: [], initialTasks: [] };
  var STORAGE_KEY_STATE = "itsupp_miniapp_state_v5";
  var STORAGE_KEY_PIN = "itsupp_miniapp_pin_v2";
  var STORAGE_KEY_BIO = "itsupp_miniapp_bio_prefs_v2";
  var STORAGE_KEY_THEME = "itsupp_miniapp_theme_v1";
  var STORAGE_KEY_AVATAR = "itsupp_miniapp_custom_avatar_v1";
  var STORAGE_KEY_USER_PHOTO = "itsupp_miniapp_user_photo_v1";
  var STORAGE_KEY_AVATAR_TOUCHED = "itsupp_miniapp_avatar_touched_v1";
  var STORAGE_KEY_LOGO_MIGRATED = "itsupp_miniapp_emblem_only_v2";
  var SERVIS_PRO_LOGO_URL = "./logo.png?v=2";

  function safeText(val, maxLen) {
    var s = String(val == null ? "" : val).replace(/[\u0000-\u001F\u007F]/g, "").trim();
    return maxLen && s.length > maxLen ? s.slice(0, maxLen) : s;
  }

  function hapticImpact(style) {
    if (tg && tg.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred(style || "light");
      } catch (_e) {}
    }
  }

  function hapticNotify(type) {
    if (tg && tg.HapticFeedback) {
      try {
        tg.HapticFeedback.notificationOccurred(type || "success");
      } catch (_e) {}
    }
  }

  var toastTimer = null;
  function showToast(msg) {
    var elToast = document.getElementById("toast");
    if (!elToast) return;
    elToast.textContent = safeText(msg, 180);
    elToast.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      elToast.classList.add("hidden");
    }, 2400);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  // =========================================================
  // УПРАВЛЕНИЕ ТЕМОЙ: ДЕНЬ / НОЧЬ / АВТО
  // =========================================================
  var darkMediaQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function getSavedThemeMode() {
    try {
      var m = localStorage.getItem(STORAGE_KEY_THEME);
      if (m === "light" || m === "dark" || m === "auto") return m;
    } catch (_e) {}
    return "auto";
  }

  var currentThemeMode = getSavedThemeMode();

  function resolveEffectiveTheme(mode) {
    if (mode === "light" || mode === "dark") return mode;
    if (tg && (tg.colorScheme === "dark" || tg.colorScheme === "light")) {
      return tg.colorScheme;
    }
    if (darkMediaQuery && typeof darkMediaQuery.matches === "boolean") {
      return darkMediaQuery.matches ? "dark" : "light";
    }
    return "light";
  }

  function applyThemeMode(mode, notifyUser) {
    currentThemeMode = mode === "light" || mode === "dark" || mode === "auto" ? mode : "auto";
    try {
      localStorage.setItem(STORAGE_KEY_THEME, currentThemeMode);
    } catch (_e) {}

    var effective = resolveEffectiveTheme(currentThemeMode);
    document.documentElement.setAttribute("data-theme", effective);

    var btns = document.querySelectorAll("[data-theme-mode]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("active", btns[i].getAttribute("data-theme-mode") === currentThemeMode);
    }

    if (tg) {
      try {
        var bgHex = effective === "dark" ? "#0F1115" : "#F5F6F8";
        var hdrHex = effective === "dark" ? "#0F1115" : "#FFFFFF";
        if (typeof tg.setBackgroundColor === "function") tg.setBackgroundColor(bgHex);
        if (typeof tg.setHeaderColor === "function") tg.setHeaderColor(hdrHex);
      } catch (_e) {}
    }
    void notifyUser;
  }

  applyThemeMode(currentThemeMode, false);

  if (darkMediaQuery && typeof darkMediaQuery.addEventListener === "function") {
    darkMediaQuery.addEventListener("change", function () {
      if (currentThemeMode === "auto") applyThemeMode("auto", false);
    });
  }
  if (tg && typeof tg.onEvent === "function") {
    try {
      tg.onEvent("themeChanged", function () {
        if (currentThemeMode === "auto") applyThemeMode("auto", false);
      });
    } catch (_e) {}
  }

  var themeBtns = document.querySelectorAll("[data-theme-mode]");
  for (var tIdx = 0; tIdx < themeBtns.length; tIdx++) {
    themeBtns[tIdx].addEventListener("click", function (ev) {
      hapticImpact("light");
      applyThemeMode(ev.currentTarget.getAttribute("data-theme-mode"), true);
    });
  }

  // --- Утилиты ---
  function timeGreeting() {
    var h = new Date().getHours();
    if (h >= 5 && h < 12) return "Доброе утро";
    if (h >= 12 && h < 18) return "Добрый день";
    if (h >= 18 && h < 23) return "Добрый вечер";
    return "Доброй ночи";
  }

  function formatMinutes(mins) {
    var m = Math.max(0, parseInt(mins, 10) || 0);
    if (m === 0) return "0м";
    var h = Math.floor(m / 60);
    var rem = m % 60;
    if (h > 0 && rem > 0) return h + "ч " + rem + "м";
    if (h > 0) return h + "ч";
    return rem + "м";
  }

  function getEmployeeById(id) {
    var s = String(id || "");
    for (var i = 0; i < DATA.employees.length; i++) {
      if (String(DATA.employees[i].id) === s) return DATA.employees[i];
    }
    return null;
  }

  function getEmployeeByTgId(tgId) {
    var s = String(tgId || "");
    for (var i = 0; i < DATA.employees.length; i++) {
      if (String(DATA.employees[i].tg_id) === s) return DATA.employees[i];
    }
    return null;
  }

  // --- Загрузка и сохранение состояния ---
  function loadSavedState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_STATE);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          return parsed;
        }
      }
    } catch (_e) {}
    return {
      tasks: JSON.parse(JSON.stringify(DATA.initialTasks || [])),
      freshEnabled: true,
      dutyEmpId: "8",
      nextIssueId: 44125,
      nudgeTimestamps: {}
    };
  }

  var state = loadSavedState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
    } catch (_e) {}
  }

  function loadBioPrefs() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY_BIO);
      if (raw) return JSON.parse(raw);
    } catch (_e) {}
    return { enabled: true, autoPrompt: false };
  }

  var bioPrefs = loadBioPrefs();
  function saveBioPrefs() {
    try {
      localStorage.setItem(STORAGE_KEY_BIO, JSON.stringify(bioPrefs));
    } catch (_e) {}
  }

  function getSavedPin() {
    try {
      return localStorage.getItem(STORAGE_KEY_PIN) || "";
    } catch (_e) {
      return "";
    }
  }

  function setSavedPin(pin) {
    try {
      if (pin) localStorage.setItem(STORAGE_KEY_PIN, String(pin));
      else localStorage.removeItem(STORAGE_KEY_PIN);
    } catch (_e) {}
  }

  // --- Определение текущего пользователя Telegram и сотрудника Okdesk ---
  var tgUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
  var matchedEmp = tgUser && tgUser.id ? getEmployeeByTgId(tgUser.id) : null;
  var currentEmp = matchedEmp || DATA.employees[0] || {
    id: "1",
    tg_id: "423709417",
    name: "Стрелкин Михаил",
    short: "Стрелкин М.",
    role: "admin",
    dept: "Руководство / ИТ"
  };

  // Обновление кэшированного URL логотипа до чистого круга без текста и сохранение личного фото в отдельный слот
  try {
    var prevSaved = localStorage.getItem(STORAGE_KEY_AVATAR) || "";
    if (prevSaved.indexOf("./logo.png") === 0 && prevSaved !== SERVIS_PRO_LOGO_URL) {
      localStorage.setItem(STORAGE_KEY_AVATAR, SERVIS_PRO_LOGO_URL);
    }
    if (prevSaved.indexOf("data:image/") === 0 && !localStorage.getItem(STORAGE_KEY_USER_PHOTO)) {
      localStorage.setItem(STORAGE_KEY_USER_PHOTO, prevSaved);
    }
  } catch (_e) {}

  function getSavedAvatar() {
    try {
      return localStorage.getItem(STORAGE_KEY_AVATAR) || "";
    } catch (_e) {
      return "";
    }
  }

  function hasUserEditedAvatar() {
    try {
      return Boolean(getSavedAvatar() || localStorage.getItem(STORAGE_KEY_AVATAR_TOUCHED));
    } catch (_e) {
      return Boolean(getSavedAvatar());
    }
  }

  function setSavedAvatar(dataUrl) {
    try {
      if (dataUrl) {
        var s = String(dataUrl);
        localStorage.setItem(STORAGE_KEY_AVATAR, s);
        if (s.indexOf("data:image/") === 0) {
          localStorage.setItem(STORAGE_KEY_USER_PHOTO, s);
        }
        localStorage.setItem(STORAGE_KEY_AVATAR_TOUCHED, "1");
        localStorage.setItem(STORAGE_KEY_LOGO_MIGRATED, "1");
      } else {
        localStorage.removeItem(STORAGE_KEY_AVATAR);
      }
    } catch (_e) {
      showToast("Слишком большой файл изображения");
    }
  }

  function renderAvatarNode(targetEl, fallbackInitials) {
    if (!targetEl) return;
    var customImg = getSavedAvatar();
    targetEl.textContent = "";
    if (
      customImg &&
      (customImg === SERVIS_PRO_LOGO_URL ||
        customImg.indexOf("./logo.png") === 0 ||
        customImg.indexOf("data:image/") === 0)
    ) {
      targetEl.classList.add("has-custom-img");
      var img = document.createElement("img");
      img.className = "avatar-custom-img";
      img.src = customImg;
      img.alt = fallbackInitials || "Logo";
      targetEl.appendChild(img);
    } else {
      targetEl.classList.remove("has-custom-img");
      targetEl.textContent = fallbackInitials || "MS";
    }
  }

  function getLoginInitials() {
    if (tgUser && typeof tgUser === "object") {
      var first = safeText(tgUser.first_name, 64);
      var last = safeText(tgUser.last_name, 64);
      var init = ((first.charAt(0) || "M") + (last.charAt(0) || "S")).toUpperCase();
      return init || "MS";
    }
    return "MS";
  }

  var userSwitchedManually = false;

  function setupLoginProfileUI() {
    var nameEl = document.getElementById("user-name");
    var subEl = document.getElementById("user-sub");
    var avatarEl = document.getElementById("user-avatar");
    var greetEl = document.getElementById("login-greeting");
    var editBadgeEl = document.getElementById("avatar-edit-badge");
    var initials = getLoginInitials();

    if (!userSwitchedManually && tgUser && typeof tgUser === "object") {
      var first = safeText(tgUser.first_name, 64);
      var last = safeText(tgUser.last_name, 64);
      var uid = safeText(tgUser.id, 24);
      var uname = safeText(tgUser.username, 64);
      var fullName = (first + " " + last).trim() || ("ID " + uid);

      greetEl.textContent = timeGreeting() + (first ? ", " + first + "!" : "!");
      nameEl.textContent = fullName;
      subEl.textContent = matchedEmp
        ? matchedEmp.dept + " • Okdesk ID " + matchedEmp.id
        : (uname ? "@" + uname + " • ID " + uid : "Telegram ID: " + uid);
    } else {
      greetEl.textContent = timeGreeting() + "!";
      nameEl.textContent = currentEmp.name;
      subEl.textContent = currentEmp.dept + " • Okdesk ID " + currentEmp.id;
    }

    renderAvatarNode(avatarEl, initials);
    if (editBadgeEl) {
      // Значок карандаша показывается только до первой установки фото или лого
      editBadgeEl.classList.toggle("hidden", hasUserEditedAvatar());
    }
  }

  setupLoginProfileUI();

  var avatarMenuModal = document.getElementById("avatar-menu-modal");

  function openAvatarMenuPopover() {
    hapticImpact("light");
    if (avatarMenuModal) {
      avatarMenuModal.classList.remove("hidden");
    }
  }

  function closeAvatarMenuPopover() {
    if (avatarMenuModal) {
      avatarMenuModal.classList.add("hidden");
    }
  }

  function triggerAvatarFilePicker() {
    openAvatarMenuPopover();
  }

  if (avatarMenuModal) {
    avatarMenuModal.addEventListener("click", function (ev) {
      if (ev.target === avatarMenuModal) {
        closeAvatarMenuPopover();
      }
    });
  }

  function handleAvatarFileSelected(ev) {
    var file = ev.currentTarget.files && ev.currentTarget.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (loadEv) {
      var rawUrl = String(loadEv.target.result || "");
      if (rawUrl.indexOf("data:image/") !== 0) {
        showToast("Выберите файл изображения (PNG, JPG, SVG, WEBP)");
        return;
      }
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement("canvas");
          var size = 256;
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext("2d");
          var w = img.naturalWidth || img.width || size;
          var h = img.naturalHeight || img.height || size;
          var minSide = Math.min(w, h);
          var sx = (w - minSide) / 2;
          var sy = (h - minSide) / 2;
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
          var outUrl = canvas.toDataURL("image/png");
          setSavedAvatar(outUrl);
        } catch (_err) {
          setSavedAvatar(rawUrl);
        }
        setupLoginProfileUI();
        renderHeader();
        hapticNotify("success");
        showToast("✓ Фото установлено");
      };
      img.onerror = function () {
        setSavedAvatar(rawUrl);
        setupLoginProfileUI();
        renderHeader();
        showToast("✓ Изображение установлено");
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  }

  ["login-avatar-input", "login-camera-input", "login-file-input"].forEach(function (inputId) {
    var inp = document.getElementById(inputId);
    if (inp) {
      inp.addEventListener("change", handleAvatarFileSelected);
    }
  });

  var btnSrcGallery = document.getElementById("btn-avatar-src-gallery");
  if (btnSrcGallery) {
    btnSrcGallery.addEventListener("click", function () {
      closeAvatarMenuPopover();
      var savedUserPhoto = "";
      try {
        savedUserPhoto = localStorage.getItem(STORAGE_KEY_USER_PHOTO) || "";
      } catch (_e) {}
      if (getSavedAvatar() === SERVIS_PRO_LOGO_URL && savedUserPhoto) {
        setSavedAvatar(savedUserPhoto);
        setupLoginProfileUI();
        renderHeader();
        hapticNotify("success");
        return;
      }
      var inp = document.getElementById("login-avatar-input");
      if (inp) {
        inp.value = "";
        inp.click();
      }
    });
  }

  var btnSrcCamera = document.getElementById("btn-avatar-src-camera");
  if (btnSrcCamera) {
    btnSrcCamera.addEventListener("click", function () {
      closeAvatarMenuPopover();
      var inp = document.getElementById("login-camera-input");
      if (inp) {
        inp.value = "";
        inp.click();
      }
    });
  }

  var btnSrcFile = document.getElementById("btn-avatar-src-file");
  if (btnSrcFile) {
    btnSrcFile.addEventListener("click", function () {
      closeAvatarMenuPopover();
      var inp = document.getElementById("login-file-input");
      if (inp) {
        inp.value = "";
        inp.click();
      }
    });
  }

  var btnSrcLogo = document.getElementById("btn-avatar-src-logo");
  if (btnSrcLogo) {
    btnSrcLogo.addEventListener("click", function () {
      closeAvatarMenuPopover();
      setSavedAvatar(SERVIS_PRO_LOGO_URL);
      setupLoginProfileUI();
      renderHeader();
      hapticNotify("success");
      showToast("✓ Лого установлено");
    });
  }

  var btnAvatarUpload = document.getElementById("btn-avatar-upload");
  if (btnAvatarUpload) {
    btnAvatarUpload.addEventListener("click", openAvatarMenuPopover);
  }
  var btnAvatarHint = document.getElementById("btn-avatar-hint");
  if (btnAvatarHint) {
    btnAvatarHint.addEventListener("click", openAvatarMenuPopover);
  }

  // =========================================================
  // ЭКРАН 1: СБЕР FACE ID / TOUCH ID + 5-ЗНАЧНЫЙ КОД ДОСТУПА
  // =========================================================
  var pinBuffer = "";
  var pinChangeMode = false;
  var bm = tg && tg.BiometricManager ? tg.BiometricManager : null;
  var bioTypeLabel = "Face ID / Touch ID";

  function updateBiometricLabels() {
    var btnLbl = document.getElementById("btn-bio-label");
    var statusDesc = document.getElementById("bio-status-desc");
    var modalTitle = document.getElementById("bio-modal-title");

    if (bm && bm.isInited) {
      if (bm.isBiometricAvailable) {
        if (bm.biometricType === "face") bioTypeLabel = "Face ID";
        else if (bm.biometricType === "finger") bioTypeLabel = "Touch ID";
        else bioTypeLabel = "Face ID / Touch ID";
        if (statusDesc) {
          statusDesc.textContent = "Доступно на устройстве (" + bioTypeLabel + ") • BiometricManager активен";
        }
      } else {
        bioTypeLabel = "Face ID / Touch ID";
        if (statusDesc) {
          statusDesc.textContent = "Активен режим Сбер ID (Face ID / Touch ID + 5-значный код)";
        }
      }
    } else {
      if (statusDesc) {
        statusDesc.textContent = "Активен режим Сбер ID (Face ID / Touch ID + 5-значный код)";
      }
    }
    if (btnLbl) btnLbl.textContent = "Войти по " + bioTypeLabel;
    if (modalTitle) modalTitle.textContent = bioTypeLabel;
  }

  if (bm && typeof bm.init === "function") {
    try {
      bm.init(function () {
        updateBiometricLabels();
        if (bioPrefs.enabled && bioPrefs.autoPrompt) {
          triggerBiometricLogin();
        }
      });
    } catch (_e) {
      updateBiometricLabels();
    }
  } else {
    updateBiometricLabels();
  }

  function updatePinPrompts() {
    var saved = getSavedPin();
    var promptEl = document.getElementById("pin-prompt");
    var hintEl = document.getElementById("pin-hint");
    if (hintEl) {
      hintEl.textContent = "";
      hintEl.classList.add("hidden");
    }
    if (pinChangeMode) {
      promptEl.textContent = "Придумайте новый 5-значный код доступа";
    } else if (!saved) {
      promptEl.textContent = "Придумайте 5-значный код или войдите по " + bioTypeLabel;
    } else {
      promptEl.textContent = "Введите 5-значный код или войдите по " + bioTypeLabel;
    }
  }

  function renderPinDots(isError) {
    var dotsWrap = document.getElementById("pin-dots");
    var dots = dotsWrap.querySelectorAll(".pin-dot");
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle("filled", i < pinBuffer.length);
      dots[i].classList.toggle("error", Boolean(isError));
    }
  }

  function unlockWorkspace(methodLabel) {
    hapticNotify("success");
    void methodLabel;
    pinBuffer = "";
    pinChangeMode = false;
    renderPinDots(false);
    document.getElementById("bio-modal").classList.add("hidden");
    document.getElementById("screen-login").classList.remove("active");
    document.getElementById("screen-app").classList.add("active");
    renderAllAppViews();
  }

  function handlePinDigit(digit) {
    if (pinBuffer.length >= 5) return;
    hapticImpact("light");
    pinBuffer += String(digit);
    renderPinDots(false);

    if (pinBuffer.length === 5) {
      var saved = getSavedPin();
      setTimeout(function () {
        if (pinChangeMode || !saved) {
          setSavedPin(pinBuffer);
          unlockWorkspace("5-значный код сохранён");
        } else if (pinBuffer === saved) {
          unlockWorkspace("5-значный код");
        } else {
          hapticNotify("error");
          var dotsWrap = document.getElementById("pin-dots");
          renderPinDots(true);
          dotsWrap.classList.add("shake");
          var errMsg = "Неверный код. Попробуйте снова или войдите по " + bioTypeLabel;
          document.getElementById("pin-prompt").textContent = errMsg;
          document.getElementById("pin-hint").textContent = errMsg;
          setTimeout(function () {
            dotsWrap.classList.remove("shake");
            pinBuffer = "";
            renderPinDots(false);
          }, 420);
        }
      }, 140);
    }
  }

  var bioScanTimer = null;
  function setCenterCircleScanning(isScanning) {
    var avatarEl = document.getElementById("user-avatar");
    var wrapEl = document.getElementById("btn-avatar-upload");
    if (avatarEl) avatarEl.classList.toggle("scanning-pulse", Boolean(isScanning));
    if (wrapEl) wrapEl.classList.toggle("scanning-pulse", Boolean(isScanning));
  }

  function triggerBiometricLogin() {
    hapticImpact("medium");
    var modal = document.getElementById("bio-modal");
    if (modal) modal.classList.add("hidden");
    setCenterCircleScanning(true);
    var hintEl = document.getElementById("pin-hint");
    if (hintEl) {
      hintEl.textContent = "Проверка " + bioTypeLabel + "…";
    }

    if (bm && bm.isInited && bm.isBiometricAvailable) {
      try {
        var doAuth = function () {
          bm.authenticate(
            { reason: "Подтвердите вход в рабочий кабинет ITSUPP" },
            function (success) {
              setCenterCircleScanning(false);
              if (success) {
                unlockWorkspace(bioTypeLabel);
              } else {
                updatePinPrompts();
                showToast("Проверка " + bioTypeLabel + " отменена — введите 5-значный код");
              }
            }
          );
        };
        if (!bm.isAccessGranted) {
          bm.requestAccess(
            { reason: "Быстрый вход в ITSUPP по " + bioTypeLabel + " как в Сбере" },
            function (granted) {
              if (granted) doAuth();
              else {
                setCenterCircleScanning(false);
                updatePinPrompts();
                showToast("Доступ к биометрии не предоставлен — введите 5-значный код");
              }
            }
          );
        } else {
          doAuth();
        }
        return;
      } catch (_e) {
        setCenterCircleScanning(false);
      }
    }

    if (bioScanTimer) clearTimeout(bioScanTimer);
    bioScanTimer = setTimeout(function () {
      setCenterCircleScanning(false);
      unlockWorkspace(bioTypeLabel);
    }, 480);
  }

  // Привязка кнопок экрана входа
  var digitBtns = document.querySelectorAll(".key-btn[data-digit]");
  for (var dIdx = 0; dIdx < digitBtns.length; dIdx++) {
    digitBtns[dIdx].addEventListener("click", function (ev) {
      var dg = ev.currentTarget.getAttribute("data-digit");
      handlePinDigit(dg);
    });
  }

  document.getElementById("btn-pin-reset").addEventListener("click", function () {
    if (pinBuffer.length > 0) {
      hapticImpact("light");
      pinBuffer = pinBuffer.slice(0, -1);
      renderPinDots(false);
    } else {
      hapticImpact("light");
    }
  });

  document.getElementById("btn-key-right").addEventListener("click", function () {
    triggerBiometricLogin();
  });

  document.getElementById("btn-bio-login").addEventListener("click", function () {
    triggerBiometricLogin();
  });

  document.getElementById("btn-bio-cancel").addEventListener("click", function () {
    if (bioScanTimer) clearTimeout(bioScanTimer);
    document.getElementById("bio-modal").classList.add("hidden");
  });

  function closeMiniApp() {
    hapticImpact("light");
    if (tg && typeof tg.close === "function") {
      try {
        tg.close();
        return;
      } catch (_e) {}
    }
    showToast("Закрытие окна (в Telegram закрывает мини-приложение)");
  }

  document.getElementById("btn-login-close").addEventListener("click", closeMiniApp);

  updatePinPrompts();

  // =========================================================
  // ЭКРАН 2: ЛОГИКА БОТА @itsupp_task_bot В MINI APP
  // =========================================================
  var activeView = "tasks";
  var activeScope = "all";
  var activeStatusFilter = "all";
  var searchQuery = "";
  var botMenuExpanded = false;

  // Черновик мастера создания задачи (create_task.py)
  var createDraft = {
    typeCode: "service",
    typeName: "Техническая поддержка",
    companyId: 30,
    companyName: "Сервис-Про ООО",
    entityName: "",
    description: "",
    assigneeId: currentEmp.id,
    spentMinutes: 10,
    files: []
  };

  var lastAiParsed = null;

  // --- Правило принадлежности задачи из ASSIGN-ROUTE-DIAG-20261103 ---
  function isOwnTaskForUser(task, empId) {
    if (!task || !empId) return false;
    return String(task.assignee_id || "") === String(empId);
  }

  function isControlTaskForUser(task, empId) {
    if (!task || !empId) return false;
    var ctrl = Array.isArray(task.control_by) ? task.control_by : [];
    for (var i = 0; i < ctrl.length; i++) {
      if (String(ctrl[i]) === String(empId)) return true;
    }
    return false;
  }

  function getTaskRole(task, empId) {
    if (isOwnTaskForUser(task, empId)) return "own";
    if (isControlTaskForUser(task, empId)) return "control";
    return "foreign";
  }

  // Исключение терминальных статусов (ЗАКРЫТА / ОТКЛОНЕНА / РЕШЕНА) как в боте (TERMINAL_STATUS_CODES)
  function isTerminalStatus(code) {
    return code === "completed" || code === "closed" || code === "asya1c" || code === "rejected";
  }

  // --- Переключение вкладок ---
  function switchView(viewName) {
    activeView = viewName;
    var views = {
      tasks: document.getElementById("view-tasks"),
      create: document.getElementById("view-create"),
      ai500: document.getElementById("view-ai500"),
      results: document.getElementById("view-results"),
      more: document.getElementById("view-more")
    };
    Object.keys(views).forEach(function (k) {
      if (views[k]) views[k].classList.toggle("active", k === viewName);
    });

    var navTabs = document.querySelectorAll(".nav-tab[data-nav]");
    for (var i = 0; i < navTabs.length; i++) {
      navTabs[i].classList.toggle("active", navTabs[i].getAttribute("data-nav") === viewName);
    }

    if (viewName === "tasks") renderTasksView();
    if (viewName === "create") renderCreateView();
    if (viewName === "results") renderResultsView();
    if (viewName === "more") renderMoreView();
  }

  // --- Верхняя шапка и статус-бар ---
  function renderHeader() {
    var initials = currentEmp.name
      .split(" ")
      .slice(0, 2)
      .map(function (p) { return p.charAt(0); })
      .join("")
      .toUpperCase();
    renderAvatarNode(document.getElementById("app-emp-avatar"), initials || "ИТ");
    document.getElementById("app-emp-name").textContent = currentEmp.short || currentEmp.name;
    document.getElementById("app-emp-role").textContent =
      (currentEmp.role === "admin" ? "Админ" : "Исп.") + " · ID " + currentEmp.id;

    var freshPill = document.getElementById("btn-strip-fresh");
    var freshText = document.getElementById("strip-fresh-text");
    var kbFresh = document.getElementById("btn-kb-fresh");
    freshPill.classList.toggle("pill-on", Boolean(state.freshEnabled));
    freshText.textContent = "Оповещение: " + (state.freshEnabled ? "ВКЛ" : "ВЫКЛ");
    if (kbFresh) {
      kbFresh.textContent =
        (state.freshEnabled ? "🔔" : "🔕") +
        " Оповещение о новых задачах: " +
        (state.freshEnabled ? "ВКЛ" : "ВЫКЛ");
    }

    var dutyEmp = getEmployeeById(state.dutyEmpId) || DATA.employees[2] || currentEmp;
    var dutyLabel = "Дежурный: " + (dutyEmp ? dutyEmp.short : "Быков М. В.");
    document.getElementById("strip-duty-text").textContent = dutyLabel;
    var moreDutyBtn = document.getElementById("btn-more-duty");
    if (moreDutyBtn) moreDutyBtn.textContent = dutyLabel;
  }

  // --- Списки и фильтрация задач (без ЗАКРЫТА / ОТКЛОНЕНА / РЕШЕНА, как в боте) ---
  function filterTasksByScope(scope) {
    var empId = currentEmp.id;
    return state.tasks.filter(function (t) {
      if (isTerminalStatus(t.status_code)) return false;
      if (scope === "mine") {
        return isOwnTaskForUser(t, empId);
      }
      if (scope === "control") {
        return isControlTaskForUser(t, empId);
      }
      if (scope === "today") {
        return (isOwnTaskForUser(t, empId) || currentEmp.role === "admin") && t.due_bucket === "today";
      }
      if (scope === "overdue") {
        return (isOwnTaskForUser(t, empId) || currentEmp.role === "admin") && t.due_bucket === "overdue";
      }
      return true;
    });
  }

  function updateScopeCounts() {
    var scopes = ["mine", "control", "today", "overdue", "all"];
    scopes.forEach(function (sc) {
      var list = filterTasksByScope(sc);
      var badge = document.getElementById("cnt-" + sc);
      if (badge) badge.textContent = String(list.length);
    });
  }

  var STATUS_META = {
    opened: { label: "Открыта", cls: "status-opened" },
    resend: { label: "Делегирована", cls: "status-resend" },
    work: { label: "Принял", cls: "status-work" },
    working: { label: "Выполняю", cls: "status-working" },
    delayed: { label: "Отложена", cls: "status-delayed" },
    restart: { label: "На доработку", cls: "status-restart" },
    completed: { label: "Решена", cls: "status-completed" },
    closed: { label: "Закрыта", cls: "status-closed" },
    asya1c: { label: "Отклонена", cls: "status-asya1c" }
  };

  // Матрица разрешённых переходов статусов (как в боте DEFAULT_STATUS_TRANSITIONS)
  var OKDESK_TRANSITIONS = {
    opened: ["work", "working", "delayed", "resend", "completed", "asya1c"],
    work: ["working", "delayed", "resend", "completed", "asya1c"],
    working: ["completed", "delayed", "resend", "restart", "asya1c"],
    delayed: ["working", "completed", "resend", "asya1c"],
    resend: ["work", "working", "delayed", "completed", "asya1c"],
    restart: ["working", "delayed", "resend", "completed", "asya1c"],
    completed: ["working"],
    asya1c: ["working"],
    closed: ["working"]
  };

  // --- Автоматический подсчёт времени висения заявки в системе и живого таймера выполнения ---
  function parseTaskDateMs(str) {
    if (!str) return 0;
    var s = String(str).trim();
    var ts = Date.parse(s.indexOf("T") !== -1 ? s : s.replace(" ", "T") + ":00+03:00");
    return isNaN(ts) ? 0 : ts;
  }

  function formatDurationSec(totalSec, includeSeconds) {
    var sec = Math.max(0, Math.floor(totalSec || 0));
    var days = Math.floor(sec / 86400);
    var hours = Math.floor((sec % 86400) / 3600);
    var mins = Math.floor((sec % 3600) / 60);
    var remSec = sec % 60;
    if (includeSeconds) {
      var hh = hours + days * 24;
      var pad2 = function (n) { return n < 10 ? "0" + n : String(n); };
      return (hh > 0 ? pad2(hh) + ":" : "") + pad2(mins) + ":" + pad2(remSec);
    }
    if (days > 0) return days + "д " + hours + "ч";
    if (hours > 0) return hours + "ч " + mins + "м";
    return mins + "м";
  }

  function getTaskTimingStats(task) {
    var nowMs = Date.now();
    var createdMs = parseTaskDateMs(task.created_iso || task.created_at);
    var sysSec = createdMs > 0 ? Math.max(0, Math.floor((nowMs - createdMs) / 1000)) : 0;

    var stageLabel = "В системе";
    if (!task.assignee_id || task.assignee_id === "None") {
      stageLabel = "На техотделе (без исп.)";
    } else if (task.status_code === "opened") {
      stageLabel = "Ожидание реакции";
    } else if (task.status_code === "work") {
      stageLabel = "В очереди у исп.";
    } else if (task.status_code === "resend") {
      stageLabel = "Ожидание приёма (Делегирована)";
    } else if (task.status_code === "delayed") {
      stageLabel = "В отложенных";
    } else if (task.status_code === "restart") {
      stageLabel = "Ожидание доработки";
    } else if (task.status_code === "working") {
      stageLabel = task.timer_paused ? "В работе (на паузе)" : "В активной работе";
    }

    var byEmp = {};
    if (task.work_by_employee && typeof task.work_by_employee === "object") {
      Object.keys(task.work_by_employee).forEach(function (k) {
        byEmp[String(k)] = parseInt(task.work_by_employee[k], 10) || 0;
      });
    }
    var savedTotalSec = parseInt(task.tracked_work_seconds, 10) || 0;
    if (savedTotalSec > 0 && Object.keys(byEmp).length === 0) {
      var initOwner = String(task.work_owner_id || task.assignee_id || currentEmp.id);
      byEmp[initOwner] = savedTotalSec;
    }

    var isActiveWorkStatus = task.status_code === "working";
    var isPaused = isActiveWorkStatus && Boolean(task.timer_paused);
    var isTicking = isActiveWorkStatus && !isPaused;
    var activeOwnerId = String(task.work_owner_id || task.assignee_id || currentEmp.id);

    if (isTicking) {
      var startMs = parseTaskDateMs(task.work_started_at || task.updated_iso || task.created_iso || task.created_at);
      if (startMs > 0 && nowMs > startMs) {
        var liveDelta = Math.floor((nowMs - startMs) / 1000);
        byEmp[activeOwnerId] = (byEmp[activeOwnerId] || 0) + liveDelta;
      }
    }

    var totalWorkSec = 0;
    Object.keys(byEmp).forEach(function (k) {
      totalWorkSec += byEmp[k] || 0;
    });
    var currentAssigneeId = String(task.assignee_id || currentEmp.id);
    var ownWorkSec = byEmp[currentAssigneeId] || 0;

    return {
      sysSec: sysSec,
      stageLabel: stageLabel,
      workSec: isTicking || isPaused ? ownWorkSec : totalWorkSec,
      ownWorkSec: ownWorkSec,
      totalWorkSec: totalWorkSec,
      byEmp: byEmp,
      isTicking: isTicking,
      isPaused: isPaused,
      spentMins: parseInt(task.spent_minutes, 10) || 0
    };
  }

  function getStatusButtonsForOwnCard(statusCode) {
    if (statusCode === "opened") {
      return [
        { code: "work", text: "Принял", cls: "btn-work" },
        { code: "working", text: "Выполняю", cls: "btn-solve" },
        { code: "delayed", text: "Отложить", cls: "btn-warn" },
        { code: "resend", text: "Передать задачу", cls: "" }
      ];
    }
    if (statusCode === "work") {
      return [
        { code: "working", text: "Выполняю", cls: "btn-solve" },
        { code: "completed", text: "Решена", cls: "btn-solve" },
        { code: "delayed", text: "Отложить", cls: "btn-warn" },
        { code: "resend", text: "Передать задачу", cls: "" }
      ];
    }
    if (statusCode === "delayed") {
      return [
        { code: "working", text: "Выполняю", cls: "btn-work" },
        { code: "completed", text: "Решена", cls: "btn-solve" },
        { code: "resend", text: "Передать задачу", cls: "" }
      ];
    }
    return [
      { code: "completed", text: "Решена", cls: "btn-solve" },
      { code: "delayed", text: "Отложить", cls: "btn-warn" },
      { code: "resend", text: "Передать задачу", cls: "" }
    ];
  }

  function renderTasksView() {
    updateScopeCounts();

    var scopeTabs = document.querySelectorAll(".scope-tab[data-scope]");
    for (var i = 0; i < scopeTabs.length; i++) {
      scopeTabs[i].classList.toggle("active", scopeTabs[i].getAttribute("data-scope") === activeScope);
    }

    var statusChips = document.querySelectorAll(".status-chip[data-status]");
    for (var j = 0; j < statusChips.length; j++) {
      statusChips[j].classList.toggle("active", statusChips[j].getAttribute("data-status") === activeStatusFilter);
    }

    var listEl = document.getElementById("tasks-list");
    listEl.textContent = "";

    var rawList = filterTasksByScope(activeScope);
    var filtered = rawList
      .filter(function (t) {
        if (activeStatusFilter === "all") {
          // все активные статусы (без Закрыта / Отклонена / Решена)
        } else if (activeStatusFilter === "opened") {
          if (t.status_code !== "opened" && t.status_code !== "resend") return false;
        } else if (activeStatusFilter === "work") {
          if (t.status_code !== "work") return false;
        } else if (activeStatusFilter === "working") {
          if (t.status_code !== "working" && t.status_code !== "restart") return false;
        } else if (t.status_code !== activeStatusFilter) {
          return false;
        }
        if (searchQuery) {
          var q = searchQuery.toLowerCase();
          var assignee = getEmployeeById(t.assignee_id);
          var hay = [
            t.id,
            t.title,
            t.description,
            t.company_name,
            t.entity_name,
            assignee ? assignee.name : ""
          ]
            .join(" ")
            .toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      })
      .slice()
      .sort(function (a, b) {
        var ca = String(a.created_at || "");
        var cb = String(b.created_at || "");
        if (ca !== cb) return cb.localeCompare(ca);
        return (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0);
      });

    if (filtered.length === 0) {
      var emptyCard = el("div", "section-card");
      emptyCard.appendChild(el("h3", "", "Заявок по выбранному фильтру нет"));
      emptyCard.appendChild(
        el(
          "p",
          "section-desc",
          activeScope === "mine"
            ? "У сотрудника " + currentEmp.short + " нет собственных заявок (соисполнители coexecutors не попадают в «Мои задачи»)."
            : "Попробуйте переключить фильтр или создайте новую заявку."
        )
      );
      listEl.appendChild(emptyCard);
      return;
    }

    filtered.forEach(function (task) {
      listEl.appendChild(buildTaskCardDOM(task));
    });
  }

  // --- Карточка задачи с переключением статуса по клику на кнопку статуса и свёрнутым описанием ---
  function buildTaskCardDOM(task) {
    var role = getTaskRole(task, currentEmp.id);
    var isCoexec = Array.isArray(task.coexecutors) && task.coexecutors.indexOf(String(currentEmp.id)) !== -1;
    var card = el("article", "task-card role-" + role);

    // 1. Верхняя строка: #ID + бейдж роли + интерактивная кнопка статуса (цвета Okdesk)
    var topRow = el("div", "task-top-row");
    var idGroup = el("div", "task-id-group");
    idGroup.appendChild(el("span", "task-id", "#" + task.id));

    var roleText =
      role === "own"
        ? "Моя задача"
        : role === "control"
        ? "На контроле"
        : isCoexec
        ? "Соисполнитель"
        : "Задача отдела";
    idGroup.appendChild(el("span", "role-badge " + role, roleText));
    topRow.appendChild(idGroup);

    var stMeta = STATUS_META[task.status_code] || { label: task.status_name || "Открыта", cls: "status-opened" };
    var statusWrap = el("div", "status-popover-wrap");
    var statusBtn = el("button", "status-badge " + stMeta.cls);
    statusBtn.type = "button";
    statusBtn.title = "Нажмите для смены статуса заявки";
    statusBtn.appendChild(el("span", "status-dot"));
    statusBtn.appendChild(el("span", "", stMeta.label + " ▾"));

    var inlinePopover = el("div", "status-inline-popover hidden");
    var allowedTargets = OKDESK_TRANSITIONS[task.status_code] || ["work", "working", "delayed", "completed", "asya1c"];
    var ACTION_LABELS = {
      work: "Принял",
      working: "Выполняю",
      delayed: "Отложить",
      resend: "Передать",
      completed: "Решена",
      asya1c: "Отклонить",
      restart: "На доработку"
    };
    allowedTargets.forEach(function (targetCode) {
      var m = STATUS_META[targetCode] || { label: targetCode, cls: "status-opened" };
      var pill = el("button", "status-inline-pill " + m.cls);
      pill.type = "button";
      pill.appendChild(el("span", "status-dot"));
      pill.appendChild(el("span", "", ACTION_LABELS[targetCode] || m.label));
      pill.addEventListener("click", function (ev) {
        ev.stopPropagation();
        inlinePopover.classList.add("hidden");
        handleCardAction(task, targetCode);
      });
      inlinePopover.appendChild(pill);
    });

    statusBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      hapticImpact("light");
      var wasHidden = inlinePopover.classList.contains("hidden");
      var allOpen = document.querySelectorAll(".status-inline-popover:not(.hidden)");
      for (var p = 0; p < allOpen.length; p++) {
        allOpen[p].classList.add("hidden");
      }
      if (wasHidden) {
        inlinePopover.classList.remove("hidden");
      }
    });

    statusWrap.appendChild(statusBtn);
    statusWrap.appendChild(inlinePopover);
    topRow.appendChild(statusWrap);
    card.appendChild(topRow);

    // 2. Заголовок и свёрнутое описание (раскрывается по нажатию)
    var titleEl = el("div", "task-title", task.title);
    card.appendChild(titleEl);

    var descBox = el("div", "task-desc-box");
    var rawBody = safeText(task.description, 1500);
    var hasBody = Boolean(rawBody && rawBody !== task.title);
    var toggleBtn = el(
      "button",
      "task-desc-toggle",
      hasBody ? "📄 Описание заявки · нажмите, чтобы прочитать ▾" : "📄 Описание заявки (кратко) ▾"
    );
    toggleBtn.type = "button";
    var bodyDiv = el(
      "div",
      "task-desc-body hidden",
      hasBody ? rawBody : (task.timeline_summary || "В теле заявки указана только тема: «" + task.title + "».")
    );
    function toggleDesc() {
      hapticImpact("light");
      var isHidden = bodyDiv.classList.toggle("hidden");
      toggleBtn.textContent = isHidden
        ? (hasBody ? "📄 Описание заявки · нажмите, чтобы прочитать ▾" : "📄 Описание заявки (кратко) ▾")
        : "📄 Скрыть описание заявки ▴";
    }
    toggleBtn.addEventListener("click", toggleDesc);
    titleEl.addEventListener("click", toggleDesc);
    descBox.appendChild(toggleBtn);
    descBox.appendChild(bodyDiv);
    card.appendChild(descBox);

    // 3. Автоматическая полоса времени в системе и живого таймера выполнения
    var tStats = getTaskTimingStats(task);
    var timerStrip = el("div", "task-timer-strip");
    var sysSpan = el("span", "timer-pill-sys", "⏳ " + tStats.stageLabel + ": " + formatDurationSec(tStats.sysSec, false));
    var workSpan = el(
      "span",
      "timer-pill-work" + (tStats.isTicking ? " ticking" : ""),
      (tStats.isTicking
        ? "⏱ Таймер: " + formatDurationSec(tStats.workSec, true)
        : tStats.isPaused
        ? "⏸ Пауза: " + formatDurationSec(tStats.workSec, true)
        : "⏱ В работе: " + formatDurationSec(tStats.workSec, false)) +
        " · Списано: " + formatMinutes(tStats.spentMins)
    );
    workSpan.setAttribute("data-timer-task-id", String(task.id));
    sysSpan.setAttribute("data-sys-task-id", String(task.id));
    timerStrip.appendChild(sysSpan);
    timerStrip.appendChild(workSpan);
    card.appendChild(timerStrip);

    // 4. Компактная сводка метаданных
    var assigneeEmp = getEmployeeById(task.assignee_id);
    var coexecNames = (task.coexecutors || [])
      .map(function (cid) {
        var ce = getEmployeeById(cid);
        return ce ? ce.short.split(" ")[0] : cid;
      })
      .join(", ");

    var metaGrid = el("div", "task-meta-grid");
    var items = [
      ["Создана", task.created_at || "—"],
      ["Клиент", task.company_name || "—"],
      ["Объект", task.entity_name || "Без объекта"],
      ["Исполнитель", assigneeEmp ? assigneeEmp.short : "Не назначен"],
      ["Срок SLA", task.deadline_at || task.deadline || "Без срока"]
    ];
    if (coexecNames) {
      items.push(["Соисполнители", coexecNames]);
    }
    items.forEach(function (pair) {
      var mItem = el("div", "meta-item");
      mItem.appendChild(el("span", "meta-lbl", pair[0] + ": "));
      mItem.appendChild(el("span", "meta-val", pair[1]));
      metaGrid.appendChild(mItem);
    });
    card.appendChild(metaGrid);

    // 5. Комментарии (если есть)
    if (Array.isArray(task.comments) && task.comments.length > 0) {
      var cBox = el("div", "task-comments-box");
      task.comments.slice(-3).forEach(function (c) {
        var line = el("div", "comment-line");
        line.appendChild(el("span", "comment-author", c.author + " (" + c.time + "): "));
        line.appendChild(el("span", "", c.text));
        if (Array.isArray(c.attachments) && c.attachments.length > 0) {
          line.appendChild(el("span", "meta-lbl", " [📎 " + c.attachments.join(", ") + "]"));
        }
        cBox.appendChild(line);
      });
      card.appendChild(cBox);
    }

    // 6. Панель кнопок (статусы перенесены на кнопку статуса вверху карточки; в «Ещё ▾» только действия)
    var primaryBar = el("div", "task-primary-bar");
    var moreGrid = el("div", "task-kb-grid task-more-grid hidden");

    function makeActionBtn(text, cls, onClick) {
      var b = el("button", "task-btn " + (cls || ""), text);
      b.type = "button";
      b.addEventListener("click", onClick);
      return b;
    }

    if (role === "own") {
      if (task.status_code === "opened" || task.status_code === "resend") {
        primaryBar.appendChild(
          makeActionBtn("Принял", "btn-work", function () {
            handleCardAction(task, "work");
          })
        );
        primaryBar.appendChild(
          makeActionBtn("Выполняю ⏱", "btn-solve", function () {
            handleCardAction(task, "working");
          })
        );
      } else if (task.status_code === "work" || task.status_code === "delayed" || task.status_code === "restart") {
        primaryBar.appendChild(
          makeActionBtn("Выполняю ⏱", "btn-solve", function () {
            handleCardAction(task, "working");
          })
        );
        primaryBar.appendChild(
          makeActionBtn("Решена", "btn-solve", function () {
            handleCardAction(task, "completed");
          })
        );
      } else {
        primaryBar.appendChild(
          makeActionBtn("Решена", "btn-solve", function () {
            handleCardAction(task, "completed");
          })
        );
        primaryBar.appendChild(
          makeActionBtn(
            tStats.isTicking ? "⏸ Пауза" : "▶ Продолжить",
            tStats.isTicking ? "btn-warn" : "btn-work",
            function () {
              toggleTaskPauseResume(task);
            }
          )
        );
      }
      moreGrid.appendChild(
        makeActionBtn("Передать задачу", "", function () {
          openDelegateModal(task);
        })
      );
      if (currentEmp.role === "admin" || String(currentEmp.id) === "1") {
        moreGrid.appendChild(
          makeActionBtn("⚡ Закрыть (-15м)", "btn-solve", function () {
            closeOneClick15(task);
          })
        );
      }
    } else if (role === "control") {
      primaryBar.appendChild(
        makeActionBtn("↩️ Забрать себе", "btn-work", function () {
          takeTaskToSelf(task);
        })
      );
      primaryBar.appendChild(
        makeActionBtn("Уведомить исполнителя", "", function () {
          nudgeAssignee(task);
        })
      );
      moreGrid.appendChild(
        makeActionBtn("Делегировать", "", function () {
          openDelegateModal(task);
        })
      );
      if (currentEmp.role === "admin" || String(currentEmp.id) === "1") {
        moreGrid.appendChild(
          makeActionBtn("⚡ Закрыть (-15м)", "btn-solve", function () {
            closeOneClick15(task);
          })
        );
      }
    } else {
      primaryBar.appendChild(
        makeActionBtn("Забрать себе", "btn-work", function () {
          openTakeConfirmModal(task);
        })
      );
      if (currentEmp.role === "admin") {
        primaryBar.appendChild(
          makeActionBtn("Назначить", "", function () {
            openDelegateModal(task);
          })
        );
        moreGrid.appendChild(
          makeActionBtn("Уведомить исполнителя", "", function () {
            nudgeAssignee(task);
          })
        );
      }
    }

    moreGrid.appendChild(
      makeActionBtn("💬 Написать заявителю", "", function () {
        openCommentModal(task, true);
      })
    );
    moreGrid.appendChild(
      makeActionBtn("Комментарий 📎", "", function () {
        openCommentModal(task, false);
      })
    );
    moreGrid.appendChild(
      makeActionBtn("⏱ История таймера и этапов", "", function () {
        openTaskTimerHistoryModal(task);
      })
    );
    moreGrid.appendChild(
      makeActionBtn("Открыть на портале", "", function () {
        openIssueInOkdesk(task.id);
      })
    );
    moreGrid.appendChild(
      makeActionBtn("Скопировать ссылку", "", function () {
        copyIssueLink(task.id);
      })
    );

    var btnMoreToggle = el("button", "task-btn task-btn-more", "Ещё ▾");
    btnMoreToggle.type = "button";
    btnMoreToggle.addEventListener("click", function () {
      hapticImpact("light");
      var isHidden = moreGrid.classList.toggle("hidden");
      btnMoreToggle.textContent = isHidden ? "Ещё ▾" : "Скрыть ▴";
      btnMoreToggle.classList.toggle("active", !isHidden);
    });
    primaryBar.appendChild(btnMoreToggle);

    card.appendChild(primaryBar);
    card.appendChild(moreGrid);
    return card;
  }

  document.addEventListener("click", function () {
    var allOpen = document.querySelectorAll(".status-inline-popover:not(.hidden)");
    for (var p = 0; p < allOpen.length; p++) {
      allOpen[p].classList.add("hidden");
    }
  });

  // Живое обновление секундомера на карточках в статусе «Выполняю» + почасовые напоминания в колокольчик 🔔
  setInterval(function () {
    var hasHourlyChanges = false;
    for (var m = 0; m < state.tasks.length; m++) {
      var tk = state.tasks[m];
      var tst = getTaskTimingStats(tk);
      if (tst.isTicking && String(tk.assignee_id) === String(currentEmp.id)) {
        var hoursDone = Math.floor(tst.workSec / 3600);
        var lastNotifiedHour = parseInt(tk.last_bell_hour, 10) || 0;
        if (hoursDone >= 1 && hoursDone > lastNotifiedHour) {
          tk.last_bell_hour = hoursDone;
          hasHourlyChanges = true;
          showToast("🔔 Напоминание (" + hoursDone + " ч): в работе задача #" + tk.id);
        }
      }
    }
    if (hasHourlyChanges) {
      saveState();
      updateBellBadge();
    }

    if (activeView !== "tasks") return;
    var nodes = document.querySelectorAll("[data-timer-task-id]");
    for (var i = 0; i < nodes.length; i++) {
      var tid = nodes[i].getAttribute("data-timer-task-id");
      var taskObj = null;
      for (var k = 0; k < state.tasks.length; k++) {
        if (String(state.tasks[k].id) === String(tid)) {
          taskObj = state.tasks[k];
          break;
        }
      }
      if (taskObj) {
        var st = getTaskTimingStats(taskObj);
        nodes[i].textContent =
          (st.isTicking
            ? "⏱ Таймер: " + formatDurationSec(st.workSec, true)
            : st.isPaused
            ? "⏸ Пауза: " + formatDurationSec(st.workSec, true)
            : "⏱ В работе: " + formatDurationSec(st.workSec, false)) +
          " · Списано: " + formatMinutes(st.spentMins);
      }
    }
  }, 1000);

  // --- Модальное окно смены статуса прямо с кнопки статуса на карточке ---
  function openStatusTransitionModal(task) {
    var curMeta = STATUS_META[task.status_code] || { label: task.status_name || "Открыта", cls: "status-opened" };
    openActionModal("Статус заявки #" + task.id);

    var tStats = getTaskTimingStats(task);
    modalBodyEl.appendChild(
      el(
        "p",
        "section-desc",
        "Текущий статус: «" +
          curMeta.label +
          "» · В системе: " +
          formatDurationSec(tStats.sysSec, false) +
          " · По таймеру: " +
          formatDurationSec(tStats.workSec, true)
      )
    );

    var allowed = OKDESK_TRANSITIONS[task.status_code] || ["work", "working", "delayed", "completed", "asya1c"];
    var list = el("div", "status-picker-list");

    allowed.forEach(function (targetCode) {
      var meta = STATUS_META[targetCode] || { label: targetCode, cls: "status-opened" };
      var btn = el("button", "status-option-btn " + meta.cls);
      btn.type = "button";
      var leftText = meta.label;
      if (targetCode === "working") leftText += " (запустить таймер ⏱)";
      if (targetCode === "completed") leftText += " (списать время и закрыть)";
      if (targetCode === "delayed") leftText += " (выбрать срок переноса)";
      if (targetCode === "resend") leftText += " (передать сотруднику)";
      btn.appendChild(el("span", "", leftText));
      btn.appendChild(el("span", "", "→"));
      btn.addEventListener("click", function () {
        closeActionModal();
        handleCardAction(task, targetCode);
      });
      list.appendChild(btn);
    });

    modalBodyEl.appendChild(list);
  }

  // --- Модальное окно «⏱ История таймера и этапов» (разбивка времени по каждому исполнителю при передачах) ---
  function openTaskTimerHistoryModal(task) {
    openActionModal("⏱ Таймер и этапы · #" + task.id);
    var tStats = getTaskTimingStats(task);
    var waitSec = Math.max(0, tStats.sysSec - tStats.totalWorkSec);
    var timerMins = Math.round(tStats.totalWorkSec / 60);
    var diffMins = (tStats.spentMins || 0) - timerMins;
    var diffStr =
      diffMins === 0
        ? "совпадает с таймером"
        : diffMins > 0
        ? "+" + formatMinutes(diffMins) + " сверх таймера"
        : "-" + formatMinutes(Math.abs(diffMins)) + " меньше таймера";

    var summaryCard = el("div", "glass-card");
    var rows = [
      ["В системе (с момента создания)", formatDurationSec(tStats.sysSec, false)],
      ["Ожидание / без активного таймера", formatDurationSec(waitSec, false)],
      [
        "Личный таймер (" + (task.assignee_name || currentEmp.short) + ")",
        formatDurationSec(tStats.ownWorkSec, true) +
          (tStats.isTicking ? " (идёт ⏱)" : tStats.isPaused ? " (пауза ⏸)" : "")
      ],
      ["Общий таймер всех исполнителей", formatDurationSec(tStats.totalWorkSec, true)],
      ["Списано суммарно", formatMinutes(tStats.spentMins) + " (" + diffStr + ")"],
      ["Текущий этап", tStats.stageLabel + " · «" + (task.status_name || "Открыта") + "»"]
    ];
    rows.forEach(function (pair) {
      var r = el("div", "stat-row");
      r.appendChild(el("span", "", pair[0]));
      r.appendChild(el("strong", "", pair[1]));
      summaryCard.appendChild(r);
    });
    modalBodyEl.appendChild(summaryCard);

    // Секция: Разделение таймера по исполнителям (при передаче заявки)
    var empTitle = el("div", "form-label", "👥 Разделение времени по исполнителям:");
    modalBodyEl.appendChild(empTitle);

    var empBox = el("div", "glass-card");
    var chain = Array.isArray(task.delegation_chain) ? task.delegation_chain : [];
    if (chain.length > 0) {
      var chainParts = chain.map(function (c) {
        return c.from_short + ": " + formatDurationSec(c.from_sec, true);
      });
      var curAss = getEmployeeById(task.assignee_id) || currentEmp;
      chainParts.push(
        curAss.short +
          ": " +
          formatDurationSec(tStats.ownWorkSec, true) +
          (tStats.isTicking ? " ⏱" : "")
      );
      var chainBanner = el("div", "task-desc-body", "🔀 Цепочка передач: " + chainParts.join(" → передал → "));
      chainBanner.style.marginBottom = "8px";
      chainBanner.style.fontWeight = "600";
      empBox.appendChild(chainBanner);
    }

    var empIdsShown = {};
    Object.keys(tStats.byEmp || {}).forEach(function (eid) {
      empIdsShown[String(eid)] = true;
    });
    if (task.assignee_id) {
      empIdsShown[String(task.assignee_id)] = true;
    }
    var spentMap = task.spent_by_employee || {};
    Object.keys(empIdsShown).forEach(function (eid) {
      var empObj = getEmployeeById(eid);
      var eName = empObj ? empObj.short : "ID " + eid;
      var secVal = (tStats.byEmp && tStats.byEmp[eid]) || 0;
      var spentVal = parseInt(spentMap[eid], 10) || 0;
      var isCurrentOwner = String(task.assignee_id) === String(eid);
      var stateTag = isCurrentOwner
        ? tStats.isTicking
          ? " · активен ⏱"
          : tStats.isPaused
          ? " · на паузе ⏸"
          : " · текущий исп."
        : " · передал дальше";
      var er = el("div", "stat-row");
      er.appendChild(el("span", "", "👤 " + eName + stateTag));
      er.appendChild(
        el(
          "strong",
          "",
          "Таймер: " +
            formatDurationSec(secVal, true) +
            (spentVal > 0 ? " · Списано: " + formatMinutes(spentVal) : "")
        )
      );
      empBox.appendChild(er);
    });
    modalBodyEl.appendChild(empBox);

    var histTitle = el("div", "form-label", "Хронология этапов заявки:");
    modalBodyEl.appendChild(histTitle);

    var histBox = el("div", "glass-card");
    var baseSteps = [
      { time: task.created_at || "При создании", label: "📥 Заявка зарегистрирована в системе (На техотделе)" }
    ];
    if (task.assignee_id) {
      var emp = getEmployeeById(task.assignee_id);
      baseSteps.push({
        time: task.updated_at || task.created_at || "Назначена",
        label: "👤 Исполнитель: " + (emp ? emp.short : "ID " + task.assignee_id)
      });
    }
    var customHist = Array.isArray(task.status_history) ? task.status_history : [];
    var allSteps = baseSteps.concat(customHist);
    allSteps.forEach(function (step) {
      var r = el("div", "stat-row");
      r.appendChild(el("span", "", step.time));
      r.appendChild(el("strong", "", step.label));
      histBox.appendChild(r);
    });
    modalBodyEl.appendChild(histBox);

    var toggleTimerBtn = el(
      "button",
      "btn-primary-full",
      tStats.isTicking ? "⏸ Поставить таймер на паузу" : "▶ Продолжить таймер (Выполняю)"
    );
    toggleTimerBtn.type = "button";
    toggleTimerBtn.addEventListener("click", function () {
      closeActionModal();
      toggleTaskPauseResume(task);
    });
    modalBodyEl.appendChild(toggleTimerBtn);
  }

  // --- Обработчики действий по карточке ---
  function handleCardAction(task, actionCode) {
    hapticImpact("light");
    if (actionCode === "completed") {
      openSpentTimeCalculatorModal(task);
      return;
    }
    if (actionCode === "delayed") {
      openPostponeModal(task);
      return;
    }
    if (actionCode === "resend") {
      openDelegateModal(task);
      return;
    }
    if (actionCode === "work") {
      applyQuickStatus(task, "work", "Принял");
      return;
    }
    if (actionCode === "working") {
      applyQuickStatus(task, "working", "Выполняю");
      return;
    }
    if (actionCode === "restart") {
      applyQuickStatus(task, "restart", "На доработку");
      return;
    }
    if (actionCode === "asya1c") {
      openRejectTaskModal(task);
      return;
    }
  }

  function stopTaskWorkTimerIfRunning(task) {
    if (task.status_code === "working" && !task.timer_paused) {
      var startMs = parseTaskDateMs(task.work_started_at || task.updated_iso);
      if (startMs > 0) {
        var deltaSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        var ownerId = String(task.work_owner_id || task.assignee_id || currentEmp.id);
        task.work_by_employee = task.work_by_employee && typeof task.work_by_employee === "object" ? task.work_by_employee : {};
        if ((parseInt(task.tracked_work_seconds, 10) || 0) > 0 && Object.keys(task.work_by_employee).length === 0) {
          task.work_by_employee[ownerId] = parseInt(task.tracked_work_seconds, 10) || 0;
        }
        task.work_by_employee[ownerId] = (parseInt(task.work_by_employee[ownerId], 10) || 0) + deltaSec;
        task.tracked_work_seconds = (parseInt(task.tracked_work_seconds, 10) || 0) + deltaSec;
      }
      task.work_started_at = "";
    }
  }

  function toggleTaskPauseResume(task) {
    hapticImpact("medium");
    var st = getTaskTimingStats(task);
    var ownerEmp = getEmployeeById(task.assignee_id) || currentEmp;
    task.status_history = Array.isArray(task.status_history) ? task.status_history : [];
    if (st.isTicking) {
      stopTaskWorkTimerIfRunning(task);
      task.timer_paused = true;
      task.status_history.push({
        time: new Date().toTimeString().slice(0, 8),
        label: "⏸ Пауза таймера (" + ownerEmp.short + ": " + formatDurationSec(st.ownWorkSec, true) + ")"
      });
      showToast("⏸ Таймер по заявке #" + task.id + " на паузе");
    } else {
      task.timer_paused = false;
      task.work_owner_id = String(task.assignee_id || currentEmp.id);
      task.work_started_at = new Date().toISOString();
      task.status_code = "working";
      task.status_name = "Выполняю";
      task.status_history.push({
        time: new Date().toTimeString().slice(0, 8),
        label: "▶ Старт / продолжение таймера (" + ownerEmp.short + ")"
      });
      showToast("▶ Таймер по заявке #" + task.id + " запущен");
    }
    saveState();
    renderTasksView();
    updateBellBadge();
  }

  function applyQuickStatus(task, code, label) {
    var ownerEmp = getEmployeeById(task.assignee_id) || currentEmp;
    task.status_history = Array.isArray(task.status_history) ? task.status_history : [];
    if (code === "working") {
      if (task.status_code !== "working" || task.timer_paused || !task.work_started_at) {
        task.work_started_at = new Date().toISOString();
        task.work_owner_id = String(task.assignee_id || currentEmp.id);
      }
      task.timer_paused = false;
      task.status_history.push({
        time: new Date().toTimeString().slice(0, 8),
        label: "🔧 Статус «Выполняю» — запущен таймер (" + ownerEmp.short + ")"
      });
    } else {
      var prevStats = getTaskTimingStats(task);
      stopTaskWorkTimerIfRunning(task);
      task.timer_paused = false;
      task.work_started_at = "";
      task.status_history.push({
        time: new Date().toTimeString().slice(0, 8),
        label:
          "📌 Статус «" +
          label +
          "» — таймер остановлен (" +
          ownerEmp.short +
          ": " +
          formatDurationSec(prevStats.ownWorkSec, true) +
          ")"
      });
    }
    task.status_code = code;
    task.status_name = label;
    task.updated_iso = new Date().toISOString();
    saveState();
    renderTasksView();
    updateBellBadge();
    showToast("Заявка #" + task.id + " → «" + label + "»");
  }

  function closeOneClick15(task) {
    hapticNotify("success");
    stopTaskWorkTimerIfRunning(task);
    task.timer_paused = false;
    task.status_code = "completed";
    task.status_name = "Решена";
    task.spent_minutes = (parseInt(task.spent_minutes, 10) || 0) + 15;
    task.spent_by_employee = task.spent_by_employee || {};
    var myId = String(currentEmp.id);
    task.spent_by_employee[myId] = (parseInt(task.spent_by_employee[myId], 10) || 0) + 15;
    task.comments = task.comments || [];
    task.comments.push({
      author: currentEmp.short,
      time: new Date().toTimeString().slice(0, 5),
      text: "Закрыто в 1 клик (+15 мин)."
    });
    saveState();
    renderTasksView();
    updateBellBadge();
    showToast("⚡ Заявка #" + task.id + " закрыта (+15 мин)");
  }

  function takeTaskToSelf(task) {
    hapticNotify("success");
    var prevEmp = getEmployeeById(task.assignee_id);
    var prevStats = getTaskTimingStats(task);
    stopTaskWorkTimerIfRunning(task);
    if (prevEmp && String(prevEmp.id) !== String(currentEmp.id)) {
      var prevSec = (prevStats.byEmp && prevStats.byEmp[String(prevEmp.id)]) || 0;
      task.delegation_chain = Array.isArray(task.delegation_chain) ? task.delegation_chain : [];
      task.delegation_chain.push({
        from_id: String(prevEmp.id),
        from_short: prevEmp.short,
        from_sec: prevSec,
        to_id: String(currentEmp.id),
        to_short: currentEmp.short,
        time: new Date().toTimeString().slice(0, 8)
      });
    }
    task.assignee_id = String(currentEmp.id);
    task.assignee_name = currentEmp.short;
    task.work_owner_id = String(currentEmp.id);
    task.timer_paused = false;
    task.work_started_at = new Date().toISOString();
    task.status_code = "working";
    task.status_name = "Выполняю";
    task.status_history = Array.isArray(task.status_history) ? task.status_history : [];
    task.status_history.push({
      time: new Date().toTimeString().slice(0, 8),
      label: "↩️ Забрал в работу: " + currentEmp.short + " (запущен личный таймер)"
    });
    saveState();
    closeActionModal();
    renderTasksView();
    updateBellBadge();
    showToast("↩️ Заявка #" + task.id + " переведена на вас (" + currentEmp.short + ")");
  }

  // Напоминание исполнителю в Telegram (тестовый режим: отправка на админский ID Стрелкина М. В. с 4 кнопками)
  function nudgeAssignee(task) {
    var now = Date.now();
    var last = (state.nudgeTimestamps && state.nudgeTimestamps[task.id]) || 0;
    if (now - last < 15000) {
      var waitSec = Math.ceil((15000 - (now - last)) / 1000);
      showToast("⏳ Повторное напоминание через " + waitSec + " сек.");
      return;
    }
    state.nudgeTimestamps = state.nudgeTimestamps || {};
    state.nudgeTimestamps[task.id] = now;
    var assignee = getEmployeeById(task.assignee_id);
    var adminRecipient = getEmployeeById("1") || currentEmp;

    task.comments = task.comments || [];
    task.comments.push({
      author: currentEmp.short,
      time: new Date().toTimeString().slice(0, 5),
      text:
        "Уведомление в TG (тест на Admin ID " +
        adminRecipient.tg_id +
        " · " +
        adminRecipient.short +
        ") по исполнителю " +
        (assignee ? assignee.short : "не назначен")
    });
    saveState();
    renderTasksView();

    openActionModal("🔔 Уведомление в Telegram · #" + task.id);
    modalBodyEl.appendChild(
      el(
        "p",
        "section-desc",
        "Тестовый режим: уведомление направлено на ваш админский Telegram ID (" +
          adminRecipient.tg_id +
          " · " +
          adminRecipient.short +
          "). Исполнитель по карточке: " +
          (assignee ? assignee.name : "Не назначен") +
          "."
      )
    );

    var msgPreview = el("div", "task-desc-body");
    msgPreview.textContent =
      "🔔 Напоминание о заявке #" +
      task.id +
      "\nТема: " +
      task.title +
      "\nСтатус: " +
      (STATUS_META[task.status_code] ? STATUS_META[task.status_code].label : task.status_name) +
      "\nКлиент: " +
      (task.company_name || "Без компании") +
      "\nИсполнитель: " +
      (assignee ? assignee.short : "Не назначен");
    modalBodyEl.appendChild(msgPreview);

    var kbTitle = el("div", "form-label", "4 кнопки сообщения в Telegram:");
    modalBodyEl.appendChild(kbTitle);

    var kbGrid = el("div", "assignee-grid");

    var b1 = el("button", "btn-secondary-full", "🌐 Открыть на портале");
    b1.type = "button";
    b1.addEventListener("click", function () {
      openIssueInOkdesk(task.id);
    });
    kbGrid.appendChild(b1);

    var b2 = el("button", "btn-secondary-full", "🟠 Открыть в Okdesk");
    b2.type = "button";
    b2.addEventListener("click", function () {
      openIssueInOkdesk(task.id);
    });
    kbGrid.appendChild(b2);

    var b3 = el("button", "btn-secondary-full", "🤖 Открыть в боте");
    b3.type = "button";
    b3.addEventListener("click", function () {
      openIssueInBotChat(task.id);
    });
    kbGrid.appendChild(b3);

    var b4 = el("button", "btn-primary-full", "📱 В мини-приложении");
    b4.type = "button";
    b4.addEventListener("click", function () {
      closeActionModal();
      searchInput.value = String(task.id);
      searchQuery = String(task.id);
      searchClear.classList.remove("hidden");
      renderTasksView();
    });
    kbGrid.appendChild(b4);

    modalBodyEl.appendChild(kbGrid);
  }

  function openIssueInOkdesk(issueId) {
    var url = "https://565.okdesk.ru/issues/" + encodeURIComponent(issueId);
    if (tg && typeof tg.openLink === "function") {
      try {
        tg.openLink(url);
        return;
      } catch (_e) {}
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function copyIssueLink(issueId) {
    var url = "https://565.okdesk.ru/issues/" + encodeURIComponent(issueId);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { showToast("Ссылка скопирована: " + url); },
        function () { showToast("Ссылка: " + url); }
      );
    } else {
      showToast("Ссылка: " + url);
    }
  }

  function openIssueInBotChat(issueId) {
    var link = "https://t.me/itsupp_task_bot?start=task_" + encodeURIComponent(issueId);
    if (tg && typeof tg.openTelegramLink === "function") {
      try {
        tg.openTelegramLink(link);
        return;
      } catch (_e) {}
    }
    showToast("Переход в бот: @itsupp_task_bot?start=task_" + issueId);
  }

  // --- Модальные окна действий ---
  var actionModal = document.getElementById("action-modal");
  var modalTitleEl = document.getElementById("modal-title");
  var modalBodyEl = document.getElementById("modal-body");

  function openActionModal(title) {
    modalTitleEl.textContent = title;
    modalBodyEl.textContent = "";
    actionModal.classList.remove("hidden");
  }

  function closeActionModal() {
    actionModal.classList.add("hidden");
  }

  document.getElementById("btn-modal-close").addEventListener("click", closeActionModal);

  // 1. Калькулятор списания времени + сравнение с реальным временем по таймеру
  function openSpentTimeCalculatorModal(task) {
    openActionModal("Решить и списать время · #" + task.id);
    var tStats = getTaskTimingStats(task);
    var timerMins = Math.max(1, Math.round(tStats.ownWorkSec / 60));
    var addedMins = tStats.ownWorkSec >= 60 ? timerMins : 15;
    var billingFlag = task.billing_flag || "none";

    var statsCompare = el(
      "div",
      "task-timer-strip",
      "⏳ В системе: " +
        formatDurationSec(tStats.sysSec, false) +
        " · ⏱ Ваш таймер: " +
        formatDurationSec(tStats.ownWorkSec, true) +
        (tStats.totalWorkSec !== tStats.ownWorkSec
          ? " · Все исп.: " + formatDurationSec(tStats.totalWorkSec, true)
          : "")
    );
    modalBodyEl.appendChild(statsCompare);

    var display = el("div", "calc-display", "К списанию (" + currentEmp.short + "): " + formatMinutes(addedMins));
    modalBodyEl.appendChild(display);

    var billingRow = el("div", "segmented-row");
    var billingOptions = [
      { flag: "none", label: "Обычная" },
      { flag: "overtime", label: "Переработка" },
      { flag: "out_of_contract", label: "Вне договора" }
    ];
    function renderBillingBtns() {
      billingRow.textContent = "";
      billingOptions.forEach(function (opt) {
        var b = el(
          "button",
          "seg-btn" + (billingFlag === opt.flag ? " active" : ""),
          opt.label
        );
        b.type = "button";
        b.addEventListener("click", function () {
          billingFlag = opt.flag;
          renderBillingBtns();
        });
        billingRow.appendChild(b);
      });
    }
    renderBillingBtns();
    modalBodyEl.appendChild(billingRow);

    var row1Deltas = [-5, 5, -10, 10, -15, 15];
    var row2Deltas = [-30, 30, -120, 120, -240, 240];

    function makeDeltaRow(deltas) {
      var grid = el("div", "calc-grid-6");
      deltas.forEach(function (d) {
        var lbl = Math.abs(d) >= 60 ? (d > 0 ? "+" : "-") + Math.abs(d) / 60 + "ч" : (d > 0 ? "+" : "") + d + "м";
        var btn = el("button", "calc-btn", lbl);
        btn.type = "button";
        btn.addEventListener("click", function () {
          hapticImpact("light");
          addedMins = Math.max(0, addedMins + d);
          display.textContent = "К списанию (" + currentEmp.short + "): " + formatMinutes(addedMins);
        });
        grid.appendChild(btn);
      });
      return grid;
    }

    modalBodyEl.appendChild(makeDeltaRow(row1Deltas));
    modalBodyEl.appendChild(makeDeltaRow(row2Deltas));

    var commentInput = el("textarea", "form-textarea");
    commentInput.rows = 3;
    commentInput.placeholder = "Комментарий к решению (необязательно)…";
    modalBodyEl.appendChild(commentInput);

    var btnOk = el("button", "btn-primary-full", "✓ Подтвердить решение и записать время");
    btnOk.type = "button";
    btnOk.addEventListener("click", function () {
      hapticNotify("success");
      stopTaskWorkTimerIfRunning(task);
      task.timer_paused = false;
      task.status_code = "completed";
      task.status_name = "Решена";
      task.spent_minutes = (parseInt(task.spent_minutes, 10) || 0) + addedMins;
      task.spent_by_employee = task.spent_by_employee || {};
      var myId = String(currentEmp.id);
      task.spent_by_employee[myId] = (parseInt(task.spent_by_employee[myId], 10) || 0) + addedMins;
      task.billing_flag = billingFlag;
      var cText = safeText(commentInput.value, 400);
      task.comments = task.comments || [];
      task.comments.push({
        author: currentEmp.short,
        time: new Date().toTimeString().slice(0, 5),
        text:
          "Решена (списано: +" +
          formatMinutes(addedMins) +
          ", личный таймер: " +
          formatDurationSec(tStats.ownWorkSec, true) +
          ")" +
          (cText ? ": " + cText : "")
      });
      saveState();
      closeActionModal();
      renderTasksView();
      updateBellBadge();
      showToast("Заявка #" + task.id + " решена (+" + formatMinutes(addedMins) + ")");
    });
    modalBodyEl.appendChild(btnOk);
  }

  // 2. Модальное окно «Отложить»
  function openPostponeModal(task) {
    openActionModal("Отложить заявку #" + task.id);

    var quickSlots = [
      { label: "Завтра 10:00 · +5 мин", deadline: "Завтра 10:00", addMins: 5, bucket: "upcoming" },
      { label: "Послезавтра 10:00 · +5 мин", deadline: "Послезавтра 10:00", addMins: 5, bucket: "upcoming" },
      { label: "Через 7 дней 10:00 · +5 мин", deadline: "Через 7 дней 10:00", addMins: 5, bucket: "upcoming" },
      { label: "Через 20 минут", deadline: "Сегодня (+20 мин)", addMins: 0, bucket: "today" },
      { label: "Через 40 минут", deadline: "Сегодня (+40 мин)", addMins: 0, bucket: "today" },
      { label: "Через 1 час", deadline: "Сегодня (+1 час)", addMins: 0, bucket: "today" }
    ];

    quickSlots.forEach(function (sl) {
      var b = el("button", "btn-secondary-full", sl.label);
      b.type = "button";
      b.addEventListener("click", function () {
        hapticNotify("success");
        var prevStats = getTaskTimingStats(task);
        var prevEmp = getEmployeeById(task.assignee_id) || currentEmp;
        stopTaskWorkTimerIfRunning(task);
        task.timer_paused = false;
        task.work_started_at = "";
        task.status_code = "delayed";
        task.status_name = "Отложена";
        task.deadline = sl.deadline;
        task.deadline_at = sl.deadline;
        task.due_bucket = sl.bucket;
        if (sl.addMins > 0) {
          task.spent_minutes = (parseInt(task.spent_minutes, 10) || 0) + sl.addMins;
          task.spent_by_employee = task.spent_by_employee || {};
          task.spent_by_employee[String(prevEmp.id)] =
            (parseInt(task.spent_by_employee[String(prevEmp.id)], 10) || 0) + sl.addMins;
        }
        task.status_history = Array.isArray(task.status_history) ? task.status_history : [];
        task.status_history.push({
          time: new Date().toTimeString().slice(0, 8),
          label:
            "⏳ Отложена (" +
            sl.deadline +
            ") · таймер стоп (" +
            prevEmp.short +
            ": " +
            formatDurationSec(prevStats.ownWorkSec, true) +
            ")"
        });
        saveState();
        closeActionModal();
        renderTasksView();
        updateBellBadge();
        showToast("Заявка #" + task.id + " отложена (" + sl.deadline + ")");
      });
      modalBodyEl.appendChild(b);
    });
  }

  // 3. Модальное окно «Передать / Делегировать» (фиксирует время предыдущего исполнителя, останавливает таймер и переводит в «Делегирована»)
  function openDelegateModal(task) {
    openActionModal("Передать заявку #" + task.id);
    var keepControl = true;

    var ctrlBtn = el("button", "btn-secondary-full", "✓ Оставить у себя на контроле (CONTROL)");
    ctrlBtn.type = "button";
    ctrlBtn.addEventListener("click", function () {
      keepControl = !keepControl;
      ctrlBtn.textContent = (keepControl ? "✓ " : "☐ ") + "Оставить у себя на контроле (CONTROL)";
    });
    modalBodyEl.appendChild(ctrlBtn);

    var grid = el("div", "assignee-grid");
    DATA.employees.forEach(function (emp) {
      var b = el(
        "button",
        "assignee-btn" + (String(emp.id) === String(task.assignee_id) ? " active" : ""),
        emp.short + " · ID " + emp.id
      );
      b.type = "button";
      b.addEventListener("click", function () {
        hapticNotify("success");
        var prevEmp = getEmployeeById(task.assignee_id) || currentEmp;
        var prevStats = getTaskTimingStats(task);
        var prevSec = (prevStats.byEmp && prevStats.byEmp[String(prevEmp.id)]) || prevStats.ownWorkSec || 0;

        stopTaskWorkTimerIfRunning(task);
        task.timer_paused = false;
        task.work_started_at = "";

        if (String(prevEmp.id) !== String(emp.id)) {
          task.delegation_chain = Array.isArray(task.delegation_chain) ? task.delegation_chain : [];
          task.delegation_chain.push({
            from_id: String(prevEmp.id),
            from_short: prevEmp.short,
            from_sec: prevSec,
            to_id: String(emp.id),
            to_short: emp.short,
            time: new Date().toTimeString().slice(0, 8)
          });
        }

        task.assignee_id = String(emp.id);
        task.assignee_name = emp.short;
        task.work_owner_id = String(emp.id);
        task.status_code = "resend";
        task.status_name = "Делегирована";
        task.updated_iso = new Date().toISOString();
        if (keepControl) {
          task.control_by = task.control_by || [];
          if (task.control_by.indexOf(String(currentEmp.id)) === -1 && String(emp.id) !== String(currentEmp.id)) {
            task.control_by.push(String(currentEmp.id));
          }
        }
        var chainSummary =
          prevEmp.short + ": " + formatDurationSec(prevSec, true) + " → передал → " + emp.short;
        task.status_history = Array.isArray(task.status_history) ? task.status_history : [];
        task.status_history.push({
          time: new Date().toTimeString().slice(0, 8),
          label: "📤 " + chainSummary + " (Делегирована, таймер стоп)"
        });
        task.comments = task.comments || [];
        task.comments.push({
          author: currentEmp.short,
          time: new Date().toTimeString().slice(0, 5),
          text: "Делегирована: " + chainSummary + " (таймер остановлен)"
        });
        saveState();
        closeActionModal();
        renderTasksView();
        updateBellBadge();
        showToast("📤 " + chainSummary);
      });
      grid.appendChild(b);
    });
    modalBodyEl.appendChild(grid);
  }

  // 3b. Модальное окно «Отклонить заявку» (Ответственный уже выбран + причины как на портале + ЧС спамера в почте)
  function extractEmailFromTask(task) {
    var combined = String(task.title || "") + " " + String(task.description || "");
    var m = combined.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (m && m[0]) return m[0].toLowerCase();
    return "";
  }

  function openRejectTaskModal(task) {
    openActionModal("🚫 Отклонить заявку #" + task.id);

    // 1. Ответственный — тот, кто в системе (уже выбран)
    var respLabel = el("div", "form-label", "Ответственный за отклонение (выбран в системе):");
    modalBodyEl.appendChild(respLabel);

    var respBadge = el(
      "div",
      "glass-card",
      "👤 " + currentEmp.name + " (" + currentEmp.short + " · ID " + currentEmp.id + ") — выбран автоматически"
    );
    respBadge.style.fontWeight = "700";
    respBadge.style.color = "var(--accent)";
    modalBodyEl.appendChild(respBadge);

    // 2. Причины отклонения на кнопках (как на портале и в боте)
    var reasonLabel = el("div", "form-label", "Причина отклонения (как на портале):");
    modalBodyEl.appendChild(reasonLabel);

    var portalReasons = [
      { code: "spam", text: "🚫 Спам / рассылка / не заявка" },
      { code: "dup", text: "🔁 Дубликат заявки" },
      { code: "other", text: "🏢 Не в эту службу" },
      { code: "scope", text: "📋 Вне зоны поддержки" },
      { code: "info", text: "💬 Только консультация" },
      { code: "err", text: "❌ Ошибочное обращение / автоответ" }
    ];
    var selectedReason = portalReasons[0].text;
    var reasonInput = el("textarea", "form-textarea");
    reasonInput.rows = 2;
    reasonInput.value = selectedReason;
    reasonInput.placeholder = "Укажите или выберите причину отклонения…";

    var reasonsGrid = el("div", "assignee-grid");
    function renderReasonButtons() {
      reasonsGrid.textContent = "";
      portalReasons.forEach(function (pr) {
        var b = el(
          "button",
          "assignee-btn" + (selectedReason === pr.text ? " active" : ""),
          pr.text
        );
        b.type = "button";
        b.addEventListener("click", function () {
          hapticImpact("light");
          selectedReason = pr.text;
          reasonInput.value = pr.text;
          renderReasonButtons();
        });
        reasonsGrid.appendChild(b);
      });
    }
    renderReasonButtons();
    modalBodyEl.appendChild(reasonsGrid);
    modalBodyEl.appendChild(reasonInput);

    // 3. Почтовый антиспам-блок (для заявок с почты — заблокировать спамера / домен в ЧС в почте)
    var detectedEmail = extractEmailFromTask(task);
    var isEmailTask =
      Boolean(detectedEmail) ||
      !task.company_id ||
      task.company_name === "Без компании" ||
      /mail|почт|уведомлен|unsubscribe|visibility|expired|idea/i.test(task.title + " " + task.description);

    var mailSectionTitle = el(
      "div",
      "form-label",
      isEmailTask
        ? "📧 Заявка с почты — блокировка спамера в ЧС почтового сервера:"
        : "📧 Почтовый фильтр / ЧС отправителя (если заявка с почты):"
    );
    modalBodyEl.appendChild(mailSectionTitle);

    var emailInput = el("input", "form-input");
    emailInput.type = "text";
    emailInput.value = detectedEmail || "spam-sender@external-mail.com";
    emailInput.placeholder = "Email или домен спамера для ЧС в почте…";
    modalBodyEl.appendChild(emailInput);

    function executeReject(blacklistMode) {
      hapticNotify("success");
      stopTaskWorkTimerIfRunning(task);
      task.timer_paused = false;
      task.work_started_at = "";
      task.assignee_id = String(currentEmp.id);
      task.assignee_name = currentEmp.short;
      task.status_code = "asya1c";
      task.status_name = "Отклонена";
      task.spent_minutes = (parseInt(task.spent_minutes, 10) || 0) + 1;
      var targetMail = safeText(emailInput.value, 120);
      var domainPart = targetMail.indexOf("@") !== -1 ? "@" + targetMail.split("@")[1] : targetMail;
      var reasonTxt = safeText(reasonInput.value, 300) || selectedReason;
      var blNote = "";
      if (blacklistMode === "sender") {
        blNote = " · 🔥 Отправитель «" + targetMail + "» добавлен в ЧС почты";
        state.mailBlacklist = state.mailBlacklist || [];
        state.mailBlacklist.push({ target: targetMail, by: currentEmp.short, at: new Date().toISOString() });
      } else if (blacklistMode === "domain") {
        blNote = " · 🛑 Домен «" + domainPart + "» добавлен в ЧС почты";
        state.mailBlacklist = state.mailBlacklist || [];
        state.mailBlacklist.push({ target: domainPart, by: currentEmp.short, at: new Date().toISOString() });
      }
      task.comments = task.comments || [];
      task.comments.push({
        author: currentEmp.short,
        time: new Date().toTimeString().slice(0, 5),
        text: "Отклонена (" + reasonTxt + ")" + blNote
      });
      saveState();
      closeActionModal();
      renderTasksView();
      updateBellBadge();
      showToast(
        blacklistMode
          ? "🔥 Заявка #" + task.id + " отклонена + спамер в ЧС почты!"
          : "🚫 Заявка #" + task.id + " отклонена (" + currentEmp.short + ")"
      );
    }

    var btnBlacklistSender = el(
      "button",
      "btn-danger-full",
      "🔥 Отклонить + Ебнуть спамера в ЧС в почте"
    );
    btnBlacklistSender.type = "button";
    btnBlacklistSender.addEventListener("click", function () {
      executeReject("sender");
    });
    modalBodyEl.appendChild(btnBlacklistSender);

    var btnBlacklistDomain = el(
      "button",
      "btn-secondary-full",
      "🛑 Отклонить + Весь домен отправителя в ЧС почты"
    );
    btnBlacklistDomain.type = "button";
    btnBlacklistDomain.style.marginTop = "8px";
    btnBlacklistDomain.addEventListener("click", function () {
      executeReject("domain");
    });
    modalBodyEl.appendChild(btnBlacklistDomain);

    var btnRejectSimple = el(
      "button",
      "btn-primary-full",
      "✓ Просто отклонить заявку (ответственный: " + currentEmp.short + ")"
    );
    btnRejectSimple.type = "button";
    btnRejectSimple.style.marginTop = "8px";
    btnRejectSimple.addEventListener("click", function () {
      executeReject("");
    });
    modalBodyEl.appendChild(btnRejectSimple);
  }

  // 3c. Колокольчик 🔔 в правом верхнем углу — почасовые напоминания о запущенном таймере и переход к задаче
  function getActiveRunningTasksForBell() {
    var running = [];
    for (var i = 0; i < state.tasks.length; i++) {
      var t = state.tasks[i];
      if (t.status_code === "completed" || t.status_code === "closed" || t.status_code === "asya1c") continue;
      var st = getTaskTimingStats(t);
      if (st.isTicking || st.isPaused) {
        running.push({ task: t, stats: st, hours: Math.floor(st.workSec / 3600) });
      }
    }
    return running;
  }

  function updateBellBadge() {
    var badge = document.getElementById("bell-badge");
    if (!badge) return;
    var list = getActiveRunningTasksForBell();
    var count = list.length;
    badge.textContent = String(count);
    badge.classList.toggle("hidden", count === 0);
  }

  function openBellNotificationsModal() {
    hapticImpact("light");
    openActionModal("🔔 Таймеры и напоминания (каждый час)");
    var list = getActiveRunningTasksForBell();

    modalBodyEl.appendChild(
      el(
        "p",
        "section-desc",
        "Система каждый час проверяет запущенные таймеры: если вы забыли остановить время или закрыть заявку, здесь появляется напоминание с быстрым переходом к задаче."
      )
    );

    if (list.length === 0) {
      modalBodyEl.appendChild(
        el("div", "glass-card", "✅ Сейчас нет запущенных таймеров. Все задачи под контролем!")
      );
      return;
    }

    list.forEach(function (item) {
      var t = item.task;
      var st = item.stats;
      var card = el("div", "glass-card");
      card.style.marginBottom = "10px";

      var titleRow = el(
        "div",
        "task-title",
        (st.isTicking ? "⏰ В работе: " : "⏸ На паузе: ") + "#" + t.id + " — " + t.title
      );
      card.appendChild(titleRow);

      var subInfo = el(
        "div",
        "section-desc",
        "Исполнитель: " +
          (t.assignee_name || currentEmp.short) +
          " · Таймер: " +
          formatDurationSec(st.workSec, true) +
          (item.hours >= 1 ? " (⚠️ идёт уже более " + item.hours + " ч!)" : " (напоминание каждый час)")
      );
      card.appendChild(subInfo);

      var btnRow = el("div", "assignee-grid");

      var btnJump = el("button", "btn-primary-full", "📍 Перейти к задаче #" + t.id);
      btnJump.type = "button";
      btnJump.addEventListener("click", function () {
        closeActionModal();
        switchView("tasks");
        activeScope = "all";
        activeStatusFilter = "all";
        searchInput.value = String(t.id);
        searchQuery = String(t.id);
        searchClear.classList.remove("hidden");
        renderTasksView();
      });
      btnRow.appendChild(btnJump);

      var btnPause = el(
        "button",
        "btn-secondary-full",
        st.isTicking ? "⏸ Пауза таймера" : "▶ Продолжить"
      );
      btnPause.type = "button";
      btnPause.addEventListener("click", function () {
        toggleTaskPauseResume(t);
        openBellNotificationsModal();
      });
      btnRow.appendChild(btnPause);

      card.appendChild(btnRow);
      modalBodyEl.appendChild(card);
    });
  }

  // 4. Подтверждение «Забрать чужую задачу»
  function openTakeConfirmModal(task) {
    openActionModal("Забрать заявку #" + task.id + "?");
    var assignee = getEmployeeById(task.assignee_id);
    modalBodyEl.appendChild(
      el(
        "p",
        "section-desc",
        "Текущий исполнитель: " + (assignee ? assignee.name : "ID " + task.assignee_id) + ". Перевести заявку на себя (" + currentEmp.name + ") и запустить таймер работы?"
      )
    );
    var btnYes = el("button", "btn-primary-full", "Да, забрать задачу в работу");
    btnYes.type = "button";
    btnYes.addEventListener("click", function () {
      takeTaskToSelf(task);
    });
    modalBodyEl.appendChild(btnYes);

    var btnNo = el("button", "btn-secondary-full", "Отмена");
    btnNo.type = "button";
    btnNo.addEventListener("click", closeActionModal);
    modalBodyEl.appendChild(btnNo);
  }

  // 5. Модальное окно «Комментарий / Написать заявителю» (публичный ответ клиенту или внутренний комментарий + скрепочка 📎)
  function openCommentModal(task, defaultPublic) {
    var isPublic = Boolean(defaultPublic);
    openActionModal((isPublic ? "💬 Ответ заявителю · #" : "Комментарий к #") + task.id);

    var modeRow = el("div", "segmented-row");
    function renderModeSwitch() {
      modeRow.textContent = "";
      var btnClient = el(
        "button",
        "seg-btn" + (isPublic ? " active" : ""),
        "🌐 Заявителю (" + safeText(task.company_name || "Клиент", 22) + ")"
      );
      btnClient.type = "button";
      btnClient.addEventListener("click", function () {
        isPublic = true;
        renderModeSwitch();
        updateModalLabels();
      });

      var btnInternal = el(
        "button",
        "seg-btn" + (!isPublic ? " active" : ""),
        "🔒 Внутренний (только ИТ)"
      );
      btnInternal.type = "button";
      btnInternal.addEventListener("click", function () {
        isPublic = false;
        renderModeSwitch();
        updateModalLabels();
      });

      modeRow.appendChild(btnClient);
      modeRow.appendChild(btnInternal);
    }
    renderModeSwitch();
    modalBodyEl.appendChild(modeRow);

    if (Array.isArray(task.comments) && task.comments.length > 0) {
      var list = el("div", "task-comments-box");
      task.comments.forEach(function (c) {
        var line = el("div", "comment-line");
        var badge = c.is_public ? "🌐 [Клиенту] " : "🔒 ";
        line.appendChild(el("span", "comment-author", badge + c.author + " (" + c.time + "): "));
        line.appendChild(el("span", "", c.text));
        if (Array.isArray(c.attachments) && c.attachments.length > 0) {
          line.appendChild(el("span", "meta-lbl", " [📎 " + c.attachments.join(", ") + "]"));
        }
        list.appendChild(line);
      });
      modalBodyEl.appendChild(list);
    }

    var quickChipsBox = el("div", "attach-chips");
    modalBodyEl.appendChild(quickChipsBox);

    var input = el("textarea", "form-textarea");
    input.rows = 5;
    modalBodyEl.appendChild(input);

    function updateModeQuickReplies() {
      quickChipsBox.textContent = "";
      if (!isPublic) return;
      var templates = [
        "Добрый день! Заявка принята в работу, скоро подключимся.",
        "Пришлите, пожалуйста, ID и пароль AnyDesk / RustDesk для подключения.",
        "Работы выполнены. Проверьте, пожалуйста, всё ли работает корректно?"
      ];
      templates.forEach(function (tpl) {
        var chip = el("button", "btn-comment-attach", "⚡ " + tpl.slice(0, 38) + "…");
        chip.type = "button";
        chip.addEventListener("click", function () {
          hapticImpact("light");
          input.value = tpl;
          input.focus();
        });
        quickChipsBox.appendChild(chip);
      });
    }

    var attachedFiles = [];
    var fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.accept = "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,*/*";
    fileInput.className = "hidden";
    modalBodyEl.appendChild(fileInput);

    var attachRow = el("div", "comment-attach-row");
    var btnAttach = el("button", "btn-comment-attach", "📎 Прикрепить фото, видео, документ");
    btnAttach.type = "button";
    var attachCountSpan = el("span", "meta-lbl", "Файлов: 0");
    attachRow.appendChild(btnAttach);
    attachRow.appendChild(attachCountSpan);
    modalBodyEl.appendChild(attachRow);

    var attachChipsBox = el("div", "attach-chips");
    modalBodyEl.appendChild(attachChipsBox);

    btnAttach.addEventListener("click", function () {
      hapticImpact("light");
      fileInput.click();
    });

    fileInput.addEventListener("change", function () {
      var files = Array.prototype.slice.call(fileInput.files || [], 0, 10);
      files.forEach(function (f) {
        var sizeKb = Math.max(1, Math.round((f.size || 0) / 1024));
        attachedFiles.push(f.name + " (" + sizeKb + " КБ)");
      });
      attachCountSpan.textContent = "Файлов: " + attachedFiles.length;
      attachChipsBox.textContent = "";
      attachedFiles.forEach(function (label) {
        attachChipsBox.appendChild(el("span", "attach-chip", "📎 " + safeText(label, 40)));
      });
    });

    var btnSend = el("button", "btn-primary-full", "");
    btnSend.type = "button";

    function updateModalLabels() {
      modalTitleEl.textContent = (isPublic ? "💬 Ответ заявителю · #" : "Комментарий к #") + task.id;
      input.placeholder = isPublic
        ? "Напишите сообщение заявителю (" + (task.company_name || "клиенту") + ") — уйдёт в Okdesk / Telegram / Email…"
        : "Введите внутренний комментарий для сотрудников ИТ…";
      btnSend.textContent = isPublic ? "📨 Отправить сообщение заявителю" : "Отправить внутренний комментарий";
      updateModeQuickReplies();
    }
    updateModalLabels();

    btnSend.addEventListener("click", function () {
      var txt = safeText(input.value, 1000);
      if (!txt && attachedFiles.length === 0) {
        showToast("Введите текст сообщения или прикрепите файл");
        return;
      }
      hapticNotify("success");
      task.comments = task.comments || [];
      task.comments.push({
        author: currentEmp.short,
        time: new Date().toTimeString().slice(0, 5),
        text: txt || "Приложены файлы к заявке",
        is_public: isPublic,
        attachments: attachedFiles.slice()
      });
      saveState();
      closeActionModal();
      renderTasksView();
      showToast(
        isPublic
          ? "📨 Сообщение отправлено заявителю по заявке #" + task.id
          : "Комментарий добавлен в #" + task.id
      );
    });
    modalBodyEl.appendChild(btnSend);
  }

  // 6. Модальное окно выбора текущего сотрудника
  function openSwitchEmployeeModal() {
    openActionModal("Профиль сотрудника (Портал ITSUPP)");
    modalBodyEl.appendChild(
      el(
        "p",
        "section-desc",
        "Переключите сотрудника, чтобы проверить фильтрацию «Мои задачи» (только основной assignee_id без coexecutors)."
      )
    );
    var grid = el("div", "assignee-grid");
    DATA.employees.forEach(function (emp) {
      var b = el(
        "button",
        "assignee-btn" + (String(emp.id) === String(currentEmp.id) ? " active" : ""),
        emp.short + " · ID " + emp.id
      );
      b.type = "button";
      b.addEventListener("click", function () {
        hapticImpact("light");
        currentEmp = emp;
        userSwitchedManually = true;
        createDraft.assigneeId = emp.id;
        setupLoginProfileUI();
        closeActionModal();
        renderAllAppViews();
      });
      grid.appendChild(b);
    });
    modalBodyEl.appendChild(grid);
  }

  // 7. Модальное окно выбора Дежурного
  function openDutyPickerModal() {
    openActionModal("Назначить дежурного сотрудника");
    var grid = el("div", "assignee-grid");
    DATA.employees.forEach(function (emp) {
      var b = el(
        "button",
        "assignee-btn" + (String(emp.id) === String(state.dutyEmpId) ? " active" : ""),
        emp.short
      );
      b.type = "button";
      b.addEventListener("click", function () {
        hapticNotify("success");
        state.dutyEmpId = String(emp.id);
        saveState();
        closeActionModal();
        renderHeader();
        showToast("Дежурный: " + emp.name);
      });
      grid.appendChild(b);
    });
    modalBodyEl.appendChild(grid);
  }

  // =========================================================
  // ВКЛАДКА 2: МАСТЕР СОЗДАНИЯ ЗАДАЧИ (src/create_task.py)
  // =========================================================
  function renderCreateView() {
    document.getElementById("create-client-name").textContent =
      createDraft.companyName + " (ID " + createDraft.companyId + ")";

    var typeBtns = document.querySelectorAll("[data-create-type]");
    for (var i = 0; i < typeBtns.length; i++) {
      typeBtns[i].classList.toggle("active", typeBtns[i].getAttribute("data-create-type") === createDraft.typeCode);
    }

    var spentBtns = document.querySelectorAll("[data-create-spent]");
    for (var j = 0; j < spentBtns.length; j++) {
      spentBtns[j].classList.toggle(
        "active",
        parseInt(spentBtns[j].getAttribute("data-create-spent"), 10) === createDraft.spentMinutes
      );
    }

    var grid = document.getElementById("create-assignee-grid");
    grid.textContent = "";

    var btnMe = el(
      "button",
      "assignee-btn" + (String(createDraft.assigneeId) === String(currentEmp.id) ? " active" : ""),
      "Я (" + currentEmp.short + ")"
    );
    btnMe.type = "button";
    btnMe.addEventListener("click", function () {
      hapticImpact("light");
      createDraft.assigneeId = String(currentEmp.id);
      renderCreateView();
    });
    grid.appendChild(btnMe);

    DATA.employees.forEach(function (emp) {
      if (String(emp.id) === String(currentEmp.id)) return;
      var b = el(
        "button",
        "assignee-btn" + (String(createDraft.assigneeId) === String(emp.id) ? " active" : ""),
        emp.short + " (ID " + emp.id + ")"
      );
      b.type = "button";
      b.addEventListener("click", function () {
        hapticImpact("light");
        createDraft.assigneeId = String(emp.id);
        renderCreateView();
      });
      grid.appendChild(b);
    });
  }

  function renderClientSearchResults(query) {
    var box = document.getElementById("create-client-results");
    box.textContent = "";
    var q = safeText(query, 80).toLowerCase();
    var matches = DATA.companies
      .filter(function (c) {
        return !q || c.name.toLowerCase().indexOf(q) !== -1 || String(c.id) === q;
      })
      .slice(0, 25);

    matches.forEach(function (comp) {
      var b = el("button", "client-item-btn");
      b.type = "button";
      b.appendChild(el("span", "", comp.name));
      b.appendChild(el("span", "meta-lbl", "ID " + comp.id));
      b.addEventListener("click", function () {
        hapticImpact("light");
        createDraft.companyId = comp.id;
        createDraft.companyName = comp.name;
        document.getElementById("create-client-picker").classList.add("hidden");
        renderCreateView();
      });
      box.appendChild(b);
    });
  }

  function submitCreateTask() {
    var descEl = document.getElementById("create-desc-input");
    var entityEl = document.getElementById("create-entity-input");
    var desc = safeText(descEl.value, 1000);
    if (!desc) {
      hapticNotify("error");
      showToast("Введите текстом описание проблемы");
      descEl.focus();
      return;
    }

    var targetEmp = getEmployeeById(createDraft.assigneeId);
    if (!targetEmp && String(createDraft.assigneeId) !== String(currentEmp.id)) {
      hapticNotify("error");
      showToast("Выбранный исполнитель недоступен в каталоге");
      return;
    }

    var firstLine = desc.split("\n")[0].slice(0, 120);
    var newId = String(state.nextIssueId || 44122);
    state.nextIssueId = (parseInt(newId, 10) || 44122) + 1;

    var defaultCoexecs = ["8", "9", "11", "12"].filter(function (id) {
      return id !== String(createDraft.assigneeId);
    });
    var ctrlList = String(createDraft.assigneeId) !== String(currentEmp.id) ? [String(currentEmp.id)] : [];

    var newTask = {
      id: newId,
      title: firstLine,
      description: desc,
      company_id: createDraft.companyId,
      company_name: createDraft.companyName,
      entity_name: safeText(entityEl.value, 120) || "Без объекта",
      type_code: createDraft.typeCode,
      type_name: createDraft.typeName,
      status_code: "opened",
      status_name: "Открыта",
      priority: "Обычный",
      assignee_id: String(createDraft.assigneeId),
      creator_id: String(currentEmp.id),
      control_by: ctrlList,
      coexecutors: defaultCoexecs,
      observers: ["6"],
      spent_minutes: createDraft.spentMinutes,
      billing_flag: "none",
      deadline: "Сегодня 19:00",
      due_bucket: "today",
      created_at: new Date().toISOString().slice(0, 16).replace("T", " "),
      comments: [
        {
          author: currentEmp.short,
          time: new Date().toTimeString().slice(0, 5),
          text: "Создана через Mini App (исполнитель ID " + createDraft.assigneeId + ", group=null)."
        }
      ]
    };

    state.tasks.unshift(newTask);
    saveState();

    descEl.value = "";
    entityEl.value = "";
    createDraft.files = [];
    document.getElementById("create-files-count").textContent = "Файлов: 0 / 5";
    document.getElementById("create-files-list").textContent = "";

    hapticNotify("success");
    activeScope = String(createDraft.assigneeId) === String(currentEmp.id) ? "mine" : "control";
    switchView("tasks");
    showToast("Заявка #" + newId + " создана на " + (targetEmp ? targetEmp.short : currentEmp.short));
  }

  // =========================================================
  // ВКЛАДКА 3: AI 500 (ГОЛОСОВОЕ СОЗДАНИЕ И РАЗБОР)
  // =========================================================
  function parseAi500Text(rawText) {
    var txt = safeText(rawText, 1000);
    if (!txt) return null;
    var lower = txt.toLowerCase();

    var matchedCompany = { id: 30, name: "Сервис-Про ООО" };
    var bestScore = 0;
    DATA.companies.forEach(function (c) {
      var clean = c.name.toLowerCase().replace(/ооо|ип|[\x22«»()]/g, " ").trim();
      var words = clean.split(/\s+/).filter(function (w) { return w.length >= 3; });
      var hits = 0;
      words.forEach(function (w) {
        if (lower.indexOf(w) !== -1) hits += w.length;
      });
      if (hits > bestScore) {
        bestScore = hits;
        matchedCompany = c;
      }
    });

    var matchedAssignee = currentEmp;
    DATA.employees.forEach(function (emp) {
      var surname = emp.name.split(" ")[0].toLowerCase();
      var stem = surname.slice(0, Math.max(4, surname.length - 1));
      if (lower.indexOf(stem) !== -1) {
        matchedAssignee = emp;
      }
    });

    var spent = 10;
    var mMin = lower.match(/(\d+)\s*(мин|м\b)/);
    if (mMin) spent = Math.min(240, Math.max(5, parseInt(mMin[1], 10)));
    else if (lower.indexOf("полчаса") !== -1) spent = 30;
    else if (lower.indexOf("час") !== -1) spent = 60;

    var isAcc = lower.indexOf("бухгалтер") !== -1 || lower.indexOf("акт") !== -1 || lower.indexOf("счет") !== -1 || lower.indexOf("эдо") !== -1;

    return {
      companyId: matchedCompany.id,
      companyName: matchedCompany.name,
      typeCode: isAcc ? "000004" : "service",
      typeName: isAcc ? "Бухгалтерия" : "Техническая поддержка",
      assigneeId: matchedAssignee.id,
      assigneeName: matchedAssignee.name,
      spentMinutes: spent,
      title: txt.slice(0, 90),
      description: txt
    };
  }

  // =========================================================
  // ВКЛАДКА 4: РЕЗУЛЬТАТЫ И СТАТУС СИСТЕМЫ
  // =========================================================
  function renderResultsView() {
    var empId = currentEmp.id;
    var myOwn = state.tasks.filter(function (t) { return isOwnTaskForUser(t, empId); });
    var myActive = myOwn.filter(function (t) { return !isTerminalStatus(t.status_code); });
    var mySolved = myOwn.filter(function (t) { return t.status_code === "completed"; });
    var myControl = state.tasks.filter(function (t) { return isControlTaskForUser(t, empId) && !isTerminalStatus(t.status_code); });
    var totalMins = myOwn.reduce(function (acc, t) { return acc + (parseInt(t.spent_minutes, 10) || 0); }, 0);

    document.getElementById("kpi-my-active").textContent = String(myActive.length);
    document.getElementById("kpi-my-solved").textContent = String(mySolved.length);
    document.getElementById("kpi-my-minutes").textContent = formatMinutes(totalMins);
    document.getElementById("kpi-my-control").textContent = String(myControl.length);

    var breakdownEl = document.getElementById("my-results-breakdown");
    breakdownEl.textContent = "";
    myOwn.forEach(function (t) {
      var ts = getTaskTimingStats(t);
      var timerMins = Math.max(0, Math.round(ts.ownWorkSec / 60));
      var r = el("div", "stat-row");
      r.appendChild(el("span", "", "#" + t.id + " · " + t.company_name + " (" + t.status_name + ")"));
      r.appendChild(
        el(
          "strong",
          "",
          "⏱ Таймер: " +
            formatDurationSec(ts.ownWorkSec, true) +
            (ts.totalWorkSec > ts.ownWorkSec ? " (всего " + formatMinutes(Math.round(ts.totalWorkSec / 60)) + ")" : "") +
            " · Списано: " +
            formatMinutes(t.spent_minutes || 0)
        )
      );
      breakdownEl.appendChild(r);
    });

    var allListEl = document.getElementById("all-results-list");
    allListEl.textContent = "";
    DATA.employees.forEach(function (emp) {
      var empTasks = state.tasks.filter(function (t) { return isOwnTaskForUser(t, emp.id); });
      var mins = empTasks.reduce(function (a, t) { return a + (parseInt(t.spent_minutes, 10) || 0); }, 0);
      var empTimerSec = state.tasks.reduce(function (accSec, t) {
        var ts = getTaskTimingStats(t);
        return accSec + ((ts.byEmp && ts.byEmp[String(emp.id)]) || 0);
      }, 0);
      var row = el("div", "stat-row");
      row.appendChild(el("span", "", emp.short + " (" + emp.dept + ")"));
      row.appendChild(
        el(
          "strong",
          "",
          empTasks.length +
            " заяв. · ⏱ " +
            formatDurationSec(empTimerSec, false) +
            " · Списано: " +
            formatMinutes(mins)
        )
      );
      allListEl.appendChild(row);
    });

    var sysEl = document.getElementById("sys-status-list");
    sysEl.textContent = "";
    var sysRows = [
      ["Версия хелпера", DATA.version || "task-bot-2026.08.12.105"],
      ["Код выкладки (SHA)", (DATA.commit || "1df0ed9c").slice(0, 12) + "…"],
      ["Статус n8n-task-helper", "🟢 running healthy"],
      ["Маршрут назначения", "🟢 assignee_id (без coexecutors в own)"],
      ["Активных компаний в кэше", String(DATA.companies.length)],
      ["Сотрудников в каталоге", String(DATA.employees.length)],
      ["Оповещение fresh_tasks", state.freshEnabled ? "🟢 ВКЛ" : "⚪ ВЫКЛ"]
    ];
    sysRows.forEach(function (pair) {
      var r = el("div", "stat-row");
      r.appendChild(el("span", "", pair[0]));
      r.appendChild(el("strong", "", pair[1]));
      sysEl.appendChild(r);
    });
  }

  // =========================================================
  // ВКЛАДКА 5: МЕНЮ «ЕЩЁ» И НАСТРОЙКИ БИОМЕТРИИ
  // =========================================================
  function renderMoreView() {
    updateBiometricLabels();
    var btnBioEn = document.getElementById("btn-toggle-bio-enabled");
    var btnBioAuto = document.getElementById("btn-toggle-bio-auto");
    btnBioEn.classList.toggle("on", Boolean(bioPrefs.enabled));
    btnBioEn.textContent = bioPrefs.enabled ? "ВКЛ" : "ВЫКЛ";
    btnBioAuto.classList.toggle("on", Boolean(bioPrefs.autoPrompt));
    btnBioAuto.textContent = bioPrefs.autoPrompt ? "ВКЛ" : "ВЫКЛ";
  }

  function openWipeConfirmModal(isSelfDestruct) {
    openActionModal(isSelfDestruct ? "Самоуничтожение" : "Очистить кэш задач");
    modalBodyEl.appendChild(
      el(
        "p",
        "section-desc",
        isSelfDestruct
          ? "Подтвердите полное удаление сессии, ПИН-кода и возврат к исходному состоянию."
          : "Сбросить локальные изменения задач к эталонному состоянию продакшена?"
      )
    );
    var btnYes = el("button", "btn-primary-full", "Да, удалить");
    btnYes.type = "button";
    btnYes.addEventListener("click", function () {
      hapticNotify("warning");
      localStorage.removeItem(STORAGE_KEY_STATE);
      if (isSelfDestruct) {
        localStorage.removeItem(STORAGE_KEY_PIN);
      }
      state = loadSavedState();
      closeActionModal();
      if (isSelfDestruct) {
        lockToLoginScreen();
        showToast("Сессия и код доступа очищены");
      } else {
        renderAllAppViews();
        showToast("Состояние задач восстановлено");
      }
    });
    modalBodyEl.appendChild(btnYes);

    var btnNo = el("button", "btn-secondary-full", "Нет");
    btnNo.type = "button";
    btnNo.addEventListener("click", closeActionModal);
    modalBodyEl.appendChild(btnNo);
  }

  function lockToLoginScreen() {
    pinBuffer = "";
    renderPinDots(false);
    updatePinPrompts();
    document.getElementById("screen-app").classList.remove("active");
    document.getElementById("screen-login").classList.add("active");
  }

  function renderAllAppViews() {
    renderHeader();
    renderTasksView();
    renderCreateView();
    renderResultsView();
    renderMoreView();
  }

  // =========================================================
  // ПРИВЯЗКА ВСЕХ СОБЫТИЙ КАБИНЕТА (чей Telegram — тот и пользователь)
  // =========================================================
  void document.getElementById("btn-switch-emp");
  document.getElementById("btn-strip-duty").addEventListener("click", openDutyPickerModal);

  function toggleFreshNotifications() {
    hapticImpact("light");
    state.freshEnabled = !state.freshEnabled;
    saveState();
    renderHeader();
    renderResultsView();
    showToast(
      state.freshEnabled
        ? "Оповещение о новых задачах: ВКЛ"
        : "Оповещение о новых задачах: ВЫКЛ"
    );
  }

  document.getElementById("btn-strip-fresh").addEventListener("click", toggleFreshNotifications);

  function openTopMoreModal() {
    hapticImpact("light");
    openActionModal("Быстрое меню");
    var stack = el("div", "bio-setting-actions");

    var btnPhoto = el("button", "btn-secondary-full", "📷 Загрузить фото или логотип (экран входа)");
    btnPhoto.type = "button";
    btnPhoto.addEventListener("click", function () {
      closeActionModal();
      triggerAvatarFilePicker();
    });
    stack.appendChild(btnPhoto);

    var btnSetCorpLogo = el("button", "btn-secondary-full", "🛡️ Установить корпоративное лого");
    btnSetCorpLogo.type = "button";
    btnSetCorpLogo.addEventListener("click", function () {
      setSavedAvatar(SERVIS_PRO_LOGO_URL);
      setupLoginProfileUI();
      renderHeader();
      closeActionModal();
      showToast("✓ Корпоративное лого установлено");
    });
    stack.appendChild(btnSetCorpLogo);

    var btnRef = el("button", "btn-secondary-full", "🔄 Обновить задачи (" + state.tasks.length + ")");
    btnRef.type = "button";
    btnRef.addEventListener("click", function () {
      closeActionModal();
      hapticImpact("medium");
      renderAllAppViews();
      showToast("Задачи обновлены (" + state.tasks.length + " в контуре)");
    });
    stack.appendChild(btnRef);

    var btnLock = el("button", "btn-secondary-full", "🔒 Экран входа (Face ID / ПИН)");
    btnLock.type = "button";
    btnLock.addEventListener("click", function () {
      closeActionModal();
      lockToLoginScreen();
    });
    stack.appendChild(btnLock);

    var btnCloseApp = el("button", "btn-secondary-full", "✕ Закрыть приложение (в чат бота)");
    btnCloseApp.type = "button";
    btnCloseApp.addEventListener("click", function () {
      closeActionModal();
      closeMiniApp();
    });
    stack.appendChild(btnCloseApp);

    modalBodyEl.appendChild(stack);
  }

  var btnLoginMore = document.getElementById("btn-login-more");
  if (btnLoginMore) btnLoginMore.addEventListener("click", openTopMoreModal);

  var btnTopBell = document.getElementById("btn-top-bell");
  if (btnTopBell) btnTopBell.addEventListener("click", openBellNotificationsModal);

  var btnTopMore = document.getElementById("btn-top-more");
  if (btnTopMore) btnTopMore.addEventListener("click", openTopMoreModal);

  var btnTopClose = document.getElementById("btn-top-close");
  if (btnTopClose) btnTopClose.addEventListener("click", closeMiniApp);

  updateBellBadge();

  document.getElementById("btn-top-refresh").addEventListener("click", function () {
    hapticImpact("medium");
    renderAllAppViews();
    showToast("Задачи обновлены (" + state.tasks.length + " в контуре)");
  });

  document.getElementById("btn-top-bot").addEventListener("click", closeMiniApp);

  document.getElementById("btn-top-lock").addEventListener("click", function () {
    hapticImpact("light");
    lockToLoginScreen();
  });

  // Сворачивание / разворачивание Reply-меню бота
  document.getElementById("btn-toggle-bot-kb").addEventListener("click", function (ev) {
    botMenuExpanded = !botMenuExpanded;
    document.getElementById("bot-menu-grid").classList.toggle("hidden", !botMenuExpanded);
    ev.currentTarget.textContent = botMenuExpanded ? "Свернуть ▴" : "Развернуть ▾";
  });

  // Кнопки главного меню бота
  var botMenuBtns = document.querySelectorAll("[data-menu-cmd]");
  for (var mIdx = 0; mIdx < botMenuBtns.length; mIdx++) {
    botMenuBtns[mIdx].addEventListener("click", function (ev) {
      hapticImpact("light");
      var cmd = ev.currentTarget.getAttribute("data-menu-cmd");
      if (cmd === "mytasks") {
        activeScope = "mine";
        switchView("tasks");
      } else if (cmd === "create_task") {
        switchView("create");
      } else if (cmd === "refresh_tasks") {
        renderAllAppViews();
        showToast("Задачи синхронизированы");
      } else if (cmd === "search") {
        switchView("tasks");
        document.getElementById("task-search-input").focus();
      } else if (cmd === "fresh_toggle") {
        toggleFreshNotifications();
      } else if (cmd === "ai500") {
        switchView("ai500");
      } else if (cmd === "more") {
        switchView("more");
      }
    });
  }

  // Нижняя навигация
  var navBtns = document.querySelectorAll(".nav-tab[data-nav]");
  for (var nIdx = 0; nIdx < navBtns.length; nIdx++) {
    navBtns[nIdx].addEventListener("click", function (ev) {
      hapticImpact("light");
      switchView(ev.currentTarget.getAttribute("data-nav"));
    });
  }

  // Табы разделов задач
  var scopeBtns = document.querySelectorAll(".scope-tab[data-scope]");
  for (var sIdx = 0; sIdx < scopeBtns.length; sIdx++) {
    scopeBtns[sIdx].addEventListener("click", function (ev) {
      hapticImpact("light");
      activeScope = ev.currentTarget.getAttribute("data-scope");
      renderTasksView();
    });
  }

  // Чипы статусов
  var stBtns = document.querySelectorAll(".status-chip[data-status]");
  for (var stIdx = 0; stIdx < stBtns.length; stIdx++) {
    stBtns[stIdx].addEventListener("click", function (ev) {
      hapticImpact("light");
      activeStatusFilter = ev.currentTarget.getAttribute("data-status");
      renderTasksView();
    });
  }

  // Поиск по задачам (Enter закрывает экранную клавиатуру)
  function dismissKeyboard(inputEl) {
    if (inputEl && typeof inputEl.blur === "function") {
      inputEl.blur();
    }
    if (tg && typeof tg.hideKeyboard === "function") {
      try {
        tg.hideKeyboard();
      } catch (_e) {}
    }
  }

  function bindDismissKeyboardOnEnter(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.keyCode === 13) {
        ev.preventDefault();
        dismissKeyboard(inputEl);
      }
    });
    inputEl.addEventListener("search", function () {
      dismissKeyboard(inputEl);
    });
  }

  var searchInput = document.getElementById("task-search-input");
  var searchClear = document.getElementById("btn-search-clear");
  bindDismissKeyboardOnEnter(searchInput);
  bindDismissKeyboardOnEnter(document.getElementById("create-client-search"));
  bindDismissKeyboardOnEnter(document.getElementById("create-entity-input"));

  searchInput.addEventListener("input", function () {
    searchQuery = safeText(searchInput.value, 80);
    searchClear.classList.toggle("hidden", !searchQuery);
    renderTasksView();
  });
  searchClear.addEventListener("click", function () {
    searchInput.value = "";
    searchQuery = "";
    searchClear.classList.add("hidden");
    searchInput.blur();
    renderTasksView();
  });

  // События мастера создания задачи
  var createTypeBtns = document.querySelectorAll("[data-create-type]");
  for (var ctIdx = 0; ctIdx < createTypeBtns.length; ctIdx++) {
    createTypeBtns[ctIdx].addEventListener("click", function (ev) {
      var code = ev.currentTarget.getAttribute("data-create-type");
      createDraft.typeCode = code;
      createDraft.typeName = code === "000004" ? "Бухгалтерия" : "Техническая поддержка";
      renderCreateView();
    });
  }

  document.getElementById("btn-create-change-client").addEventListener("click", function () {
    var picker = document.getElementById("create-client-picker");
    var isHidden = picker.classList.toggle("hidden");
    if (!isHidden) {
      renderClientSearchResults("");
      document.getElementById("create-client-search").focus();
    }
  });

  document.getElementById("create-client-search").addEventListener("input", function (ev) {
    renderClientSearchResults(ev.currentTarget.value);
  });

  document.getElementById("btn-skip-entity").addEventListener("click", function () {
    document.getElementById("create-entity-input").value = "Без объекта";
    showToast("Выбрано: Без объекта");
  });

  document.getElementById("create-file-input").addEventListener("change", function (ev) {
    var files = Array.prototype.slice.call(ev.currentTarget.files || [], 0, 5);
    createDraft.files = files.map(function (f) { return f.name; });
    document.getElementById("create-files-count").textContent = "Файлов: " + createDraft.files.length + " / 5";
    var chips = document.getElementById("create-files-list");
    chips.textContent = "";
    createDraft.files.forEach(function (name) {
      chips.appendChild(el("span", "attach-chip", "📎 " + safeText(name, 28)));
    });
  });

  var createSpentBtns = document.querySelectorAll("[data-create-spent]");
  for (var csIdx = 0; csIdx < createSpentBtns.length; csIdx++) {
    createSpentBtns[csIdx].addEventListener("click", function (ev) {
      createDraft.spentMinutes = parseInt(ev.currentTarget.getAttribute("data-create-spent"), 10) || 10;
      renderCreateView();
    });
  }

  document.getElementById("btn-submit-create").addEventListener("click", submitCreateTask);
  document.getElementById("btn-reset-create").addEventListener("click", function () {
    document.getElementById("create-desc-input").value = "";
    document.getElementById("create-entity-input").value = "";
    createDraft.companyId = 30;
    createDraft.companyName = "Сервис-Про ООО";
    createDraft.assigneeId = currentEmp.id;
    createDraft.spentMinutes = 10;
    renderCreateView();
    showToast("Черновик очищен");
  });

  // События AI 500
  var voiceRec = null;
  var isRecording = false;
  document.getElementById("btn-voice-record").addEventListener("click", function () {
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    var btn = document.getElementById("btn-voice-record");
    var lbl = document.getElementById("voice-mic-label");
    if (!SpeechRec) {
      document.getElementById("ai500-input").value =
        "Клиника Фомина Тверь не печатает чек касса АТОЛ на ресепшене назначить на Быкова списать 15 минут";
      showToast("Подставлен распознанный голосовой пример");
      return;
    }
    if (isRecording && voiceRec) {
      voiceRec.stop();
      return;
    }
    try {
      voiceRec = new SpeechRec();
      voiceRec.lang = "ru-RU";
      voiceRec.interimResults = false;
      isRecording = true;
      btn.classList.add("recording");
      lbl.textContent = "Идёт запись… Нажмите для стопа";
      voiceRec.onresult = function (event) {
        var transcript = event.results[0][0].transcript;
        document.getElementById("ai500-input").value = transcript;
      };
      voiceRec.onend = function () {
        isRecording = false;
        btn.classList.remove("recording");
        lbl.textContent = "Начать запись голоса";
      };
      voiceRec.start();
    } catch (_e) {
      isRecording = false;
      btn.classList.remove("recording");
      lbl.textContent = "Начать запись голоса";
    }
  });

  document.getElementById("btn-voice-demo").addEventListener("click", function () {
    document.getElementById("ai500-input").value =
      "Клиника Фомина Мичуринский проверить VPN-туннель MikroTik и доступ к 1С назначить на Старцева списать 20 минут";
    document.getElementById("btn-ai500-parse").click();
  });

  document.getElementById("btn-ai500-parse").addEventListener("click", function () {
    var raw = document.getElementById("ai500-input").value;
    var parsed = parseAi500Text(raw);
    if (!parsed) {
      showToast("Введите или надиктуйте текст для разбора AI 500");
      return;
    }
    hapticImpact("light");
    lastAiParsed = parsed;
    document.getElementById("ai-res-client").textContent = parsed.companyName + " (ID " + parsed.companyId + ")";
    document.getElementById("ai-res-type").textContent = parsed.typeName;
    document.getElementById("ai-res-assignee").textContent = parsed.assigneeName + " (ID " + parsed.assigneeId + ")";
    document.getElementById("ai-res-spent").textContent = formatMinutes(parsed.spentMinutes);
    document.getElementById("ai-res-title").textContent = parsed.title;
    document.getElementById("ai-res-desc").textContent = parsed.description;
    document.getElementById("ai500-preview").classList.remove("hidden");
  });

  document.getElementById("btn-ai500-create").addEventListener("click", function () {
    if (!lastAiParsed) return;
    createDraft.companyId = lastAiParsed.companyId;
    createDraft.companyName = lastAiParsed.companyName;
    createDraft.typeCode = lastAiParsed.typeCode;
    createDraft.typeName = lastAiParsed.typeName;
    createDraft.assigneeId = lastAiParsed.assigneeId;
    createDraft.spentMinutes = lastAiParsed.spentMinutes;
    document.getElementById("create-desc-input").value = lastAiParsed.description;
    submitCreateTask();
  });

  document.getElementById("btn-ai500-to-wizard").addEventListener("click", function () {
    if (!lastAiParsed) return;
    createDraft.companyId = lastAiParsed.companyId;
    createDraft.companyName = lastAiParsed.companyName;
    createDraft.typeCode = lastAiParsed.typeCode;
    createDraft.typeName = lastAiParsed.typeName;
    createDraft.assigneeId = lastAiParsed.assigneeId;
    createDraft.spentMinutes = lastAiParsed.spentMinutes;
    document.getElementById("create-desc-input").value = lastAiParsed.description;
    switchView("create");
  });

  // Переключатель табов во вкладке Итоги
  var resTabs = document.querySelectorAll("[data-res-tab]");
  for (var rtIdx = 0; rtIdx < resTabs.length; rtIdx++) {
    resTabs[rtIdx].addEventListener("click", function (ev) {
      var tab = ev.currentTarget.getAttribute("data-res-tab");
      for (var k = 0; k < resTabs.length; k++) {
        resTabs[k].classList.toggle("active", resTabs[k].getAttribute("data-res-tab") === tab);
      }
      document.getElementById("res-panel-mine").classList.toggle("active", tab === "mine");
      document.getElementById("res-panel-all").classList.toggle("active", tab === "all");
      document.getElementById("res-panel-status").classList.toggle("active", tab === "status");
    });
  }

  // Кнопки во вкладке «Ещё»
  var moreCmdBtns = document.querySelectorAll("[data-more-cmd]");
  for (var mcIdx = 0; mcIdx < moreCmdBtns.length; mcIdx++) {
    moreCmdBtns[mcIdx].addEventListener("click", function (ev) {
      var cmd = ev.currentTarget.getAttribute("data-more-cmd");
      if (cmd === "alltasks") {
        activeScope = "all";
        switchView("tasks");
      } else if (cmd === "results") {
        switchView("results");
      } else if (cmd === "status") {
        switchView("results");
        document.querySelector('[data-res-tab="status"]').click();
      } else if (cmd === "today") {
        activeScope = "today";
        switchView("tasks");
      } else if (cmd === "overdue") {
        activeScope = "overdue";
        switchView("tasks");
      } else if (cmd === "duty") {
        openDutyPickerModal();
      } else if (cmd === "wipe") {
        openWipeConfirmModal(false);
      } else if (cmd === "selfdestruct") {
        openWipeConfirmModal(true);
      }
    });
  }

  // Настройки биометрии во вкладке «Ещё»
  document.getElementById("btn-toggle-bio-enabled").addEventListener("click", function () {
    bioPrefs.enabled = !bioPrefs.enabled;
    saveBioPrefs();
    renderMoreView();
    showToast("Вход по " + bioTypeLabel + ": " + (bioPrefs.enabled ? "ВКЛ" : "ВЫКЛ"));
  });

  document.getElementById("btn-toggle-bio-auto").addEventListener("click", function () {
    bioPrefs.autoPrompt = !bioPrefs.autoPrompt;
    saveBioPrefs();
    renderMoreView();
    showToast("Автозапрос " + bioTypeLabel + ": " + (bioPrefs.autoPrompt ? "ВКЛ" : "ВЫКЛ"));
  });

  document.getElementById("btn-test-bio").addEventListener("click", function () {
    triggerBiometricLogin();
  });

  document.getElementById("btn-change-pin").addEventListener("click", function () {
    pinChangeMode = true;
    lockToLoginScreen();
    showToast("Введите новый 5-значный код доступа");
  });

  document.getElementById("btn-lock-now").addEventListener("click", function () {
    lockToLoginScreen();
  });
})();
