/**
 * nav-menu.js — Menu nhóm dùng CHUNG cho mọi trang (1 nguồn duy nhất)
 * ─────────────────────────────────────────────────────────────────
 * MỤC ĐÍCH: thay dần nav ngang đang copy-paste ở mỗi file (ALL_NAV/MODULE_MAP)
 * bằng 1 nguồn NAV_GROUPS duy nhất — thêm/sửa module chỉ cần sửa Ở ĐÂY,
 * mọi trang nhúng file này tự động cập nhật.
 *
 * KHÔNG đụng vào cơ chế phân quyền hiện có:
 *  - Vẫn đọc localStorage["LOGIN_USER"] y hệt guard script của từng trang.
 *  - Vẫn check session.role / session.pages[] / APP_MODULES y hệt logic cũ.
 *  - Việc "nhảy giữa module" vẫn là <a href="xxx.html?app=..."> bình thường —
 *    trang đích tự chạy guard riêng của nó, KHÔNG cần sửa gì thêm ở đây.
 *
 * CÁCH NHÚNG (đặt SAU app-config.js và SAU guard script của trang):
 *   <script src="nav-menu.js?v=1"></script>
 *
 * File tự chèn 1 nút ☰ vào #mainNav (nav-right) — bấm vào mở overlay.
 */

/* ══════════════════════════════════════════
   [1] NGUỒN DUY NHẤT — NAV_GROUPS
   Liên quan: thay thế ALL_NAV/MODULE_MAP đang copy-paste ở từng file
   Thêm module mới → CHỈ sửa ở đây, không sửa từng trang nữa
══════════════════════════════════════════ */
window.NAV_GROUPS = [
  {
    icon: "🍽️", label: "Nhà hàng / Restaurant",
    items: [
      { page: "restaurant.html", label: "Nhà hàng", module: "restaurant" },
      { page: "pos.html", label: "Bán hàng/pos", module: "restaurant" },
      { page: "kitchen.html", label: "Bếp/kitchen", module: "restaurant" },
      { page: "report.html", label: "Lịch sử & Báo cáo", module: "restaurant" },
      { page: "users.html",  label: "Phân quyền",      module: "users",   adminOnly: true },
    ]
  },
];

