// Service worker tối giản — CHỈ để thỏa điều kiện "cài app" (Add to Home Screen) của Android.
// Không cache bất kỳ dữ liệu nào: mọi request vẫn đi thẳng qua mạng như bình thường,
// tránh rủi ro hiển thị dữ liệu cũ (đơn hàng, bàn, menu... đều cần realtime).
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  // ►►► CHỈ can thiệp request CÙNG DOMAIN. Các request khác domain (Firebase Auth,
  //     Firestore, Google APIs...) để trình duyệt tự xử lý — không respondWith(),
  //     tránh trường hợp Service Worker xen vào làm treo/lỗi request xác thực khi
  //     chạy standalone (đây chính là nguyên nhân nút Đăng nhập không phản hồi).
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request));
});
