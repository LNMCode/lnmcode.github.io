# Triển khai Hán Ngữ Phiêu Lưu trên GitHub Pages

Repo `LNMCode/lnmcode.github.io` dùng nhánh `dev_pages`. Trang game nằm tại [lnmcode.github.io/learning/hsk1/](https://lnmcode.github.io/learning/hsk1/). Dấu gạch chéo cuối là URL chuẩn của thư mục.

1. Trong repo trên GitHub, vào **Settings → Pages → Build and deployment → Source** và chọn **GitHub Actions**. Kiểm tra **Settings → Environments → github-pages** cho phép nhánh `dev_pages` nếu môi trường giới hạn nhánh được deploy.
2. Push commit lên nhánh `dev_pages`.
3. Vào **Actions → Deploy GitHub Pages**. Khi job `deploy` chạy xong, mở trang game trên Safari. Kiểm tra trang chủ, trang chính sách bảo mật và `app-ads.txt` tại đường dẫn hiện có.
4. Trong game, vào **Cài đặt** và chờ thông báo sẵn sàng học ngoại tuyến. Bật chế độ máy bay, mở lại trang hoặc biểu tượng đã cài và thử vào sổ từ. Giọng đọc phụ thuộc các giọng tiếng Trung trên thiết bị.

Workflow chạy các bài kiểm thử Node trước khi đóng gói website tĩnh. Gói chứa cả trang chủ và các tài nguyên công khai hiện có. Service worker lưu tài nguyên của game theo phiên bản commit, với phạm vi `/learning/hsk1/`. Khi có bản mới đã tải xong, game hiện nút **Mở bản mới**.

Có thể chọn **Re-run jobs** trên một lần chạy đã có. GitHub chỉ hiển thị nút **Run workflow** khi workflow có trên nhánh mặc định. Nếu nút này khả dụng, chọn nhánh `dev_pages`. [Hướng dẫn GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) · [Điều kiện chạy thủ công](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

Đường dẫn nội bộ dùng URL tương đối. Nếu đưa game sang repo dạng project site, giữ cụm tệp `learning/hsk1/` trong cùng thư mục và dùng URL `https://USERNAME.github.io/REPO/learning/hsk1/`.

## Kiểm thử

Chạy `node --test tests/hsk1/*.test.cjs` từ thư mục gốc. Để kiểm tra bằng trình duyệt, phục vụ repo qua HTTP cục bộ như trong [README](README.md), rồi chạy `node tests/hsk1/browser-smoke.cjs http://127.0.0.1:8975/learning/hsk1/` với Playwright đã cài. Có thể trỏ biến môi trường `HSK_PLAYWRIGHT_MODULE` đến bản Playwright có sẵn. Dùng `HSK_BROWSER=webkit` nếu đã cài WebKit cho Playwright.

Để kiểm tra bốn mini game trên Chromium, chạy `node tests/hsk1/arcade-browser.cjs http://127.0.0.1:8975/learning/hsk1/`. Hiệu ứng Sao Pinyin dùng Three.js r180 và chế độ 2D dự phòng. Cả hai mô-đun Three.js cùng dữ liệu nét chữ được lưu cục bộ trong `learning/hsk1/arcade/`. [Giấy phép Three.js](learning/hsk1/arcade/vendor/THREE-LICENSE.txt) · [Giấy phép dữ liệu nét](learning/hsk1/arcade/ARPHICPL.TXT)
