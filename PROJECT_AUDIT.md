# Khảo sát Hán Ngữ Phiêu Lưu

## Hiện trạng bản ZIP

ZIP có 9 tệp, giải nén và kiểm tra toàn vẹn thành công. `index.html` nạp dữ liệu, engine và giao diện JavaScript thuần. Hai ảnh PNG có kích thước 192 × 192 và 512 × 512. Game đã có bản đồ, thẻ học, sổ từ, bài Pinyin, ghép câu, điền từ, đoạn đọc, lịch ôn theo từng kỹ năng, lưu bằng localStorage, xuất và nhập JSON.

| Dữ liệu | Số bản ghi trong ZIP |
| --- | ---: |
| Từ vựng | 300 |
| Khu vực | 20 |
| Nhiệm vụ | 72 |
| Câu | 317 |
| Đoạn đọc | 20 |

## Các điểm cần sửa

- Bản ZIP đưa người dùng iPhone sang Netlify nếu game chưa nạp. Nếu một script quan trọng lỗi, màn hình có thể đứng ở thông báo đang mở.
- Service worker cũ xóa tất cả cache khác trên cùng domain khi kích hoạt. Nó giữ tài nguyên theo tên phiên bản cố định và không có báo trạng thái khi lưu ngoại tuyến thất bại.
- Sổ từ có mục trỏ tới ví dụ thiếu từ mục tiêu, Pinyin hoặc bản dịch lệch giữa hai bản ghi, và có câu thiếu token. Nguồn trong dữ liệu ban đầu trỏ tới danh sách bên thứ ba. Xem [đối chiếu chính thức](CONTENT_VALIDATION.md).
- Lịch ôn phiên bản cũ tăng khoảng cách theo chuỗi đáp án đúng, kể cả khi trả lời liên tục trong một buổi. Ghép câu và điền từ cần kiểm tra từ đã học và ngữ cảnh khi chấm.
- Khôi phục JSON chỉ kiểm tra một số trường cấp cao. Một lượt chơi lưu dở có thể trỏ đến câu hoặc lựa chọn không hợp lệ.

## Tích hợp

Game dùng lại cấu trúc HTML/CSS/JS và nằm dưới `learning/hsk1/`. Pipeline kiểm tra dữ liệu và logic trước khi đóng gói game cùng website. Cache được phân vùng theo phạm vi service worker và phiên bản. Tùy chọn phát âm dùng giọng tiếng Quan thoại do trình duyệt cung cấp.

## Kiểm tra tại máy

- Kiểm thử Node xác minh dữ liệu, Pinyin, lịch ôn, chuyển đổi tiến độ, đủ 72 nhiệm vụ và đường dẫn tài nguyên.
- Kiểm thử Chromium ở kích thước iPhone 13 đi qua sáu chặng đầu, gồm trả lời đúng và sai, nhập Pinyin, ghép câu, hội thoại, đọc hiểu, ôn riêng Pinyin, tra từ, đóng và mở lại game, sao lưu và khôi phục JSON. Kiểm tra này dùng kích thước mô phỏng.
- Chromium ở kích thước iPhone 13 đã mở game qua đường dẫn con mô phỏng project site, tải lại khi mất mạng và cập nhật service worker trong khi giữ tiến độ. Cache của trang khác vẫn tồn tại sau cập nhật. Khi thiếu script, trang báo lỗi và cho phép tải lại.
- Bước đóng gói Pages tạo được thư mục tĩnh chứa trang chủ, chính sách bảo mật, `app-ads.txt` và game với cache đã gắn phiên bản.

Đã kiểm tra URL sản xuất trước khi bàn giao. Trang chủ trả HTTP 200 và URL game trả HTTP 404. Lần kiểm tra trên GitHub Pages sau khi triển khai cần diễn ra sau khi chủ repo push `dev_pages`.
