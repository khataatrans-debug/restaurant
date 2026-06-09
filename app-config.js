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
     7. MODULE CONFIG
     Đọc app_config_APPID từ Firebase RTDB
     Nếu chưa có → tạo mặc định (tất cả modules)
     window.APP_MODULES = { trucking: true, ... }
  ───────────────────────────────────────── */
  const DEFAULT_MODULES = {
    trucking: true, accountant: true, performance: true,
    overview: true, master: true, maintenance: true,
    fuel: true, driver: true, users: true
  };

  window.APP_MODULES = {...DEFAULT_MODULES}; // default trước khi load

  // Đọc config từ RTDB sau khi Firebase init
  window.addEventListener("load", function() {
    if (!window.firebase || !APP_ID) return;
    try {
      const db = firebase.database();
      db.ref("app_config_" + APP_ID).once("value").then(function(snap) {
        if (snap.exists()) {
          const cfg = snap.val();
          window.APP_MODULES = cfg.modules || DEFAULT_MODULES;
          window.APP_PLAN    = cfg.plan || "pro";
          window.APP_ACTIVE  = cfg.active !== false;
          applyModuleVisibility();
        } else {
          // Chưa có → tạo mặc định
          const defaultCfg = {
            active: true, plan: "pro",
            createdAt: new Date().toISOString(),
            modules: DEFAULT_MODULES
          };
          db.ref("app_config_" + APP_ID).set(defaultCfg);
          window.APP_MODULES = DEFAULT_MODULES;
          window.APP_PLAN    = "pro";
          console.log("[app-config] Created default config for", APP_ID);
          applyModuleVisibility();
        }
      }).catch(function() {
        // Firebase chưa sẵn sàng → dùng default
        applyModuleVisibility();
      });
    } catch(e) {
      applyModuleVisibility();
    }
  });

  /* Map module → file nav */
  const MODULE_NAV_MAP = {
    trucking:    "index.html",
    accountant:  "accountant.html",
    performance: "performance.html",
    overview:    "overview.html",
    master:      "master.html",
    maintenance: "maintenance.html",
    fuel:        "fuel.html",
    users:       "users.html"
    // driver: không có trong nav desktop
  };

  function applyModuleVisibility() {
    // Ẩn các nav link không được phép
    document.querySelectorAll("nav a[href]").forEach(function(a) {
      const href = a.getAttribute("href") || "";
      const page = href.replace(/\?.*$/, ""); // bỏ query string
      const module = Object.keys(MODULE_NAV_MAP).find(k => MODULE_NAV_MAP[k] === page);
      if (module && window.APP_MODULES[module] === false) {
        a.style.display = "none";
      }
    });
    // Dispatch event để các trang khác lắng nghe
    window.dispatchEvent(new CustomEvent("appModulesLoaded", {
      detail: { modules: window.APP_MODULES, plan: window.APP_PLAN }
    }));
  }

  // Helper để kiểm tra module từ bất kỳ trang nào
  window.hasModule = function(module) {
    return window.APP_MODULES ? window.APP_MODULES[module] !== false : true;
  };

  console.log("[app-config] APP_ID =", window.APP_ID, "| Keys:", window.DB_KEYS);
})();