/* ══════════════════════════════════════════
   [2] LOGIC — filter theo quyền, render overlay
══════════════════════════════════════════ */
(function () {

  function getSession() {
    try { return JSON.parse(localStorage.getItem("LOGIN_USER") || "null"); }
    catch (e) { return null; }
  }

  function canSeeItem(session, item) {
    if (!session) return false;
    if (session.role === "admin" || session.role === "viceadmin") return true;
    if (item.adminOnly) return false;
    return (session.pages || []).includes(item.page);
  }

  function isModuleOn(item) {
    // APP_MODULES do app-config.js nạp — nếu chưa có (đang load) thì mặc định cho hiện,
    // applyModuleNav của app-config.js sẽ ẩn lại đúng module nếu company không bật.
    if (!item.module) return true;
    if (!window.APP_MODULES) return true;
    return window.APP_MODULES[item.module] !== false;
  }

  function buildVisibleGroups(session) {
    return window.NAV_GROUPS
      .map(g => ({ ...g, items: g.items.filter(it => canSeeItem(session, it) && isModuleOn(it)) }))
      .filter(g => g.items.length > 0);
  }

  function currentPage() {
    return (location.pathname.split("/").pop() || "index.html").split("?")[0];
  }

  function withApp(href) {
    if (typeof window.navigate === "function") return href; // sẽ dùng navigate() ở onclick thay vì href trực tiếp
    const app = window.APP_ID || new URLSearchParams(location.search).get("app") || "";
    return href + (app ? "?app=" + app : "");
  }

  /* ── CSS: chèn 1 lần, dùng biến màu riêng để không đụng CSS của trang chủ ── */
  function injectStyles() {
    if (document.getElementById("navMenuStyles")) return;
    const style = document.createElement("style");
    style.id = "navMenuStyles";
    style.textContent = `
      .nm-toggle-btn{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.15);
        border-radius:5px;padding:4px 11px;font-size:13px;font-family:inherit;cursor:pointer;transition:.15s;margin-right:4px;}
      .nm-toggle-btn:hover{background:rgba(255,255,255,.2);}
      .nm-overlay{position:fixed;inset:0;background:rgba(9,16,38,.55);z-index:9500;display:none;}
      .nm-overlay.open{display:block;}
      .nm-drawer{position:fixed;top:0;left:0;bottom:0;width:260px;max-width:88vw;background:#0d1b3e;
        box-shadow:4px 0 24px rgba(0,0,0,.35);display:flex;flex-direction:column;font-family:'Be Vietnam Pro','Segoe UI',Arial,sans-serif;
        transform:translateX(-100%);transition:transform .2s ease;}
      .nm-overlay.open .nm-drawer{transform:translateX(0);}
      .nm-header{padding:18px 18px 14px;border-bottom:1px solid rgba(255,255,255,.08);}
      .nm-header .nm-title{color:#fff;font-weight:700;font-size:15px;}
      .nm-header .nm-sub{color:rgba(255,255,255,.5);font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;margin-top:2px;}
      .nm-close{position:absolute;top:14px;right:14px;background:none;border:none;color:rgba(255,255,255,.7);font-size:18px;cursor:pointer;}
      .nm-body{flex:1;overflow-y:auto;padding:8px 0;}
      .nm-group-head{display:flex;align-items:center;gap:10px;padding:12px 18px;cursor:pointer;color:rgba(255,255,255,.92);
        font-weight:700;font-size:13px;transition:.15s;}
      .nm-group-head:hover{background:rgba(255,255,255,.06);}
      .nm-group-head.active{background:rgba(255,255,255,.09);}
      .nm-group-head .nm-arrow{margin-left:auto;font-size:10px;transition:transform .15s;color:rgba(255,255,255,.5);}
      .nm-group-head.open .nm-arrow{transform:rotate(90deg);}
      .nm-sub-list{max-height:0;overflow:hidden;transition:max-height .2s ease;}
      .nm-sub-list.open{max-height:400px;}
      .nm-sub-item{display:block;padding:9px 18px 9px 46px;color:rgba(255,255,255,.62);font-size:12.5px;
        text-decoration:none;transition:.15s;}
      .nm-sub-item:hover{background:rgba(255,255,255,.06);color:#fff;}
      .nm-sub-item.current{color:#fff;font-weight:700;background:rgba(29,110,245,.35);}
      .nm-footer{padding:12px 18px;border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;}
      .nm-footer .nm-user{color:rgba(255,255,255,.75);font-size:12px;font-weight:600;flex:1;}
      .nm-footer .nm-logout{background:rgba(255,255,255,.1);color:rgba(255,255,255,.8);border:1px solid rgba(255,255,255,.15);
        border-radius:5px;padding:5px 10px;font-size:11.5px;font-family:inherit;cursor:pointer;}
      .nm-footer .nm-logout:hover{background:rgba(255,255,255,.2);color:#fff;}
    `;
    document.head.appendChild(style);
  }

  function closeOverlay() {
    const ov = document.getElementById("nmOverlay");
    if (ov) ov.classList.remove("open");
  }

  function openOverlay() {
    const ov = document.getElementById("nmOverlay");
    if (ov) ov.classList.add("open");
  }

  function buildOverlay(session) {
    let ov = document.getElementById("nmOverlay");
    if (ov) ov.remove();

    const groups = buildVisibleGroups(session);
    const curPage = currentPage();

    ov = document.createElement("div");
    ov.className = "nm-overlay";
    ov.id = "nmOverlay";
    ov.innerHTML = `
      <div class="nm-drawer" onclick="event.stopPropagation()">
        <div class="nm-header">
          <div class="nm-title">📋 Danh mục module</div>
          <div class="nm-sub">Chọn nhóm để xem các phân hệ</div>
          <button class="nm-close" id="nmCloseBtn">✕</button>
        </div>
        <div class="nm-body" id="nmBody"></div>
        <div class="nm-footer">
          <span class="nm-user">👤 ${session ? session.username : ""} (${session ? session.role : ""})</span>
          <button class="nm-logout" id="nmLogoutBtn">↩ Đăng xuất</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    const body = document.getElementById("nmBody");
    groups.forEach((g, gi) => {
      const hasCurrent = g.items.some(it => it.page === curPage);
      const head = document.createElement("div");
      head.className = "nm-group-head" + (hasCurrent ? " open active" : "");
      head.innerHTML = `<span>${g.icon}</span><span>${g.label}</span><span class="nm-arrow">▶</span>`;
      const subList = document.createElement("div");
      subList.className = "nm-sub-list" + (hasCurrent ? " open" : "");
      subList.innerHTML = g.items.map(it => `
        <a class="nm-sub-item${it.page === curPage ? " current" : ""}" href="${withApp(it.page)}"
           ${typeof window.navigate === "function" ? `onclick="event.preventDefault();window.navigate('${it.page}')"` : ""}>
          ${it.label}
        </a>`).join("");

      head.addEventListener("click", () => {
        const willOpen = !head.classList.contains("open");
        body.querySelectorAll(".nm-group-head").forEach(h => h.classList.remove("open"));
        body.querySelectorAll(".nm-sub-list").forEach(s => s.classList.remove("open"));
        if (willOpen) { head.classList.add("open"); subList.classList.add("open"); }
      });

      body.appendChild(head);
      body.appendChild(subList);
    });

    ov.addEventListener("click", closeOverlay); // click ra ngoài drawer → đóng
    document.getElementById("nmCloseBtn").onclick = closeOverlay;
    document.getElementById("nmLogoutBtn").onclick = function () {
      localStorage.removeItem("LOGIN_USER");
      location.href = "login.html" + (location.search || "");
    };
  }

  function mountToggleButton() {
    const nav = document.getElementById("mainNav");
    if (!nav) return; // trang không có #mainNav (VD login.html) → bỏ qua
    if (document.getElementById("nmToggleBtn")) return;
    const navRight = nav.querySelector(".nav-right") || nav;
    const btn = document.createElement("button");
    btn.className = "nm-toggle-btn";
    btn.id = "nmToggleBtn";
    btn.textContent = "☰ Menu";
    btn.onclick = openOverlay;
    nav.insertBefore(btn, navRight);
  }


  function init() {
    const session = getSession();
    if (!session) return; // chưa đăng nhập → không hiện menu (guard riêng của trang sẽ tự redirect)
    injectStyles();
    buildOverlay(session);
    mountToggleButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Rebuild overlay nếu APP_MODULES nạp muộn hơn (tránh hiện nhóm bị khóa rồi mới ẩn)
  window.addEventListener("appModulesLoaded", function () {
    const session = getSession();
    if (session) buildOverlay(session);
  });
})();
