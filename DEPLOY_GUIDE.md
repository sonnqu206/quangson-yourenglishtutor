# 🚀 Hướng Dẫn Deploy & Xuất Bản Trực Tuyến (Public URL)

Trang web **Quang Son - Your English Tutor** được thiết kế dưới dạng Single Page Application (SPA) chuẩn hiện đại, có thể xuất bản lên internet hoàn toàn **MIỄN PHÍ** thông qua **Vercel** hoặc **Netlify**.

---

## ⚡ Cách 1: Deploy Bằng Vercel CLI (Khuyên dùng - Nhanh nhất)

Hệ thống đã cài đặt sẵn **Vercel CLI v59.10.0** và tạo sẵn file cấu hình `vercel.json` cùng script `deploy_vercel.sh`.

### Các bước thực hiện:
1. Mở Terminal tại thư mục dự án và chạy:
   ```bash
   ./deploy_vercel.sh
   ```
   *(Hoặc gõ: `vercel`)*

2. **Nếu là lần đầu chạy:**
   - Vercel CLI sẽ hỏi bạn đăng nhập (chọn đăng nhập bằng GitHub hoặc Email).
   - Trình duyệt sẽ mở ra để bạn nhấn **Confirm**.
3. **Trả lời các câu hỏi cấu hình tự động (nhấn Enter để dùng mặc định):**
   - `Set up and deploy?` -> Chọn **Y**
   - `Which scope?` -> Chọn tài khoản cá nhân của bạn.
   - `Link to existing project?` -> Chọn **N**
   - `What's your project's name?` -> Nhấn **Enter** (hoặc đặt tên: `quang-son-english-tutor`)
   - `In which directory is your code located?` -> Nhấn **Enter** (`./`)
4. Sau 5-10 giây, Vercel sẽ cung cấp cho bạn đường link Public trực tuyến (Ví dụ: `https://quang-son-english-tutor.vercel.app`).
5. Học sinh và giáo viên phụ ở bất kỳ đâu chỉ cần click vào link là có thể học và làm bài kiểm tra ngay lập tức!

---

## 🌐 Cách 2: Deploy Bằng Netlify CLI / Netlify Drop (Không cần cài đặt gì thêm)

### Lựa chọn A: Dùng Netlify CLI
Chạy lệnh trong Terminal:
```bash
./deploy_netlify.sh
```
Làm theo hướng dẫn trên màn hình để xác thực và nhận đường link `https://quang-son-english-tutor.netlify.app`.

### Lựa chọn B: Kéo thả trực tiếp (Netlify Drop)
1. Truy cập: [https://app.netlify.com/drop](https://app.netlify.com/drop)
2. Kéo toàn bộ thư mục `stitch_lingolms_pro` thả vào trang web Netlify Drop.
3. Sau 3 giây, Netlify sẽ cấp ngay một đường link công khai trực tuyến miễn phí trọn đời!

---

## 🔒 Lưu Ý Về Biến Môi Trường & Bảo Mật

- File `.env.local` của bạn đã được cấu hình Supabase URL & Anon Key và Gemini API Key.
- Vì toàn bộ mã chạy phía client (Front-end SPA), các cấu hình cần thiết để kết nối cơ sở dữ liệu đã được tự động đóng gói an toàn theo chuẩn kiến trúc Supabase RLS.
