/**
 * app-config.js — Dùng chung cho tất cả trang
 * Chỉ cần thêm 1 dòng vào mỗi file HTML:
 *   <script src="app-config.js"></script>
 * Đặt TRƯỚC tất cả script khác.
 */

(function () {
  /* ─────────────────────────────────────────
     1. XÁC ĐỊNH APP_ID
     Ưu tiên: URL param → sessionStorage → redirect về landing
  ───────────────────────────────────────── */
  const params  = new URLSearchParams(location.search);
  const fromURL = params.get("app");
  const fromSession = sessionStorage.getItem("APP_ID");

  let APP_ID;

  if (fromURL) {
    // Có ?app= trên URL → lưu lại session
    APP_ID = fromURL.toUpperCase().replace(/[^A-Z0-9_]/g, "");
    sessionStorage.setItem("APP_ID", APP_ID);
  } else if (fromSession) {
    // Không có trên URL nhưng có trong session → tự động thêm vào URL
    APP_ID = fromSession;
    const newURL = location.href + (location.search ? "&" : "?") + "app=" + APP_ID;
    history.replaceState(null, "", newURL);
  } else {
    // Không có cả hai → về landing
    const isLoginOrLanding =
      location.pathname.includes("landing") ||
      location.pathname.includes("login");
    if (!isLoginOrLanding) {
      location.href = "landing.html";
      return;
    }
  }

  /* ─────────────────────────────────────────
     2. EXPOSE TOÀN CỤC
     Tất cả file dùng: window.APP_ID
     Thay thế: const APP_ID = ...get("app") || "TMSF"
  ───────────────────────────────────────── */
  window.APP_ID = APP_ID || "TMSF";

  /* ─────────────────────────────────────────
     3. HELPER: navigate(path)
     Dùng thay cho location.href = "xxx.html"
     Tự động giữ ?app= khi chuyển trang
     Ví dụ: navigate("index.html")
             navigate("maintenance.html")
  ───────────────────────────────────────── */
  /* ── NAV INTERCEPTOR ──
     Patch insertBefore trên mainNav để tự filter modules
     Chạy trước khi các trang build nav
  */
  window._navQueue = [];
  window._navReady = false;

  document.addEventListener("DOMContentLoaded", function() {
    const nav = document.getElementById("mainNav");
    if (!nav) return;
    const nr = nav.querySelector(".nav-right");
    if (!nr) return;

    // Override insertBefore để bắt tất cả nav link được thêm vào
    const _origInsertBefore = nav.insertBefore.bind(nav);
    nav.insertBefore = function(node, ref) {
      // Chỉ intercept <a> tags
      if (node.tagName === "A") {
        window._navQueue.push({node, ref});
        if (window._navReady) {
          _flushNavQueue(nav, _origInsertBefore);
        }
        return node;
      }
      return _origInsertBefore(node, ref);
    };

    window._origInsertBefore = _origInsertBefore;
    window._navElement = nav;
  });

  window._flushNavQueue = function(nav, origFn) {
    const fn = origFn || window._origInsertBefore;
    const nr = nav ? nav.querySelector(".nav-right") : null;
    window._navQueue.forEach(function(item) {
      const href = (item.node.getAttribute("href") || "").split("?")[0].split("/").pop();
      const MODULE_MAP = {
        "index.html":"trucking","accountant.html":"accountant",
        "performance.html":"performance","overview.html":"overview",
        "master.html":"master","maintenance.html":"maintenance",
        "fuel.html":"fuel","users.html":"users"
      };
      const mod = MODULE_MAP[href];
      if (mod && window.APP_MODULES && window.APP_MODULES[mod] === false) {
        return; // Bỏ qua — không thêm vào nav
      }
      fn(item.node, item.ref || nr);
    });
    window._navQueue = [];
  };

  window.navigate = function (path) {
    const sep = path.includes("?") ? "&" : "?";
    location.href = path + sep + "app=" + window.APP_ID;
  };

  /* ─────────────────────────────────────────
     4. PATCH LOGIN REDIRECT
     login.html dùng: location.href = found.role==="admin" ? "index.html" : ...
     Sau khi load app-config.js, thay bằng navigate()
     — không cần sửa login.html thủ công
  ───────────────────────────────────────── */
  // Patch toàn bộ link nội bộ sau khi DOM load
  document.addEventListener("DOMContentLoaded", function () {
    // Patch tất cả <a href="xxx.html"> nội bộ
    document.querySelectorAll("a[href]").forEach(function (a) {
      const href = a.getAttribute("href");
      if (
        href &&
        !href.startsWith("http") &&
        !href.startsWith("#") &&
        !href.startsWith("mailto") &&
        !href.includes("app=")
      ) {
        const sep = href.includes("?") ? "&" : "?";
        a.setAttribute("href", href + sep + "app=" + window.APP_ID);
      }
    });
  });

  /* ─────────────────────────────────────────
     5. FIREBASE KEY HELPERS
     Dùng trong tất cả trang để đọc/ghi đúng node
  ───────────────────────────────────────── */
  window.DB_KEYS = {
    maintenance : "maintenance_data_" + window.APP_ID,
    master      : "master_data_"      + window.APP_ID,
    users       : "app_users_"        + window.APP_ID,
    fuel        : "fuel_data_"        + window.APP_ID,
    fuelPrice   : "fuel_price_"       + window.APP_ID,
    tyre        : "tyre_data_"        + window.APP_ID,
  };

  /* ─────────────────────────────────────────
     6. HIỂN THỊ MÃ CÔNG TY TRÊN UI (tuỳ chọn)
     Nếu trang có element id="appIdBadge" sẽ tự điền
  ───────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", function () {
    const badge = document.getElementById("appIdBadge");
    if (badge) badge.textContent = "🏢 " + window.APP_ID;
  });

  console.log("[app-config] APP_ID =", window.APP_ID, "| Keys:", window.DB_KEYS);


  /* ─────────────────────────────────────────
     7. MODULE CONFIG — đơn giản, không block nav
     Đọc cache sessionStorage, apply ngay.
     Query Firestore bất đồng bộ sau khi trang đã render xong.
  ───────────────────────────────────────── */
  const DEFAULT_MODULES = {
    trucking: true, accountant: true, performance: true,
    overview: true, master: true, maintenance: true,
    fuel: true, driver: true, users: true
  };

  window.APP_MODULES = { ...DEFAULT_MODULES };
  window.APP_PLAN    = "pro";

  const MODULE_NAV_MAP = {
    trucking: "index.html", accountant: "accountant.html",
    performance: "performance.html", overview: "overview.html",
    master: "master.html", maintenance: "maintenance.html",
    fuel: "fuel.html", users: "users.html"
  };

  const CACHE_KEY = "APP_CFG_" + window.APP_ID;
  const CACHE_TTL = 5 * 60 * 1000;

  // Áp dụng modules lên nav (không ẩn nav trước)
  function applyModules(mods) {
    window.APP_MODULES = mods;
    // Ẩn nav link không có trong gói
    document.querySelectorAll("#mainNav a[data-module]").forEach(function(a) {
      if (mods[a.getAttribute("data-module")] === false) a.style.display = "none";
    });
    // Chặn truy cập thẳng URL
    var cur = location.pathname.split("/").pop().split("?")[0];
    var curMod = Object.keys(MODULE_NAV_MAP).find(function(k) { return MODULE_NAV_MAP[k] === cur; });
    if (curMod && mods[curMod] === false) { navigate("index.html"); return; }
    // Dispatch event
    window.dispatchEvent(new CustomEvent("appModulesLoaded", { detail: { modules: mods, plan: window.APP_PLAN } }));
  }

  // Đọc cache ngay — không chờ Firebase
  (function() {
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      if (cached && cached._ts && (Date.now() - cached._ts) < CACHE_TTL) {
        window.APP_PLAN = cached.plan || "pro";
        applyModules(cached.modules);
        console.log("[app-config] ⚡ Cache →", window.APP_PLAN);
        // Vẫn refresh cache ngầm sau 100ms
        setTimeout(refreshFromFirebase, 100);
        return;
      }
    } catch(e) {}
    // Không có cache → query sau khi trang render xong
    setTimeout(refreshFromFirebase, 0);
  })();

  function refreshFromFirebase() {
    if (!window.APP_ID) return;
    // Thử compat SDK trước
    if (window.firebase && window.firebase.firestore) {
      firebase.firestore().collection("companies")
        .where("appId","==",window.APP_ID).limit(1).get()
        .then(function(snap) { handleFirestoreResult(snap.empty ? null : snap.docs[0].data()); })
        .catch(function() { tryRTDB(); });
    } else if (window.firebase && window.firebase.database) {
      tryRTDB();
    } else if (window.__fbFS && window.__fbFS.getDocs) {
      // Modular SDK
      var _f = window.__fbFS;
      var q = _f.query(_f.collection(_f.getFirestore(), "companies"),
                       _f.where("appId","==",window.APP_ID), _f.limit(1));
      _f.getDocs(q).then(function(snap) { handleFirestoreResult(snap.empty ? null : snap.docs[0].data()); })
        .catch(function() { tryRTDB(); });
    }
    // Nếu không có SDK nào → giữ default, không làm gì
  }

  function handleFirestoreResult(cfg) {
    if (!cfg) { tryRTDB(); return; }
    if (cfg.status === "inactive") {
      alert("Tài khoản công ty đã bị khóa.");
      sessionStorage.clear(); location.href = "landing.html"; return;
    }
    var mods = {};
    Object.keys(DEFAULT_MODULES).forEach(function(k) { mods[k] = false; });
    (cfg.modules || []).forEach(function(m) { mods[m] = true; });
    window.APP_PLAN = cfg.plan || "pro";
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({modules: mods, plan: window.APP_PLAN, _ts: Date.now()})); } catch(e){}
    applyModules(mods);
    console.log("[app-config] ✅ Firestore →", window.APP_PLAN);
  }

  function tryRTDB() {
    try {
      if (window.firebase && window.firebase.database) {
        firebase.database().ref("app_config_" + window.APP_ID).once("value")
          .then(function(s) { handleRTDB(s.exists() ? s.val() : null); })
          .catch(function() {});
      } else if (window.__fbRTDB && window.__fbRTDB.get) {
        var r = window.__fbRTDB;
        r.get(r.ref(r.getDatabase(), "app_config_" + window.APP_ID))
          .then(function(s) { handleRTDB(s.exists() ? s.val() : null); })
          .catch(function() {});
      }
    } catch(e) {}
  }

  function handleRTDB(cfg2) {
    if (!cfg2) { console.log("[app-config] ℹ️ No config, default all"); return; }
    var mods;
    if (Array.isArray(cfg2.modules)) {
      mods = {}; Object.keys(DEFAULT_MODULES).forEach(function(k){mods[k]=false;});
      cfg2.modules.forEach(function(m){mods[m]=true;});
    } else if (cfg2.modules && typeof cfg2.modules === "object") {
      mods = Object.assign({}, DEFAULT_MODULES, cfg2.modules);
    } else { return; }
    window.APP_PLAN = cfg2.plan || "pro";
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({modules: mods, plan: window.APP_PLAN, _ts: Date.now()})); } catch(e){}
    applyModules(mods);
    console.log("[app-config] ✅ RTDB →", window.APP_PLAN);
  }

  window.hasModule = function(m) { return window.APP_MODULES ? window.APP_MODULES[m] !== false : true; };

  console.log("[app-config] Loaded | APP_ID =", window.APP_ID);
})();
