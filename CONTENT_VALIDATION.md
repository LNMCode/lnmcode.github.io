# Kiểm tra nội dung Hán Ngữ Phiêu Lưu

## Chuẩn đối chiếu

Game theo **đề cương thi HSK 3.0 cấp 1** do Trung tâm Hợp tác Giao lưu Ngôn ngữ Trung Quốc (CLEC) công bố tháng 11/2025. Danh sách gồm các mục từ số 1–300 ở trang in 77–83 (trang PDF 80–86). [Đề cương thi HSK 3.0](https://hsk.cn-bj.ufileos.com/3.0/%E6%96%B0%E7%89%88HSK%E8%80%83%E8%AF%95%E5%A4%A7%E7%BA%B21219.pdf#page=80)

Đề cương thi cũ quy định 150 từ cho cấp 1. Chuẩn năng lực tiếng Trung GF 0025–2021 có chỉ tiêu 500 từ cho cấp sơ đẳng bậc 1. Hai tài liệu này có mục đích và phạm vi riêng. [Đề cương thi cũ](https://www.chinesetest.cn/userfiles/file/HSKbyWord.pdf#page=6) · [Chuẩn GF 0025–2021 của Bộ Giáo dục Trung Quốc](https://hudong.moe.gov.cn/jyb_xwfb/moe_2082/siju/yywzxxgls/ztzl_yywzgfbz/202111/t20211118_580755.html)

## Kết quả

| Nội dung | Kết quả |
| --- | ---: |
| Mục từ khớp đề cương | 300/300 |
| Mục từ trùng, thiếu hoặc ngoài danh sách | 0 |
| Mục từ có Pinyin, nghĩa tiếng Việt và ví dụ chứa từ mục tiêu | 300/300 |
| Khu vực và phần đọc hiểu | 20 |
| Nhiệm vụ | 72 |
| Câu và cụm ví dụ | 317 |

- Đối chiếu chữ Hán và Pinyin cho từng mục. Cách đọc chính của 学生 được sửa thành **xuéshēng**, thống nhất ở các câu có 学生, 大学生, 小学生 và 中学生. Thêm **shuí** bên cạnh **shéi** cho 谁 và giữ thanh nhẹ của các mục như 名字 (**míngzi**), 什么 (**shénme**) và 谢谢 (**xièxie**).
- Giữ Pinyin mục từ theo đề cương. Trong câu dùng để luyện nói, Pinyin có thể ghi biến điệu của 一 và 不, như 一本书 (**yì běn shū**) và 不是 (**bú shì**). Những ghi chú học tập giải thích cách dùng này. [Quy tắc chính tả Pinyin GB/T 16159–2012](https://www.moe.gov.cn/ewebeditor/uploadfile/2015/01/13/20150113091717604.pdf)
- Bổ sung từ loại tiếng Việt theo các nghĩa thuộc cấp 1 trong bảng gốc. Sáu cụm để trống từ loại trong đề cương có nhãn mô tả cách dùng, như “lời chào” cho 你好. Các mẹo học chữ được trình bày dưới dạng liên tưởng hoặc mô tả mặt chữ.
- Sửa 20 liên kết câu ví dụ vốn chỉ chứa chữ mục tiêu bên trong một từ khác hoặc chưa tách từ. Đồng bộ nội dung hiển thị với bản ghi câu, chỉnh những nghĩa dễ nhầm và chọn lại câu đọc cho đúng ngữ cảnh các khu vực. Tên nhân vật 小语 có chú giải ngay trong dữ liệu và nằm ngoài bộ 300 từ.

## Kiểm tra lại

Chạy lệnh sau trong thư mục gốc của repo bằng Node.js.

```sh
node tests/hsk1/validate-content.cjs
```

Bản đối chiếu lưu chữ Hán và Pinyin theo thứ tự đề cương. Chương trình kiểm tra số lượng, mục trùng hoặc lệch chuẩn, thông tin bắt buộc, tách từ, câu ví dụ, ghi chú từ ngoài cấp và liên kết giữa từ gốc, khu vực, nhiệm vụ, bài đọc. [Dữ liệu đối chiếu](tests/hsk1/official-hsk1.txt)

Đề cương chỉ cung cấp chữ Hán, Pinyin và phân loại, còn nghĩa tiếng Việt và câu ví dụ đã được rà soát theo ngữ cảnh trong game. Phần này chưa có lượt thẩm định độc lập của giáo viên. Hai chương đầu giữ chủ đề chào hỏi và làm quen của bản ZIP. Tài liệu đính kèm chưa có PDF giáo trình NEW HSK 1 tiếng Việt để đối chiếu thứ tự và nội dung từng bài.
