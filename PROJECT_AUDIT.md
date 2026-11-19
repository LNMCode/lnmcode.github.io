# Khảo sát Hán Ngữ Phiêu Lưu

## Cập nhật hành trình đèn lồng

Mỗi chặng lưu vị trí của các từ trên bản đồ. Sau khi đã ghé đủ chỗ, người chơi tìm lại các vị trí theo gợi ý chữ Hán hoặc nghĩa tiếng Việt. Lời nhắn ghép ở cuối chặng mở lối đi và tiếp tục câu chuyện. Hai vùng mở đầu có lời dẫn riêng cho từng chặng.

Kiểm thử tự động đi qua cả 72 chặng và thu đủ 300 từ. Kiểm thử Chromium ở kích thước iPhone 13 hoàn thành sáu chặng đầu, gồm chọn nhầm đèn, xem gợi ý, tiếp tục sau khi đóng trang, thử lại câu mở lối, ôn Pinyin, sao lưu và học ngoại tuyến. Một lần nâng cấp mô phỏng từ bản `e216a92` cũng giữ được chặng cũ đang chơi và tải được cả ba cảnh khi ngắt mạng.

Ba cảnh nền WebP do ImageGen tạo và được lưu cùng game để dùng ngoại tuyến. [Sân trường](learning/hsk1/art/school.webp) · [Phố đèn](learning/hsk1/art/market.webp) · [Bờ sông](learning/hsk1/art/river.webp)

<details>
<summary>Prompt tạo cảnh nền</summary>

Original background art for a Vietnamese mobile language-learning adventure, stylized-concept game environment illustration, wide landscape 3:2. Hand-painted 2D painterly game art with confident simplified silhouettes, velvet midnight sky, deep navy and pine green, warm amber paper lanterns, muted teal haze. Beautiful but legible at small sizes. Frame a few distinctive environmental landmarks around a broad dim clear walking surface through the middle and lower half, where several HTML game hotspots will be overlaid. Tangible location with foreground, midground, and background depth. Three-quarter slightly elevated view, quietly magical and inviting. Entire frame is the environment, no characters, typography, text, lettering, symbols, logo, borders, interface, or watermark.

- A Chinese school and courtyard after dusk. An open timber school gate with two little lanterns on the left, softly lit classroom windows beyond, stone benches, a large ginkgo and a covered walkway to the right. A few leaves catch blue moonlight.
- A compact lantern market in a Chinese old town at night. A small rounded amber awning behind a tea stand to the left, old wooden storefronts around the back, red-orange paper lanterns overhead, baskets and an empty cobblestone lane. Pools of warm light amid rich midnight shade.
- A riverside Chinese village under a night sky. Calm ink-blue canal to the back, a low arched wooden bridge, a distant softly glowing pavilion, willows on the left, a stone walking trail and a small pier. Lanterns and crescent moon reflect on the water.

</details>

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
