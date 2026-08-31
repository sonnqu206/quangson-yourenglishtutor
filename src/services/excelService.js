/**
 * Quang Son - Your English Tutor
 * Excel / CSV Processing Service (xlsx / SheetJS integration)
 */

export const ExcelService = {
  /**
   * Đọc và parse dữ liệu từ file Excel (.xlsx, .xls, .csv)
   */
  async parseFile(file) {
    return new Promise((resolve, reject) => {
      // Ensure XLSX is available
      const XLSX = window.XLSX;
      if (!XLSX) {
        return reject(new Error("Thư viện SheetJS (XLSX) chưa được nạp."));
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Convert sheet to JSON array
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

          if (!rawRows || rawRows.length < 2) {
            return reject(new Error("File Excel không có dữ liệu hoặc thiếu tiêu đề cột."));
          }

          const headerRow = rawRows[0].map(h => String(h).trim().toLowerCase());
          
          // Map column indices intelligently
          let wordIdx = headerRow.findIndex(h => h.includes('word') || h.includes('từ') || h.includes('vocab'));
          let meaningIdx = headerRow.findIndex(h => h.includes('meaning') || h.includes('nghĩa') || h.includes('dịch'));
          let ipaIdx = headerRow.findIndex(h => h.includes('ipa') || h.includes('phiên âm') || h.includes('phát âm'));
          let exampleIdx = headerRow.findIndex(h => h.includes('example') || h.includes('ví dụ') || h.includes('câu'));
          let grammarIdx = headerRow.findIndex(h => h.includes('grammar') || h.includes('ngữ pháp') || h.includes('loại'));

          // Fallback if header not matched by keyword
          if (wordIdx === -1) wordIdx = 0;
          if (meaningIdx === -1 && rawRows[0].length > 1) meaningIdx = 1;
          if (ipaIdx === -1 && rawRows[0].length > 2) ipaIdx = 2;
          if (exampleIdx === -1 && rawRows[0].length > 3) exampleIdx = 3;

          const parsedItems = [];
          for (let i = 1; i < rawRows.length; i++) {
            const row = rawRows[i];
            const word = String(row[wordIdx] || "").trim();
            if (!word) continue;

            const meaning = String(row[meaningIdx] || "").trim();
            const ipa = ipaIdx !== -1 ? String(row[ipaIdx] || "").trim() : "";
            const example = exampleIdx !== -1 ? String(row[exampleIdx] || "").trim() : "";
            const grammarVal = grammarIdx !== -1 ? String(row[grammarIdx] || "").toLowerCase() : "";
            const is_grammar = grammarVal.includes('true') || grammarVal.includes('có') || grammarVal.includes('yes') || grammarVal.includes('grammar');

            parsedItems.push({
              id: i,
              word: word,
              meaning: meaning,
              ipa: ipa,
              example: example,
              is_grammar: is_grammar,
              status: meaning ? 'ready' : 'needs_ai'
            });
          }

          resolve(parsedItems);
        } catch (error) {
          reject(new Error("Lỗi khi đọc file Excel: " + error.message));
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Tải file Excel mẫu (.xlsx) chuẩn cấu trúc cho Giáo viên
   */
  downloadSampleTemplate() {
    const XLSX = window.XLSX;
    if (!XLSX) {
      alert("Thư viện XLSX đang được khởi tạo, vui lòng thử lại sau giây lát.");
      return;
    }

    const sampleData = [
      {
        "Word (Từ vựng)": "ubiquitous",
        "IPA (Phiên âm)": "/juːˈbɪk.wə.təs/",
        "Meaning (Nghĩa tiếng Việt)": "phổ biến, có mặt ở khắp mọi nơi",
        "Example (Ví dụ)": "Smartphones have become ubiquitous in modern life.",
        "Is_Grammar (Ngữ pháp)": "Không"
      },
      {
        "Word (Từ vựng)": "perseverance",
        "IPA (Phiên âm)": "/ˌpɜː.sɪˈvɪə.rəns/",
        "Meaning (Nghĩa tiếng Việt)": "sự kiên trì, bền chí vượt khó",
        "Example (Ví dụ)": "Success requires hard work and great perseverance.",
        "Is_Grammar (Ngữ pháp)": "Không"
      },
      {
        "Word (Từ vựng)": "breathtaking",
        "IPA (Phiên âm)": "/ˈbreθˌteɪ.kɪŋ/",
        "Meaning (Nghĩa tiếng Việt)": "đẹp ngoạn mục, đến nghẹt thở",
        "Example (Ví dụ)": "The mountain view at sunrise was breathtaking.",
        "Is_Grammar (Ngữ pháp)": "Không"
      },
      {
        "Word (Từ vựng)": "Used to + V (bare)",
        "IPA (Phiên âm)": "/juːst tuː/",
        "Meaning (Nghĩa tiếng Việt)": "Đã từng làm gì trong quá khứ (nay không còn)",
        "Example (Ví dụ)": "I used to live in the countryside when I was a child.",
        "Is_Grammar (Ngữ pháp)": "Có"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    // Set column widths
    worksheet['!cols'] = [
      { wch: 22 },
      { wch: 20 },
      { wch: 35 },
      { wch: 55 },
      { wch: 15 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mau_Tu_Vung_Quang_Son");
    XLSX.writeFile(workbook, "Quang_Son_Mau_Nhap_Tu_Vung.xlsx");
  },

  /**
   * Xuất danh sách từ vựng hiện tại ra file Excel
   */
  exportVocabulary(vocabList, filename = "Quang_Son_Danh_Sach_Tu_Vung.xlsx") {
    const XLSX = window.XLSX;
    if (!XLSX) return;

    const exportRows = vocabList.map((v, index) => ({
      "STT": index + 1,
      "Từ vựng / Cụm từ": v.word,
      "Phiên âm IPA": v.ipa || "",
      "Nghĩa tiếng Việt": v.meaning,
      "Câu ví dụ minh họa": v.example || "",
      "Loại": v.is_grammar ? "Cấu trúc Ngữ pháp" : "Từ vựng",
      "Ngày tạo": v.created_at ? new Date(v.created_at).toLocaleDateString('vi-VN') : ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 20 },
      { wch: 35 },
      { wch: 55 },
      { wch: 18 },
      { wch: 14 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kho_Tu_Vung");
    XLSX.writeFile(workbook, filename);
  },

  /**
   * Xuất báo cáo kết quả kiểm tra ra file Excel
   */
  exportTestResults(resultsList, filename = "Quang_Son_Ket_Qua_Kiem_Tra.xlsx") {
    const XLSX = window.XLSX;
    if (!XLSX) return;

    const exportRows = resultsList.map((r, idx) => ({
      "STT": idx + 1,
      "Mã phiên thi": `#TEST-${r.id}`,
      "Loại bài thi": r.session_type === 'lesson_based' ? 'Theo bài học' : 'Luyện tập tổng hợp',
      "Tổng số câu": r.total_questions,
      "Số câu đúng": r.correct_count,
      "Số câu sai": r.wrong_count,
      "Điểm số (%)": `${r.score_percentage}%`,
      "Thời gian (giây)": r.duration_seconds,
      "Thời điểm làm bài": new Date(r.created_at).toLocaleString('vi-VN')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ket_Qua_Kiem_Tra");
    XLSX.writeFile(workbook, filename);
  },

  /**
   * Xuất báo cáo chi tiết cá nhân của từng học sinh ra file Excel
   */
  exportStudentDetailedReport(student, sessions, className = "Lớp 9A") {
    const XLSX = window.XLSX;
    if (!XLSX) return;

    const exportRows = sessions.map((r, idx) => ({
      "STT": idx + 1,
      "Học sinh": student.full_name,
      "Tên đăng nhập": `@${student.username}`,
      "Lớp": className,
      "Mã bài thi": `#TEST-${r.id}`,
      "Loại bài thi": r.session_type === 'lesson_based' ? 'Theo Unit' : 'Ngẫu nhiên 3 dạng',
      "Tổng số câu": r.total_questions,
      "Số câu đúng": r.correct_count,
      "Số câu sai": r.wrong_count,
      "Điểm số (%)": `${r.score_percentage}%`,
      "Thời gian hoàn thành": `${r.duration_seconds}s`,
      "Thời điểm nộp bài": new Date(r.created_at).toLocaleString('vi-VN')
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 22 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Bao_Cao_${student.username}`);
    XLSX.writeFile(workbook, `Bao_Cao_Hoc_Tap_${student.username}.xlsx`);
  }
};
