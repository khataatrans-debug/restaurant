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
     7. MODULE CONFIG
     Đọc từ Firestore collection "companies" (quản lý bởi admin.html)
     Fallback: RTDB app_config_APPID → default all modules
  ───────────────────────────────────────── */
  const DEFAULT_MODULES = {
    trucking: true, accountant: true, performance: true,
    overview: true, master: true, maintenance: true,
    fuel: true, driver: true, users: true
  };

  window.APP_MODULES = {...DEFAULT_MODULES}; // default trước khi load

  window.addEventListener("load", function() {
    if (!window.firebase || !APP_ID) return;
    try {
      const fs = firebase.firestore();
      // Tìm trong companies theo appId
      fs.collection("companies").where("appId","==",APP_ID).limit(1).get()
        .then(function(snap) {
          if (!snap.empty) {
            const cfg = snap.docs[0].data();
            // Nếu bị khóa → đăng xuất
            if (cfg.status === "inactive") {
              alert("Tài khoản công ty đã bị khóa. Liên hệ quản trị viên.");
              sessionStorage.clear();
              location.href = "landing.html";
              return;
            }
            // Build modules object từ array
            const mods = {};
            Object.keys(DEFAULT_MODULES).forEach(k => mods[k] = false);
            (cfg.modules || []).forEach(m => mods[m] = true);
            window.APP_MODULES = mods;
            window.APP_PLAN    = cfg.plan || "pro";
            window.APP_ACTIVE  = true;
            console.log("[app-config] Loaded from Firestore companies:", cfg.plan, cfg.modules);
            applyModuleVisibility();
          } else {
            // Chưa có trong companies → fallback RTDB
            const rtdb = firebase.database();
            rtdb.ref("app_config_" + APP_ID).once("value").then(function(s) {
              if (s.exists()) {
                const cfg2 = s.val();
                window.APP_MODULES = cfg2.modules || DEFAULT_MODULES;
                window.APP_PLAN    = cfg2.plan || "pro";
              } else {
                window.APP_MODULES = {...DEFAULT_MODULES};
                window.APP_PLAN    = "pro";
              }
              applyModuleVisibility();
            }).catch(function() { applyModuleVisibility(); });
          }
        }).catch(function() {
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
    window._navReady = true;

    // Flush nav queue (các link chờ được thêm)
    if (window._navQueue && window._navQueue.length > 0) {
      window._flushNavQueue(window._navElement, window._origInsertBefore);
    }

    // Ẩn các nav link đã render không được phép
    document.querySelectorAll("nav a[href], #mainNav a[href]").forEach(function(a) {
      const href = a.getAttribute("href") || "";
      const page = href.split("?")[0].split("/").pop();
      const module = Object.keys(MODULE_NAV_MAP).find(k => MODULE_NAV_MAP[k] === page);
      if (module && window.APP_MODULES[module] === false) {
        a.style.display = "none";
      }
    });

    // Chặn truy cập thẳng URL trang không được phép
    const currentPage = location.pathname.split("/").pop().split("?")[0];
    const currentModule = Object.keys(MODULE_NAV_MAP).find(k => MODULE_NAV_MAP[k] === currentPage);
    if (currentModule && window.APP_MODULES[currentModule] === false) {
      navigate("index.html");
      return;
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent("appModulesLoaded", {
      detail: { modules: window.APP_MODULES, plan: window.APP_PLAN }
    }));
    console.log("[app-config] Modules applied:", window.APP_PLAN, window.APP_MODULES);
  }

  // Helper để kiểm tra module từ bất kỳ trang nào
  window.hasModule = function(module) {
    return window.APP_MODULES ? window.APP_MODULES[module] !== false : true;
  };

  // Lắng nghe event để ẩn nav sau khi modules load xong
  window.addEventListener("appModulesLoaded", function(e) {
    const mods = e.detail.modules;
    document.querySelectorAll("#mainNav a[href]").forEach(function(a) {
      const href = a.getAttribute("href") || "";
      const page = href.split("?")[0].split("/").pop();
      const module = Object.keys(MODULE_NAV_MAP).find(k => MODULE_NAV_MAP[k] === page);
      if (module && mods[module] === false) {
        a.style.display = "none";
      }
    });
  });

  console.log("[app-config] APP_ID =", window.APP_ID, "| Keys:", window.DB_KEYS);
})();
