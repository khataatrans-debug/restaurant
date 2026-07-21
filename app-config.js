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
             navigate("pos.html")
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
    users : "app_users_" + window.APP_ID,
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
  ───────────────────────────────────────── */
  const DEFAULT_MODULES = {
    restaurant: true, users: true
  };

  // Ẩn TẤT CẢ nav link ngay khi load để tránh nháy (flicker):
  // thay vì hiện hết rồi ẩn bớt sau khi Firestore trả về, giờ ẩn trước rồi hiện đúng link sau.
  const _navHideStyle = document.createElement("style");
  _navHideStyle.id = "navHideBeforeModules";
  _navHideStyle.textContent = "#mainNav a[data-module] { visibility: hidden !important; }";
  document.head.appendChild(_navHideStyle);

  window.APP_MODULES = {...DEFAULT_MODULES}; // default trước khi load

  // Dùng cache sessionStorage ngay lập tức nếu có — không cần chờ Firestore, không nháy
  (function(){
    const cached = sessionStorage.getItem("APP_MODULES_"+APP_ID);
    if(cached){ try{
      const mods = JSON.parse(cached);
      window.APP_MODULES = mods;
      document.addEventListener("DOMContentLoaded", function(){
        applyModuleVisibility();
      });
    }catch(e){} }
  })();

  window.addEventListener("load", function() {
    if (!APP_ID) { applyModuleVisibility(); return; }
    // Quan trọng: KHÔNG phụ thuộc window.firebase (Compat SDK) của từng trang —
    // vì các trang (index.html, restaurant.html...) dùng Firebase Modular SDK, khởi tạo
    // riêng/độc lập, không gán vào window.firebase. app-config.js tự kết nối lấy,
    // luôn trỏ đúng project transportation-6d6f5 (nơi admin.html quản lý "companies").
    Promise.all([
      import("https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/11.8.1/firebase-database.js"),
      import("https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js")
    ]).then(function([appMod, fsMod, rtdbMod, authMod]) {
      const cfgApp = appMod.initializeApp({
        apiKey: "AIzaSyAPmHlNgx-w5KfK4LF490pvdYA_mGgcX_k",
        authDomain: "transportation-6d6f5.firebaseapp.com",
        databaseURL: "https://transportation-6d6f5-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "transportation-6d6f5",
        storageBucket: "transportation-6d6f5.firebasestorage.app",
        messagingSenderId: "1097685849973",
        appId: "1:1097685849973:web:79ad636e3dfd0b12f7653c"
      }, "appConfigConn"); // tên app riêng, tránh đụng app Firebase chính của từng trang

      const fs   = fsMod.getFirestore(cfgApp);
      const rtdb = rtdbMod.getDatabase(cfgApp);

      // Đăng nhập ẩn danh riêng cho kết nối này — vì đây là app Firebase độc lập với
      // app chính của từng trang (đặt tên khác), signInAnonymously() ở trang chính
      // KHÔNG tự động áp dụng cho kết nối này. Bắt buộc từ khi Rules yêu cầu
      // request.auth != null. Có timeout dự phòng 5s để không treo mãi nếu lỗi mạng.
      const cfgAuth = authMod.getAuth(cfgApp);
      const cfgAuthReady = new Promise(function(resolve){
        authMod.onAuthStateChanged(cfgAuth, function(user){
          if (user) resolve(user);
          else authMod.signInAnonymously(cfgAuth).catch(function(err){ console.error("[app-config] Lỗi đăng nhập ẩn danh:", err); });
        });
        setTimeout(function(){ console.warn("[app-config] Đăng nhập ẩn danh quá thời gian chờ, tiếp tục không có auth"); resolve(null); }, 8000);
      });

      const q = fsMod.query(fsMod.collection(fs,"companies"), fsMod.where("appId","==",APP_ID), fsMod.limit(1));
      cfgAuthReady.then(function(){ return fsMod.getDocs(q); }).then(function(snap) {
        if (!snap.empty) {
          const cfg = snap.docs[0].data();
          // Nếu bị khóa → đăng xuất
          if (cfg.status === "inactive") {
            alert("Tài khoản công ty đã bị khóa. Liên hệ quản trị viên.");
            sessionStorage.clear();
            location.href = "landing.html";
            return;
          }
          // Nếu hết hạn sử dụng → đăng xuất
          if (cfg.expiryDate) {
            const expDate = new Date(cfg.expiryDate + "T23:59:59");
            if (new Date() > expDate) {
              alert("⏰ Phần mềm đã hết hạn sử dụng (hết hạn: " + cfg.expiryDate.split("-").reverse().join("/") + ").\nLiên hệ quản trị viên để gia hạn.");
              sessionStorage.clear();
              location.href = "landing.html";
              return;
            }
          }
          // Build modules object từ array
          const mods = {};
          Object.keys(DEFAULT_MODULES).forEach(k => mods[k] = false);
          (cfg.modules || []).forEach(m => mods[m] = true);
          window.APP_MODULES = mods;
          window.APP_ACTIVE  = true;
          console.log("[app-config] Loaded from Firestore companies:", cfg.modules);
          sessionStorage.setItem("APP_MODULES_"+APP_ID, JSON.stringify(mods));
          applyModuleVisibility();
        } else {
          // Chưa có trong companies → fallback RTDB
          rtdbMod.get(rtdbMod.ref(rtdb, "app_config_" + APP_ID)).then(function(s) {
            if (s.exists()) {
              const cfg2 = s.val();
              if (cfg2.expiryDate) {
                const expDate2 = new Date(cfg2.expiryDate + "T23:59:59");
                if (new Date() > expDate2) {
                  alert("⏰ Phần mềm đã hết hạn sử dụng (hết hạn: " + cfg2.expiryDate.split("-").reverse().join("/") + ").\nLiên hệ quản trị viên để gia hạn.");
                  sessionStorage.clear();
                  location.href = "landing.html";
                  return;
                }
              }
              if (cfg2.active === false) {
                alert("Tài khoản công ty đã bị khóa. Liên hệ quản trị viên.");
                sessionStorage.clear();
                location.href = "landing.html";
                return;
              }
              window.APP_MODULES = cfg2.modules || DEFAULT_MODULES;
            } else {
              window.APP_MODULES = {...DEFAULT_MODULES};
            }
            applyModuleVisibility();
          }).catch(function() { applyModuleVisibility(); });
        }
      }).catch(function(e) {
        console.warn("[app-config] Lỗi đọc companies:", e);
        applyModuleVisibility();
      });
    }).catch(function(e) {
      console.warn("[app-config] Lỗi load Firebase SDK:", e);
      applyModuleVisibility();
    });
  });

  /* Map trang → module (nhiều trang cùng chung 1 module "restaurant") */
  const PAGE_MODULE_MAP = {
    "restaurant.html": "restaurant",
    "pos.html":        "restaurant",
    "kitchen.html":    "restaurant",
    "report.html":     "restaurant",
  };
  // Trang mặc định để redirect về khi trang hiện tại bị khoá, theo từng module
  const DEFAULT_PAGE_FOR_MODULE = { restaurant: "restaurant.html" };

  function applyModuleVisibility() {
    // Ẩn các nav link đã render không được phép
    // ⚠️ BỎ QUA link đã có data-module — các link này đã được guard script
    // trong từng trang tự quản lý ẩn/hiện (biết cả ẩn LẪN hiện lại đúng lúc).
    // Nếu đụng vào đây nữa sẽ có 2 hệ thống cùng sửa 1 thẻ <a> mà không biết về nhau
    // → sinh lỗi ẩn/hiện chập chờn tùy thứ tự chạy trước-sau giữa các lần tải trang.
    // Đoạn dưới chỉ còn tác dụng dự phòng cho các trang CHƯA gắn data-module.
    document.querySelectorAll("nav a[href], #mainNav a[href]").forEach(function(a) {
      if (a.hasAttribute("data-module")) return;
      const href = a.getAttribute("href") || "";
      const page = href.split("?")[0].split("/").pop();
      const module = PAGE_MODULE_MAP[page];
      if (module && window.APP_MODULES[module] === false) {
        a.style.display = "none";
      }
    });

    // Bỏ style ẩn tạm → các link được phép sẽ hiện lại, không còn nháy
    const hideStyle = document.getElementById("navHideBeforeModules");
    if (hideStyle) hideStyle.remove();

    // Chặn truy cập thẳng URL trang không được phép
    const currentPage = location.pathname.split("/").pop().split("?")[0];
    const currentModule = PAGE_MODULE_MAP[currentPage];
    if (currentModule && window.APP_MODULES[currentModule] === false) {
      // Tìm module đầu tiên mà công ty này THỰC SỰ được cấp quyền, tránh redirect cứng
      // về 1 trang cố định (sẽ gây vòng lặp nếu công ty tắt luôn cả module đó)
      const firstAllowed = Object.keys(DEFAULT_PAGE_FOR_MODULE).find(m => window.APP_MODULES[m] !== false);
      navigate(firstAllowed ? DEFAULT_PAGE_FOR_MODULE[firstAllowed] : "login.html");
      return;
    }

    // Dispatch event
    window.dispatchEvent(new CustomEvent("appModulesLoaded", {
      detail: { modules: window.APP_MODULES }
    }));
    console.log("[app-config] Modules applied:", window.APP_MODULES);
  }

  // Helper để kiểm tra module từ bất kỳ trang nào
  window.hasModule = function(module) {
    return window.APP_MODULES ? window.APP_MODULES[module] !== false : true;
  };

  // Lắng nghe event để ẩn nav sau khi modules load xong
  // (dự phòng cho trang chưa gắn data-module; trang đã có data-module thì
  // guard script của chính trang đó tự lo, bỏ qua ở đây để tránh giẫm chân nhau)
  window.addEventListener("appModulesLoaded", function(e) {
    const mods = e.detail.modules;
    document.querySelectorAll("#mainNav a[href]").forEach(function(a) {
      if (a.hasAttribute("data-module")) return;
      const href = a.getAttribute("href") || "";
      const page = href.split("?")[0].split("/").pop();
      const module = PAGE_MODULE_MAP[page];
      if (module && mods[module] === false) {
        a.style.display = "none";
      }
    });
  });

  console.log("[app-config] APP_ID =", window.APP_ID, "| Keys:", window.DB_KEYS);
})();
