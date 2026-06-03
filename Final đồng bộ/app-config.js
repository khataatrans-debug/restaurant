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
})();
