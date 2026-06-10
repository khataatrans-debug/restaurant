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
  ───────────────────────────────────────── */
  window.navigate = function (path) {
    const sep = path.includes("?") ? "&" : "?";
    location.href = path + sep + "app=" + window.APP_ID;
  };

  /* ─────────────────────────────────────────
     4. PATCH LINK NỘI BỘ
  ───────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("a[href]").forEach(function (a) {
      const href = a.getAttribute("href");
      if (href && !href.startsWith("http") && !href.startsWith("#") &&
          !href.startsWith("mailto") && !href.includes("app=")) {
        const sep = href.includes("?") ? "&" : "?";
        a.setAttribute("href", href + sep + "app=" + window.APP_ID);
      }
    });
  });

  /* ─────────────────────────────────────────
     5. FIREBASE KEY HELPERS
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
     6. BADGE APP_ID
  ───────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", function () {
    const badge = document.getElementById("appIdBadge");
    if (badge) badge.textContent = "🏢 " + window.APP_ID;
  });
  /* ─────────────────────────────────────────
     NAV INTERCEPTOR
     Dùng để filter modules TRƯỚC khi các trang build nav.
     Cơ chế: buffer link, flush sau khi modules đã load.
  ───────────────────────────────────────── */
  window._navQueue  = [];
  window._navReady  = false;

  // Bắt insertBefore trên mainNav ngay khi DOM sẵn
  document.addEventListener("DOMContentLoaded", function () {
    const nav = document.getElementById("mainNav");
    if (!nav) return;
    const nr = nav.querySelector(".nav-right");

    const _orig = nav.insertBefore.bind(nav);
    nav.insertBefore = function (node, ref) {
      if (node.tagName === "A") {
        window._navQueue.push({ node, ref });
        if (window._navReady) _flushNavQueue();
        return node;
      }
      return _orig(node, ref);
    };
    window._origInsertBefore = _orig;
    window._navElement       = nav;
  });

  window._flushNavQueue = function () {
    const nav  = window._navElement;
    const orig = window._origInsertBefore;
    if (!nav || !orig) return;
    const nr = nav.querySelector(".nav-right");
    window._navQueue.forEach(function (item) {
      const href = (item.node.getAttribute("href") || "").split("?")[0].split("/").pop();
      const MODULE_MAP = {
        "index.html": "trucking", "accountant.html": "accountant",
        "performance.html": "performance", "overview.html": "overview",
        "master.html": "master", "maintenance.html": "maintenance",
        "fuel.html": "fuel", "users.html": "users"
      };
      const mod = MODULE_MAP[href];
      if (mod && window.APP_MODULES && window.APP_MODULES[mod] === false) return;
      orig(item.node, item.ref || nr);
    });
    window._navQueue = [];
  };

  /* ─────────────────────────────────────────
     7. MODULE CONFIG
     Ưu tiên: Firestore companies → RTDB app_config_APPID → default all
     Dùng polling để chờ Firebase SDK thay vì window.load
  ───────────────────────────────────────── */
  const DEFAULT_MODULES = {
    trucking: true, accountant: true, performance: true,
    overview: true, master: true,    maintenance: true,
    fuel: true,     driver: true,    users: true
  };

  window.APP_MODULES = { ...DEFAULT_MODULES }; // fallback tức thì
  window.APP_PLAN    = "pro";

  /* Map module → filename */
  const MODULE_NAV_MAP = {
    trucking:    "index.html",
    accountant:  "accountant.html",
    performance: "performance.html",
    overview:    "overview.html",
    master:      "master.html",
    maintenance: "maintenance.html",
    fuel:        "fuel.html",
    users:       "users.html"
  };

  // Chờ Firebase SDK sẵn sàng (polling tối đa 10s)
  function waitForFirebase(cb, attempt) {
    attempt = attempt || 0;
    if (window.firebase && window.firebase.firestore) {
      cb();
    } else if (attempt < 100) {
      setTimeout(function () { waitForFirebase(cb, attempt + 1); }, 100);
    } else {
      console.warn("[app-config] Firebase SDK không load được, dùng default modules");
      applyModuleVisibility();
    }
  }

  function loadModules() {
    if (!window.APP_ID || window.APP_ID === "TMSF") {
      applyModuleVisibility();
      return;
    }
    try {
      const fs = firebase.firestore();
      fs.collection("companies").where("appId", "==", window.APP_ID).limit(1).get()
        .then(function (snap) {
          if (!snap.empty) {
            const cfg = snap.docs[0].data();

            // Bị khóa → đăng xuất
            if (cfg.status === "inactive") {
              alert("Tài khoản công ty đã bị khóa. Liên hệ quản trị viên.");
              sessionStorage.clear();
              location.href = "landing.html";
              return;
            }

            // Build modules từ array lưu trong Firestore
            const mods = {};
            Object.keys(DEFAULT_MODULES).forEach(function (k) { mods[k] = false; });
            (cfg.modules || []).forEach(function (m) { mods[m] = true; });

            window.APP_MODULES = mods;
            window.APP_PLAN    = cfg.plan || "pro";
            window.APP_ACTIVE  = true;
            console.log("[app-config] ✅ Firestore →", cfg.plan, cfg.modules);
            applyModuleVisibility();
          } else {
            // Fallback: RTDB app_config_APPID
            firebase.database().ref("app_config_" + window.APP_ID).once("value")
              .then(function (s) {
                if (s.exists()) {
                  const cfg2 = s.val();
                  // RTDB lưu modules dạng object {trucking:true,...}
                  if (cfg2.modules && typeof cfg2.modules === "object" && !Array.isArray(cfg2.modules)) {
                    window.APP_MODULES = Object.assign({}, DEFAULT_MODULES, cfg2.modules);
                  } else if (Array.isArray(cfg2.modules)) {
                    const mods = {};
                    Object.keys(DEFAULT_MODULES).forEach(function (k) { mods[k] = false; });
                    cfg2.modules.forEach(function (m) { mods[m] = true; });
                    window.APP_MODULES = mods;
                  }
                  window.APP_PLAN = cfg2.plan || "pro";
                  // Nếu RTDB đánh dấu inactive
                  if (cfg2.active === false) {
                    alert("Tài khoản công ty đã bị khóa. Liên hệ quản trị viên.");
                    sessionStorage.clear();
                    location.href = "landing.html";
                    return;
                  }
                  console.log("[app-config] ✅ RTDB fallback →", window.APP_PLAN, window.APP_MODULES);
                } else {
                  console.log("[app-config] ℹ️ Không có config → dùng default all modules");
                }
                applyModuleVisibility();
              })
              .catch(function () { applyModuleVisibility(); });
          }
        })
        .catch(function (e) {
          console.error("[app-config] Firestore error:", e.message);
          applyModuleVisibility();
        });
    } catch (e) {
      console.error("[app-config] loadModules error:", e);
      applyModuleVisibility();
    }
  }

  function applyModuleVisibility() {
    window._navReady = true;

    // 1. Flush nav queue (các link đang chờ)
    if (window._navQueue && window._navQueue.length > 0) {
      _flushNavQueue();
    }

    // 2. Ẩn các nav link đã render sẵn trong DOM
    document.querySelectorAll("nav a[href], #mainNav a[href]").forEach(function (a) {
      const href   = a.getAttribute("href") || "";
      const page   = href.split("?")[0].split("/").pop();
      const module = Object.keys(MODULE_NAV_MAP).find(function (k) {
        return MODULE_NAV_MAP[k] === page;
      });
      if (module && window.APP_MODULES[module] === false) {
        a.style.display = "none";
      }
    });

    // 3. Chặn truy cập thẳng URL trang không được phép
    const currentPage   = location.pathname.split("/").pop().split("?")[0];
    const currentModule = Object.keys(MODULE_NAV_MAP).find(function (k) {
      return MODULE_NAV_MAP[k] === currentPage;
    });
    if (currentModule && window.APP_MODULES[currentModule] === false) {
      console.warn("[app-config] Module bị chặn:", currentModule, "→ redirect index");
      navigate("index.html");
      return;
    }

    // 4. Dispatch event để các trang lắng nghe
    window.dispatchEvent(new CustomEvent("appModulesLoaded", {
      detail: { modules: window.APP_MODULES, plan: window.APP_PLAN }
    }));

    console.log("[app-config] ✅ Modules applied | Plan:", window.APP_PLAN, "| Modules:", window.APP_MODULES);
  }

  // Kick off: chờ Firebase rồi load modules
  waitForFirebase(loadModules);

  /* ─────────────────────────────────────────
     8. HELPER hasModule()
  ───────────────────────────────────────── */
  window.hasModule = function (module) {
    return window.APP_MODULES ? window.APP_MODULES[module] !== false : true;
  };

  console.log("[app-config] Loaded | APP_ID =", window.APP_ID);
})();
