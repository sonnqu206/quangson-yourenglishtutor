/**
 * Quang Son - Your English Tutor
 * Master Application Controller & UI Logic
 * (Authentication • Cookies Session • Strict Student Role • User Provisioning • 3 Quiz Formats • AI Tutor)
 */

import { CONFIG } from './config.js';
import { AuthService } from './services/authService.js';
import { SupabaseService } from './services/supabaseService.js';
import { GeminiService } from './services/geminiService.js';
import { ExcelService } from './services/excelService.js';
import { audioService } from './services/audioService.js';

// Application State
export const state = {
  currentUser: null, // { id, username, full_name, role: 'host' | 'assistant_teacher' | 'student', class_id, email }
  currentRole: 'host', // 'host' | 'assistant_teacher' | 'student'
  currentTab: 'login', // 'login' | 'dashboard' | 'classes' | 'accounts' | 'lessons' | 'vocabulary' | 'table_input' | 'flashcards' | 'quiz' | 'quiz_result' | 'reports' | 'tutor' | 'settings'
  
  classes: [],
  lessons: [],
  vocabulary: [],
  profiles: [],
  usersList: [],
  testSessions: [],
  
  // Active Class Scoping (Class-Isolation)
  selectedClassId: 1,
  selectedLessonId: null,
  searchQuery: '',
  filterGrammar: 'all',
  
  // Batch Vocabulary Input Table Rows
  batchTableRows: [
    { id: 1, word: "", meaning: "" },
    { id: 2, word: "", meaning: "" },
    { id: 3, word: "", meaning: "" },
    { id: 4, word: "", meaning: "" },
    { id: 5, word: "", meaning: "" }
  ],
  isSavingBatchTable: false,
  batchSaveProgressText: "",

  // Flashcard state
  flashcardIndex: 0,
  flashcardFlipped: false,
  knownWords: new Set(),
  studyList: [],
  
  // Quiz state (3 Formats: type_en, type_vi, multiple_choice)
  currentQuiz: [],
  quizIndex: 0,
  quizTimer: 0,
  quizTimerInterval: null,
  lastQuizResult: null,
  pendingTargetTab: null,

  // Tutor Chat state
  isTutorTyping: false,
  chatMessages: [
    {
      sender: 'bot',
      text: 'Chào em! Thầy là trợ lý học tập AI của Thầy Quang Sơn. Em có thắc mắc gì về từ vựng, ngữ pháp hay các dạng bài thi tiếng Anh vào lớp 10 không? Hãy nhắn cho thầy nhé!'
    }
  ]
};

// Toast Notification Utility
export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-primary text-on-primary' : type === 'error' ? 'bg-error text-on-error' : 'bg-secondary-container text-on-secondary-container';
  const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';

  toast.className = `flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg ${bgClass} font-label-md transition-all duration-300 transform translate-y-2 opacity-0 z-50`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-xl">${icon}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 3500);
  }, 3500);
}

function cleanString(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .replace(/\s+/g, " ");
}

function formatMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-surface-container font-mono text-xs text-primary">$1</code>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

// Global App Object
window.App = {
  state,
  AuthService,
  audioService,
  ExcelService,
  GeminiService,
  SupabaseService,

  /**
   * Khởi động ứng dụng & kiểm tra phiên đăng nhập từ Cookies
   */
  async init() {
    console.log("Khởi động hệ thống Quang Son - Your English Tutor...");
    
    // 1. Check existing cookie / localStorage session
    const activeUser = AuthService.getCurrentUser();
    if (activeUser) {
      state.currentUser = activeUser;
      state.currentRole = activeUser.role;
      state.selectedClassId = activeUser.class_id || 1;
      state.currentTab = 'dashboard';
    } else {
      state.currentUser = null;
      state.currentTab = 'login';
    }

    await this.loadAllData();
    this.render();
    this.bindGlobalEvents();
  },

  /**
   * Nạp toàn bộ dữ liệu từ Supabase & AuthService
   */
  async loadAllData() {
    try {
      const [classes, lessons, vocabulary, testSessions, users] = await Promise.all([
        SupabaseService.getClasses(),
        SupabaseService.getLessons(),
        SupabaseService.getVocabulary(),
        SupabaseService.getTestSessions(),
        AuthService.syncUsersFromSupabase()
      ]);

      state.classes = classes || [];
      state.lessons = lessons || [];
      state.vocabulary = vocabulary || [];
      state.testSessions = testSessions || [];
      state.usersList = users || AuthService.getAllUsers();

      // For students, lock selectedClassId strictly to their assigned class
      if (state.currentUser && state.currentUser.role === 'student') {
        state.selectedClassId = Number(state.currentUser.class_id) || 1;
      } else if (!state.selectedClassId && state.classes.length > 0) {
        state.selectedClassId = state.classes[0].id;
      }

      const currentClassLessons = state.lessons.filter(l => l.class_id === Number(state.selectedClassId));
      if (currentClassLessons.length > 0) {
        state.selectedLessonId = currentClassLessons[0].id;
      } else {
        state.selectedLessonId = null;
      }

      this.updateStudyList();
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu:", err);
      showToast("Đang dùng dữ liệu cục bộ.", "info");
    }
  },

  /**
   * Cập nhật danh sách từ vựng ôn tập
   */
  updateStudyList() {
    const classVocab = state.vocabulary.filter(v => v.class_id === Number(state.selectedClassId));
    if (state.selectedLessonId) {
      const lessonVocab = classVocab.filter(v => v.lesson_id === Number(state.selectedLessonId));
      state.studyList = lessonVocab.length > 0 ? lessonVocab : classVocab;
    } else {
      state.studyList = classVocab;
    }
  },

  // =========================================================================
  // AUTHENTICATION & SESSION HANDLING (COOKIES)
  // =========================================================================

  async handleLogin(e) {
    if (e) e.preventDefault();
    const usernameInput = document.getElementById('login-username')?.value.trim();
    const passwordInput = document.getElementById('login-password')?.value.trim();
    const rememberMe = document.getElementById('login-remember')?.checked ?? true;

    if (!usernameInput || !passwordInput) {
      showToast("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!", "error");
      return;
    }

    try {
      const user = await AuthService.login(usernameInput, passwordInput, rememberMe);
      state.currentUser = user;
      state.currentRole = user.role;
      state.selectedClassId = user.class_id || 1;
      state.currentTab = 'dashboard';

      showToast(`Đăng nhập thành công! Chào mừng ${user.full_name} 🎉`, "success");
      await this.loadAllData();
      this.render();
    } catch (err) {
      showToast(err.message, "error");
    }
  },

  fillQuickLogin(username, password) {
    const uInput = document.getElementById('login-username');
    const pInput = document.getElementById('login-password');
    if (uInput) uInput.value = username;
    if (pInput) pInput.value = password;
  },

  togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) icon.textContent = 'visibility';
    } else {
      input.type = 'password';
      if (icon) icon.textContent = 'visibility_off';
    }
  },

  handleLogout() {
    if (!confirm("Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?")) return;
    AuthService.logout();
    state.currentUser = null;
    state.currentTab = 'login';
    showToast("Đã đăng xuất thành công!", "info");
    this.render();
  },

  // =========================================================================
  // HỌC SINH / GIÁO VIÊN TỰ ĐỔI MẬT KHẨU CỦA BẢN THÂN
  // =========================================================================

  openChangeMyPasswordModal() {
    const modal = document.getElementById('change-my-password-modal');
    if (modal) {
      const curInput = document.getElementById('input-my-current-password');
      const newInput = document.getElementById('input-my-new-password');
      const confirmInput = document.getElementById('input-my-confirm-password');
      if (curInput) curInput.value = "";
      if (newInput) newInput.value = "";
      if (confirmInput) confirmInput.value = "";
      modal.classList.remove('hidden');
    }
  },

  async handleChangeMyPassword(e) {
    if (e) e.preventDefault();
    const curPass = document.getElementById('input-my-current-password')?.value;
    const newPass = document.getElementById('input-my-new-password')?.value;
    const confirmPass = document.getElementById('input-my-confirm-password')?.value;

    if (!curPass || !newPass || !confirmPass) {
      showToast("Vui lòng nhập đầy đủ các trường mật khẩu!", "error");
      return;
    }

    if (newPass !== confirmPass) {
      showToast("Mật khẩu mới và xác nhận mật khẩu không khớp!", "error");
      return;
    }

    if (newPass.length < 4) {
      showToast("Mật khẩu mới phải có ít nhất 4 ký tự!", "error");
      return;
    }

    try {
      await AuthService.changeMyPassword(state.currentUser.id, curPass, newPass);
      showToast("Đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới nhé.", "success");
      this.closeModal('change-my-password-modal');
    } catch (err) {
      showToast(err.message, "error");
    }
  },

  // =========================================================================
  // USER PROVISIONING & ACCOUNT MANAGEMENT (HOST / TEACHER)
  // =========================================================================

  openCreateUserModal() {
    const modal = document.getElementById('create-user-modal');
    if (modal) {
      const classSelect = document.getElementById('modal-user-class');
      if (classSelect) {
        classSelect.innerHTML = state.classes.map(c => 
          `<option value="${c.id}" ${state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>`
        ).join('');
      }
      modal.classList.remove('hidden');
    }
  },

  async handleCreateUser(e) {
    if (e) e.preventDefault();
    const fullName = document.getElementById('input-user-fullname')?.value.trim();
    const username = document.getElementById('input-user-username')?.value.trim();
    const password = document.getElementById('input-user-password')?.value.trim();
    const role = document.getElementById('input-user-role')?.value || 'student';
    const classId = document.getElementById('modal-user-class')?.value || 1;

    if (!fullName || !username || !password) {
      showToast("Vui lòng điền đầy đủ các thông tin bắt buộc!", "error");
      return;
    }

    try {
      const created = await AuthService.createUser({
        full_name: fullName,
        username: username,
        password: password,
        role: role,
        class_id: classId
      });

      showToast(`Đã cấp tài khoản thành công cho "${created.full_name}" [${created.username}]!`, "success");
      this.closeModal('create-user-modal');
      await this.loadAllData();
      this.render();
    } catch (err) {
      showToast("Lỗi khi cấp tài khoản: " + err.message, "error");
    }
  },

  async handleDeleteUser(userId, name) {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản "${name}"?`)) return;
    try {
      await AuthService.deleteUser(userId);
      showToast(`Đã xóa tài khoản "${name}" thành công!`, "success");
      await this.loadAllData();
      this.render();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async handleChangePassword(userId, name) {
    const newPass = prompt(`Nhập mật khẩu mới cho tài khoản "${name}":`);
    if (!newPass) return;
    try {
      await AuthService.changePassword(userId, newPass);
      showToast(`Đã đổi mật khẩu cho "${name}" thành công!`, "success");
      await this.loadAllData();
      this.render();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  // =========================================================================
  // BÁO CÁO TIẾN ĐỘ TỪNG HỌC SINH (INDIVIDUAL STUDENT REPORTS)
  // =========================================================================

  selectReportStudent(studentId) {
    state.selectedReportStudentId = studentId ? String(studentId) : null;
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  openSessionDetailsModal(sessionId) {
    const session = state.testSessions.find(s => s.id === Number(sessionId));
    if (!session) {
      showToast("Không tìm thấy thông tin chi tiết bài thi!", "error");
      return;
    }

    const modal = document.getElementById('session-details-modal');
    const container = document.getElementById('session-details-content');
    if (modal && container) {
      const details = session.details || [];
      const student = state.usersList.find(u => u.id === session.user_id) || { full_name: "Học sinh" };

      container.innerHTML = `
        <div class="mb-4 pb-3 border-b border-outline-variant/30 flex items-center justify-between">
          <div>
            <h4 class="font-bold text-sm text-on-surface">Phiên thi #${session.id} - ${student.full_name}</h4>
            <p class="text-[11px] text-outline">${new Date(session.created_at).toLocaleString('vi-VN')} • Thời lượng: ${session.duration_seconds}s</p>
          </div>
          <div class="text-right">
            <span class="text-xs font-bold px-3 py-1 rounded-full ${session.score_percentage >= 80 ? 'bg-green-100 text-green-900 border border-green-300' : 'bg-primary-container/20 text-primary'}">
              Điểm: ${session.score_percentage}% (${session.correct_count}/${session.total_questions} đúng)
            </span>
          </div>
        </div>

        <div class="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          ${details.length > 0 ? details.map((d, idx) => `
            <div class="p-3.5 rounded-xl border ${d.is_correct ? 'border-green-300 bg-green-50/50' : 'border-error/30 bg-red-50/50'} text-xs">
              <div class="flex items-center justify-between mb-1.5">
                <span class="font-bold ${d.is_correct ? 'text-green-800' : 'text-error'} flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-base">${d.is_correct ? 'check_circle' : 'cancel'}</span>
                  ${d.is_correct ? 'CHÍNH XÁC' : 'CHƯA CHÍNH XÁC'}
                </span>
                <span class="text-[10px] text-outline font-bold bg-white px-2 py-0.5 rounded border border-outline-variant/20">Câu ${idx + 1}</span>
              </div>
              <p class="font-bold text-sm text-on-surface mb-2">${d.question}</p>
              <div class="space-y-1 text-xs">
                <p><span class="font-semibold text-outline">Học sinh đã trả lời:</span> <strong class="${d.is_correct ? 'text-green-700 font-bold' : 'text-error font-bold'}">${d.user_answer || '(Bỏ trống)'}</strong></p>
                ${!d.is_correct ? `<p><span class="font-semibold text-outline">Đáp án chuẩn:</span> <strong class="text-green-800 font-bold">${d.correct_answer}</strong></p>` : ''}
                ${d.explanation ? `<p class="italic text-on-surface bg-white/80 p-2.5 rounded-lg border border-outline-variant/20 mt-1.5">💡 <strong>Giải thích chi tiết:</strong> ${d.explanation}</p>` : ''}
              </div>
            </div>
          `).join('') : `
            <div class="text-center py-8 text-outline text-xs">
              <span class="material-symbols-outlined text-3xl mb-1">quiz</span>
              <p>Phiên thi này không lưu chi tiết từng câu hỏi.</p>
            </div>
          `}
        </div>
      `;

      modal.classList.remove('hidden');
    }
  },

  exportCurrentStudentExcel(studentId) {
    const student = state.usersList.find(u => u.id === studentId);
    if (!student) return;
    const studentSessions = state.testSessions.filter(s => s.user_id === student.id || (student.username === 'an_nguyen' && s.user_id === '00000000-0000-0000-0000-000000000002'));
    const activeClass = state.classes.find(c => c.id === student.class_id) || { name: "Lớp 9A" };
    ExcelService.exportStudentDetailedReport(student, studentSessions, activeClass.name);
    showToast(`Đã xuất file Excel báo cáo học tập cho học sinh "${student.full_name}"!`, "success");
  },

  // =========================================================================
  // SAFE NAVIGATION & CLASS LOGIC (ROLE RESTRICTION)
  // =========================================================================

  safeGoBack(targetTab = 'vocabulary') {
    if (state.currentTab === 'quiz' && state.currentQuiz && state.currentQuiz.length > 0) {
      state.pendingTargetTab = targetTab;
      const modal = document.getElementById('exit-quiz-modal');
      if (modal) {
        modal.classList.remove('hidden');
        return;
      }
    }
    this.switchTab(targetTab);
  },

  confirmExitQuiz() {
    if (state.quizTimerInterval) clearInterval(state.quizTimerInterval);
    state.currentQuiz = [];
    state.quizIndex = 0;
    this.closeModal('exit-quiz-modal');
    const target = state.pendingTargetTab || 'vocabulary';
    state.pendingTargetTab = null;
    this.switchTab(target);
    showToast("Đã quay về danh sách từ vựng / bài học của Lớp!", "info");
  },

  selectClass(classId) {
    // If user is a student, forbid switching classes
    if (state.currentUser?.role === 'student') {
      showToast("Học sinh chỉ được phép truy cập lớp học được phân công của mình!", "error");
      return;
    }

    state.selectedClassId = Number(classId);
    const classLessons = state.lessons.filter(l => l.class_id === state.selectedClassId);
    state.selectedLessonId = classLessons.length > 0 ? classLessons[0].id : null;
    this.updateStudyList();
    
    const activeClass = state.classes.find(c => c.id === state.selectedClassId);
    showToast(`Đã chuyển sang ${activeClass ? activeClass.name : 'Lớp học'}!`, 'info');
    this.render();
  },

  switchTab(tabName, payload = null) {
    // If not logged in, force login screen
    if (!state.currentUser && tabName !== 'login') {
      state.currentTab = 'login';
      this.render();
      return;
    }

    // Role-based restrictions: Students cannot access management tabs
    if (state.currentUser?.role === 'student') {
      const restrictedTabs = ['classes', 'accounts', 'lessons', 'table_input'];
      if (restrictedTabs.includes(tabName)) {
        showToast("Học sinh chỉ được phép truy cập vào các phần liên quan đến học tập của lớp mình!", "error");
        state.currentTab = 'dashboard';
        this.render();
        return;
      }
    }

    state.currentTab = tabName;
    if (tabName === 'flashcards') {
      state.flashcardIndex = 0;
      state.flashcardFlipped = false;
      this.updateStudyList();
    } else if (tabName === 'quiz' && payload?.startNew) {
      this.startNewQuiz(payload.lessonId, payload.isRandom);
    }
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  speakWord(text) {
    audioService.speak(text, { rate: 0.88 });
  },

  // =========================================================================
  // GIAO DIỆN THÊM TỪ VỰNG DẠNG BẢNG (TEACHER / HOST ONLY)
  // =========================================================================

  openBatchTableModal() {
    if (state.currentUser?.role === 'student') {
      showToast("Học sinh không có quyền truy cập tính năng thêm từ vựng!", "error");
      return;
    }
    this.switchTab('table_input');
  },

  addBatchTableRow() {
    const nextId = state.batchTableRows.length ? Math.max(...state.batchTableRows.map(r => r.id)) + 1 : 1;
    state.batchTableRows.push({ id: nextId, word: "", meaning: "" });
    this.render();
  },

  addBatchTable5Rows() {
    let nextId = state.batchTableRows.length ? Math.max(...state.batchTableRows.map(r => r.id)) + 1 : 1;
    for (let i = 0; i < 5; i++) {
      state.batchTableRows.push({ id: nextId++, word: "", meaning: "" });
    }
    this.render();
  },

  removeBatchTableRow(id) {
    if (state.batchTableRows.length <= 1) {
      state.batchTableRows[0] = { id: 1, word: "", meaning: "" };
    } else {
      state.batchTableRows = state.batchTableRows.filter(r => r.id !== id);
    }
    this.render();
  },

  updateBatchTableCell(id, field, value) {
    const row = state.batchTableRows.find(r => r.id === id);
    if (row) {
      row[field] = value;
    }
  },

  async pasteClipboardToTable() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showToast("Clipboard đang trống!", "error");
        return;
      }

      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      const parsedRows = [];

      lines.forEach((line, index) => {
        let word = "";
        let meaning = "";

        if (line.includes("\t")) {
          const parts = line.split("\t");
          word = parts[0]?.trim() || "";
          meaning = parts[1]?.trim() || "";
        } else if (line.includes(" - ")) {
          const parts = line.split(" - ");
          word = parts[0]?.trim() || "";
          meaning = parts[1]?.trim() || "";
        } else if (line.includes(":")) {
          const parts = line.split(":");
          word = parts[0]?.trim() || "";
          meaning = parts.slice(1).join(":").trim() || "";
        } else {
          word = line.trim();
        }

        if (word) {
          parsedRows.push({
            id: index + 1,
            word: word,
            meaning: meaning
          });
        }
      });

      if (parsedRows.length > 0) {
        state.batchTableRows = parsedRows;
        showToast(`Đã dán thành công ${parsedRows.length} dòng từ Clipboard!`, "success");
        this.render();
      } else {
        showToast("Không tìm thấy dữ liệu từ vựng hợp lệ trong Clipboard.", "error");
      }
    } catch (err) {
      showToast("Không thể đọc Clipboard. Vui lòng cho phép quyền truy cập!", "error");
    }
  },

  async saveBatchTableToSupabase() {
    const classId = Number(document.getElementById('table-input-class')?.value) || state.selectedClassId || 1;
    const lessonId = Number(document.getElementById('table-input-lesson')?.value) || state.selectedLessonId || 1;

    const validRows = state.batchTableRows.filter(r => r.word && r.word.trim() !== "");
    if (validRows.length === 0) {
      showToast("Vui lòng nhập ít nhất 1 từ vựng trong bảng!", "error");
      return;
    }

    state.isSavingBatchTable = true;
    state.batchSaveProgressText = `✨ Gemini AI đang tạo phiên âm IPA chuẩn & câu ví dụ cho ${validRows.length} từ...`;
    this.render();

    try {
      const enrichedRows = await GeminiService.enrichTableVocabularyBatch(validRows, (msg) => {
        state.batchSaveProgressText = msg;
        this.render();
      });

      state.batchSaveProgressText = `Đang lưu ${enrichedRows.length} từ vựng vào Supabase...`;
      this.render();

      const inserted = await SupabaseService.bulkInsertVocabulary(enrichedRows, classId, lessonId);

      showToast(`Đã lưu thành công ${inserted.length} từ vựng mới vào Lớp học! 🎉`, "success");
      
      state.batchTableRows = [
        { id: 1, word: "", meaning: "" },
        { id: 2, word: "", meaning: "" },
        { id: 3, word: "", meaning: "" },
        { id: 4, word: "", meaning: "" },
        { id: 5, word: "", meaning: "" }
      ];

      await this.loadAllData();
      this.switchTab('vocabulary');
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi lưu bảng từ vựng: " + err.message, "error");
    } finally {
      state.isSavingBatchTable = false;
      state.batchSaveProgressText = "";
      this.render();
    }
  },

  // =========================================================================
  // CLASS & LESSON MODALS
  // =========================================================================

  openCreateClassModal() {
    if (state.currentUser?.role === 'student') return;
    const modal = document.getElementById('create-class-modal');
    if (modal) modal.classList.remove('hidden');
  },

  async handleCreateClass(e) {
    e.preventDefault();
    if (state.currentUser?.role === 'student') return;
    const name = document.getElementById('input-class-name')?.value.trim();
    const code = document.getElementById('input-class-code')?.value.trim();
    if (!name) {
      showToast("Vui lòng nhập tên lớp học!", "error");
      return;
    }
    try {
      const created = await SupabaseService.createClass(name, code);
      showToast(`Đã tạo lớp "${name}" với mã [${created.class_code}]!`, "success");
      this.closeModal('create-class-modal');
      await this.loadAllData();
      state.selectedClassId = created.id;
      this.render();
    } catch (err) {
      showToast("Lỗi khi tạo lớp: " + err.message, "error");
    }
  },

  async deleteClass(id) {
    if (state.currentUser?.role === 'student') return;
    if (!confirm("Bạn có chắc chắn muốn xóa lớp học này? Toàn bộ bài học và từ vựng trong lớp sẽ bị xóa.")) return;
    try {
      await SupabaseService.deleteClass(id);
      showToast("Đã xóa lớp học thành công!", "success");
      await this.loadAllData();
      this.render();
    } catch (e) {
      showToast("Lỗi khi xóa lớp: " + e.message, "error");
    }
  },

  openCreateLessonModal() {
    if (state.currentUser?.role === 'student') return;
    const modal = document.getElementById('create-lesson-modal');
    if (modal) {
      const classSelect = document.getElementById('modal-lesson-class');
      if (classSelect) {
        classSelect.innerHTML = state.classes.map(c => 
          `<option value="${c.id}" ${state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>`
        ).join('');
      }
      modal.classList.remove('hidden');
    }
  },

  async handleCreateLesson(e) {
    e.preventDefault();
    if (state.currentUser?.role === 'student') return;
    const classId = document.getElementById('modal-lesson-class')?.value || state.selectedClassId || 1;
    const title = document.getElementById('input-lesson-title')?.value.trim();
    if (!title) {
      showToast("Vui lòng nhập tên bài học!", "error");
      return;
    }
    try {
      await SupabaseService.createLesson(classId, title);
      showToast(`Đã tạo bài học "${title}" thành công!`, "success");
      this.closeModal('create-lesson-modal');
      await this.loadAllData();
      this.render();
    } catch (err) {
      showToast("Lỗi khi tạo bài học: " + err.message, "error");
    }
  },

  async deleteLesson(id) {
    if (state.currentUser?.role === 'student') return;
    if (!confirm("Bạn có chắc chắn muốn xóa bài học này?")) return;
    try {
      await SupabaseService.deleteLesson(id);
      showToast("Đã xóa bài học thành công!", "success");
      await this.loadAllData();
      this.render();
    } catch (e) {
      showToast("Lỗi khi xóa bài học: " + e.message, "error");
    }
  },

  async deleteVocabulary(id, word) {
    if (state.currentUser?.role === 'student') return;
    if (!confirm(`Bạn có chắc chắn muốn xóa từ "${word}" khỏi lớp học này?`)) return;
    try {
      await SupabaseService.deleteVocabulary(id);
      showToast(`Đã xóa từ "${word}" thành công!`, "success");
      await this.loadAllData();
      this.render();
    } catch (e) {
      showToast("Lỗi khi xóa từ: " + e.message, "error");
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  },

  // =========================================================================
  // FLASHCARD 3D LOGIC
  // =========================================================================

  flipFlashcard() {
    state.flashcardFlipped = !state.flashcardFlipped;
    const cardEl = document.getElementById('main-flashcard');
    if (cardEl) {
      if (state.flashcardFlipped) {
        cardEl.classList.add('is-flipped');
      } else {
        cardEl.classList.remove('is-flipped');
      }
    }
  },

  nextFlashcard(isKnown = false) {
    if (state.studyList.length === 0) return;
    const currentWord = state.studyList[state.flashcardIndex];
    if (isKnown && currentWord) {
      state.knownWords.add(currentWord.id);
    }

    state.flashcardFlipped = false;
    const cardEl = document.getElementById('main-flashcard');
    if (cardEl) cardEl.classList.remove('is-flipped');

    if (state.flashcardIndex < state.studyList.length - 1) {
      state.flashcardIndex += 1;
    } else {
      showToast(`Chúc mừng em đã hoàn thành toàn bộ ${state.studyList.length} thẻ từ vựng của lớp! 🎉`, "success");
      state.flashcardIndex = 0;
    }
    this.render();
  },

  prevFlashcard() {
    if (state.flashcardIndex > 0) {
      state.flashcardFlipped = false;
      state.flashcardIndex -= 1;
      this.render();
    }
  },

  // =========================================================================
  // QUIZ ENGINE (3 FORMATS & REAL-TIME CHECK)
  // =========================================================================

  async startNewQuiz(lessonId = null, isRandom = false) {
    const classVocab = state.vocabulary.filter(v => v.class_id === Number(state.selectedClassId));
    
    if (classVocab.length === 0) {
      showToast("Lớp học này chưa có từ vựng để tạo bài thi!", "error");
      return;
    }

    let targetVocab = classVocab;
    if (lessonId && !isRandom) {
      targetVocab = classVocab.filter(v => v.lesson_id === Number(lessonId));
      if (targetVocab.length === 0) targetVocab = classVocab;
    }

    const testTypeLabel = isRandom ? "Ngẫu Nhiên Toàn Lớp" : (lessonId ? `Bài học Unit #${lessonId}` : "Tổng Hợp Lớp");
    showToast(`Đang tạo bài kiểm tra ${testTypeLabel} (3 dạng bài)...`, "info");
    
    const questions = await GeminiService.generateMultiFormatQuiz(targetVocab, Math.min(targetVocab.length, 10));
    
    state.currentQuiz = questions.map(q => ({
      ...q,
      user_answer: "",
      is_checked: false,
      is_correct: false
    }));

    state.quizIndex = 0;
    state.quizTimer = 0;
    
    if (state.quizTimerInterval) clearInterval(state.quizTimerInterval);
    state.quizTimerInterval = setInterval(() => {
      state.quizTimer += 1;
      const timerEl = document.getElementById('quiz-timer-display');
      if (timerEl) {
        const mins = Math.floor(state.quizTimer / 60).toString().padStart(2, '0');
        const secs = (state.quizTimer % 60).toString().padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
      }
    }, 1000);

    this.switchTab('quiz');
  },

  updateQuizTextInput(value) {
    const currentQ = state.currentQuiz[state.quizIndex];
    if (currentQ && !currentQ.is_checked) {
      currentQ.user_answer = value;
    }
  },

  selectQuizOption(optionIdx) {
    const currentQ = state.currentQuiz[state.quizIndex];
    if (!currentQ || currentQ.is_checked) return;

    currentQ.user_answer = optionIdx;
    this.checkCurrentQuestion();
  },

  checkCurrentQuestion() {
    const currentQ = state.currentQuiz[state.quizIndex];
    if (!currentQ || currentQ.is_checked) return;

    let isCorrect = false;

    if (currentQ.type === 'type_en') {
      const userText = cleanString(currentQ.user_answer);
      const expectedText = cleanString(currentQ.word);
      isCorrect = userText.length > 0 && userText === expectedText;
    } else if (currentQ.type === 'type_vi') {
      const userText = cleanString(currentQ.user_answer);
      const expectedText = cleanString(currentQ.meaning);
      isCorrect = userText.length > 0 && (
        userText === expectedText || 
        expectedText.includes(userText) || 
        userText.includes(expectedText) ||
        userText.split(" ").filter(w => expectedText.includes(w)).length >= Math.max(1, Math.floor(expectedText.split(" ").length * 0.5))
      );
    } else {
      isCorrect = currentQ.user_answer !== "" && Number(currentQ.user_answer) === Number(currentQ.correct_index);
    }

    currentQ.is_checked = true;
    currentQ.is_correct = isCorrect;

    if (currentQ.word) {
      audioService.speak(currentQ.word);
    }

    this.render();

    setTimeout(() => {
      document.getElementById('quiz-next-btn')?.focus();
    }, 100);
  },

  nextQuizQuestion() {
    if (state.quizIndex < state.currentQuiz.length - 1) {
      state.quizIndex += 1;
      this.render();
      setTimeout(() => {
        document.getElementById('quiz-text-input')?.focus();
      }, 100);
    } else {
      this.submitQuiz();
    }
  },

  prevQuizQuestion() {
    if (state.quizIndex > 0) {
      state.quizIndex -= 1;
      this.render();
    }
  },

  async submitQuiz() {
    if (state.quizTimerInterval) clearInterval(state.quizTimerInterval);

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const details = [];

    state.currentQuiz.forEach((q) => {
      if (!q.is_checked) {
        skipped += 1;
      } else if (q.is_correct) {
        correct += 1;
      } else {
        wrong += 1;
      }

      let userAnsDisplay = q.user_answer;
      if (q.type === 'multiple_choice') {
        userAnsDisplay = q.user_answer !== "" && q.options[q.user_answer] ? q.options[q.user_answer] : "Chưa chọn";
      }

      details.push({
        word_id: q.word_id || q.id,
        user_answer: userAnsDisplay || "Bỏ trống",
        correct_answer: q.correct_answer || q.word,
        is_correct: Boolean(q.is_correct),
        is_skipped: !q.is_checked,
        question: q.question,
        explanation: q.explanation
      });
    });

    const total = state.currentQuiz.length;
    const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;

    const sessionRecord = {
      user_id: state.currentUser?.id || "00000000-0000-0000-0000-000000000002",
      class_id: state.selectedClassId || 1,
      session_type: 'multi_format',
      total_questions: total,
      correct_count: correct,
      wrong_count: wrong,
      skipped_count: skipped,
      score_percentage: scorePct,
      duration_seconds: state.quizTimer
    };

    try {
      const savedSession = await SupabaseService.saveTestSession(sessionRecord, details);
      state.lastQuizResult = {
        ...sessionRecord,
        id: savedSession.id,
        details: details
      };
      await this.loadAllData();
      this.switchTab('quiz_result');
    } catch (err) {
      console.error(err);
      state.lastQuizResult = { ...sessionRecord, details };
      this.switchTab('quiz_result');
    }
  },

  // =========================================================================
  // GIA SƯ AI QUANG SON
  // =========================================================================

  async sendTutorMessage(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('tutor-chat-input');
    if (!input || !input.value.trim() || state.isTutorTyping) return;

    const userText = input.value.trim();
    input.value = "";

    state.chatMessages.push({ sender: 'user', text: userText });
    state.isTutorTyping = true;
    this.render();

    this.scrollChatToBottom();

    try {
      const reply = await GeminiService.askTutor(userText, state.chatMessages);
      state.chatMessages.push({ sender: 'bot', text: reply });
    } catch (err) {
      console.error("Gemini Tutor Error:", err);
      state.chatMessages.push({
        sender: 'bot',
        text: `Chào em! Thầy nhận thấy câu hỏi "${userText}" rất hay. Để thầy phân tích chi tiết: ${err.message?.includes("403") || err.message?.includes("key") ? "Vui lòng kiểm tra lại cấu hình GEMINI_API_KEY trong file .env.local nhé!" : "Em hãy thử hỏi lại hoặc nêu rõ câu bài tập cần thầy hướng dẫn nhé!"}`
      });
    } finally {
      state.isTutorTyping = false;
      this.render();
      this.scrollChatToBottom();
    }
  },

  scrollChatToBottom() {
    setTimeout(() => {
      const container = document.getElementById('tutor-chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  },

  bindGlobalEvents() {
    window.addEventListener('keydown', (e) => {
      if (state.currentTab === 'flashcards') {
        if (e.code === 'Space') {
          e.preventDefault();
          this.flipFlashcard();
        } else if (e.code === 'ArrowRight') {
          this.nextFlashcard(false);
        } else if (e.code === 'ArrowLeft') {
          this.prevFlashcard();
        }
      }
    });
  },

  // =========================================================================
  // VIEW RENDERERS & ROLE-BASED NAVIGATION
  // =========================================================================

  render() {
    const mainContainer = document.getElementById('app-root');
    if (!mainContainer) return;

    // Toggle Sidebar & Header visibility depending on login state
    const sidebar = document.querySelector('aside');
    const header = document.querySelector('header');
    const mobileNav = document.querySelector('nav.md\\:hidden');

    if (!state.currentUser) {
      if (sidebar) sidebar.classList.add('hidden');
      if (header) header.classList.add('hidden');
      if (mobileNav) mobileNav.classList.add('hidden');
      mainContainer.parentElement.classList.remove('md:ml-72');
      mainContainer.innerHTML = this.renderLoginView();
      return;
    } else {
      if (sidebar) sidebar.classList.remove('hidden');
      if (header) header.classList.remove('hidden');
      if (mobileNav) mobileNav.classList.remove('hidden');
      mainContainer.parentElement.classList.add('md:ml-72');
    }

    // Role-based sidebar menu items filtering
    this.updateSidebarNavigationUI();

    const viewRenderers = {
      dashboard: this.renderDashboardView,
      classes: this.renderClassesView,
      accounts: this.renderAccountManagementView,
      lessons: this.renderLessonsView,
      vocabulary: this.renderVocabularyView,
      table_input: this.renderTableInputView,
      flashcards: this.renderFlashcardsView,
      quiz: this.renderQuizView,
      quiz_result: this.renderQuizResultView,
      reports: this.renderReportsView,
      tutor: this.renderTutorView,
      settings: this.renderSettingsView
    };

    const currentRenderer = viewRenderers[state.currentTab] || this.renderDashboardView;
    mainContainer.innerHTML = currentRenderer.call(this);

    // Update active nav indicators
    document.querySelectorAll('[data-nav-tab]').forEach(el => {
      const tab = el.getAttribute('data-nav-tab');
      if (tab === state.currentTab) {
        el.classList.add('bg-primary-container', 'text-on-primary-container', 'font-bold');
        el.classList.remove('text-on-surface-variant');
      } else {
        el.classList.remove('bg-primary-container', 'text-on-primary-container', 'font-bold');
        el.classList.add('text-on-surface-variant');
      }
    });

    // Update User Profile Badge in Header & Sidebar
    this.updateUserBadgeUI();
  },

  updateSidebarNavigationUI() {
    const user = state.currentUser;
    if (!user) return;
    const isStudent = user.role === 'student';

    // Hide admin navigation items for students
    document.querySelectorAll('[data-admin-only]').forEach(el => {
      if (isStudent) {
        el.classList.add('hidden');
      } else {
        el.classList.remove('hidden');
      }
    });

    // Hide quick batch table button on top of sidebar for students
    const sidebarBatchBtn = document.getElementById('sidebar-batch-btn');
    if (sidebarBatchBtn) {
      if (isStudent) sidebarBatchBtn.classList.add('hidden');
      else sidebarBatchBtn.classList.remove('hidden');
    }

    // Hide top bar batch button for students
    const headerBatchBtn = document.getElementById('header-batch-btn');
    if (headerBatchBtn) {
      if (isStudent) headerBatchBtn.classList.add('hidden');
      else headerBatchBtn.classList.remove('hidden');
    }
  },

  updateUserBadgeUI() {
    const user = state.currentUser;
    if (!user) return;

    const roleLabel = user.role === 'host' ? '👑 Host' : user.role === 'assistant_teacher' ? '👩‍🏫 Trợ giảng' : '🎓 Học sinh';
    
    // Header Badge
    const headerBadge = document.getElementById('header-user-badge');
    if (headerBadge) {
      headerBadge.innerHTML = `
        <div class="w-2.5 h-2.5 rounded-full ${user.role === 'host' ? 'bg-amber-500' : 'bg-green-500'}"></div>
        <span class="text-xs font-bold text-on-surface">${user.full_name}</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-bold">${roleLabel}</span>
      `;
    }

    // Sidebar Role Controls & Self Password Change Trigger
    const sidebarProfile = document.getElementById('sidebar-user-profile');
    if (sidebarProfile) {
      sidebarProfile.innerHTML = `
        <div class="p-3 bg-surface-container-low rounded-xl flex items-center justify-between">
          <div class="flex items-center gap-2.5 cursor-pointer" onclick="App.openChangeMyPasswordModal()" title="Bấm để đổi mật khẩu của bạn">
            <div class="w-8 h-8 rounded-full ${user.role === 'host' ? 'bg-amber-100 text-amber-900' : 'bg-primary text-on-primary'} flex items-center justify-center text-xs font-bold shadow-sm">
              ${user.full_name.charAt(0)}
            </div>
            <div>
              <p class="text-xs font-bold text-on-surface truncate max-w-[110px] hover:text-primary transition-colors">${user.full_name}</p>
              <p class="text-[10px] text-outline font-mono flex items-center gap-1">
                <span>@${user.username}</span>
                <span class="text-[9px] text-primary underline">Đổi pass</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button onclick="App.openChangeMyPasswordModal()" class="p-1.5 text-outline hover:text-primary rounded-lg hover:bg-surface-container transition-colors" title="Đổi mật khẩu">
              <span class="material-symbols-outlined text-base">key</span>
            </button>
            <button onclick="App.handleLogout()" class="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error-container/20 transition-colors" title="Đăng xuất">
              <span class="material-symbols-outlined text-base">logout</span>
            </button>
          </div>
        </div>
      `;
    }
  },

  // 0. Login View
  renderLoginView() {
    return `
      <div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#F0F9FF] via-[#E6F4FE] to-[#EFF6FF] w-full">
        <div class="max-w-md w-full bg-surface-container-lowest rounded-3xl p-8 ambient-shadow border border-outline-variant/30 flex flex-col gap-5">
          
          <!-- Logo & Brand Header -->
          <div class="text-center">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary flex items-center justify-center text-3xl font-bold shadow-md mx-auto mb-3">
              <span class="material-symbols-outlined text-3xl">school</span>
            </div>
            <h1 class="font-display-lg text-2xl font-bold text-primary">Quang Son</h1>
            <p class="text-xs font-bold text-secondary uppercase tracking-wider">Your English Tutor</p>
            <p class="text-xs text-on-surface-variant mt-1">Hệ thống Ôn thi Tiếng Anh vào 10 Chuyên Sâu</p>
          </div>

          <!-- Login Form -->
          <form onsubmit="App.handleLogin(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-on-surface mb-1 uppercase">Tên đăng nhập / Username (*)</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg">person</span>
                <input 
                  type="text" 
                  id="login-username"
                  required
                  placeholder="Nhập username (ví dụ: trogiang_linh hoặc an_nguyen)..."
                  class="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant/40 rounded-xl text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white transition-all"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-on-surface mb-1 uppercase">Mật khẩu (*)</label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-lg">lock</span>
                <input 
                  type="password" 
                  id="login-password"
                  required
                  placeholder="Nhập mật khẩu..."
                  class="w-full pl-10 pr-11 py-3 bg-surface-container-low border border-outline-variant/40 rounded-xl text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white transition-all"
                />
                <button 
                  type="button" 
                  onclick="App.togglePasswordVisibility('login-password', 'toggle-login-pass-icon')"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary p-1 flex items-center justify-center transition-colors"
                  title="Hiện / Ẩn mật khẩu"
                >
                  <span id="toggle-login-pass-icon" class="material-symbols-outlined text-lg">visibility_off</span>
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between text-xs">
              <label class="flex items-center gap-2 cursor-pointer text-on-surface-variant font-medium">
                <input type="checkbox" id="login-remember" checked class="rounded text-primary focus:ring-primary" />
                <span>Ghi nhớ đăng nhập (Lưu Cookies)</span>
              </label>
            </div>

            <button 
              type="submit" 
              class="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3.5 rounded-xl font-bold text-sm btn-press flex items-center justify-center gap-2 hover-lift shadow-md mt-3"
            >
              <span class="material-symbols-outlined text-lg">login</span>
              <span>Đăng Nhập Vào Hệ Thống</span>
            </button>
          </form>

          <div class="text-center text-[11px] text-outline pt-3 border-t border-outline-variant/30">
            © 2026 Quang Son - Your English Tutor. All rights reserved.
          </div>
        </div>
      </div>
    `;
  },

  // 1. Dashboard View (Locked to assigned class for students)
  renderDashboardView() {
    const user = state.currentUser;
    const isStudent = user.role === 'student';
    
    // For students, lock selectedClassId to their own class
    const targetClassId = isStudent ? Number(user.class_id || 1) : Number(state.selectedClassId);
    const activeClass = state.classes.find(c => c.id === targetClassId) || state.classes[0] || { name: "Lớp học", class_code: "QS9A" };
    const classVocab = state.vocabulary.filter(v => v.class_id === targetClassId);
    const classLessons = state.lessons.filter(l => l.class_id === targetClassId);
    const classStudents = state.usersList.filter(u => u.role === 'student' && u.class_id === targetClassId);

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        
        <!-- Active Class Banner -->
        <div class="bg-surface-container-lowest p-5 rounded-2xl ambient-shadow border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <span class="material-symbols-outlined text-2xl">school</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-headline-md text-base font-bold text-on-surface">${activeClass.name}</h3>
                <span class="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary text-xs font-mono font-bold">Mã: ${activeClass.class_code}</span>
              </div>
              <p class="text-xs text-on-surface-variant">
                ${isStudent ? `Lớp học của em: Toàn bộ từ vựng và bài kiểm tra được thiết kế riêng cho lớp ${activeClass.name}.` : user.role === 'host' ? 'Quản trị viên tối cao: Toàn quyền truy cập mọi lớp học & quản lý tài khoản.' : 'Giáo viên phụ: Quản lý bài học và kho từ vựng lớp này.'}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            ${!isStudent ? `
              <select onchange="App.selectClass(this.value)" class="py-2 px-3 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs font-bold text-primary focus:outline-none">
                ${state.classes.map(c => `<option value="${c.id}" ${c.id === state.selectedClassId ? 'selected' : ''}>Chuyển lớp: ${c.name}</option>`).join('')}
              </select>
            ` : `
              <button onclick="App.openChangeMyPasswordModal()" class="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs flex items-center gap-1.5 transition-colors">
                <span class="material-symbols-outlined text-sm">key</span> Đổi Mật Khẩu
              </button>
            `}
          </div>
        </div>

        <!-- Welcome Hero -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-surface-container-lowest to-surface-container-low p-6 md:p-8 rounded-2xl ambient-shadow border border-outline-variant/30">
          <div>
            <div class="flex items-center gap-2 text-primary font-bold text-xs mb-1">
              <span class="material-symbols-outlined text-base">verified</span>
              <span>${CONFIG.BRAND.NAME}</span>
            </div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">
              Xin chào, <span class="text-primary">${user.full_name}!</span> 👋
            </h2>
            <p class="font-body-md text-sm text-on-surface-variant mt-1">
              Lớp <strong class="text-primary">${activeClass.name}</strong> hiện có <strong class="text-primary">${classVocab.length} từ vựng</strong> thuộc <strong class="text-primary">${classLessons.length} chuyên đề</strong>.
            </p>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            ${!isStudent ? `
              <button onclick="App.openBatchTableModal()" class="bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm btn-press flex items-center gap-2 hover-lift">
                <span class="material-symbols-outlined">table_rows</span>
                Bảng Thêm Từ Vựng Mới
              </button>
            ` : ''}
            <button onclick="App.switchTab('flashcards')" class="bg-secondary-container text-on-secondary-container px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 hover-lift">
              <span class="material-symbols-outlined">style</span>
              Luyện Flashcard 3D
            </button>
            <button onclick="App.startNewQuiz(null, true)" class="bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 btn-press hover-lift">
              <span class="material-symbols-outlined">casino</span>
              Test Random Toàn Lớp
            </button>
          </div>
        </div>

        <!-- Bento Stats Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
            <div class="flex justify-between items-start mb-3">
              <div class="w-12 h-12 rounded-xl bg-primary-container/15 flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-2xl">menu_book</span>
              </div>
              <span class="bg-surface-container-highest text-primary font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">${activeClass.name.split(' - ')[0]}</span>
            </div>
            <h3 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Từ Vựng Của Lớp</h3>
            <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">${classVocab.length} <span class="text-xs font-normal text-outline">từ</span></p>
          </div>

          <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
            <div class="flex justify-between items-start mb-3">
              <div class="w-12 h-12 rounded-xl bg-secondary-container/15 flex items-center justify-center text-secondary">
                <span class="material-symbols-outlined text-2xl">auto_stories</span>
              </div>
              <span class="bg-surface-container-highest text-secondary font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">${classLessons.length} Unit</span>
            </div>
            <h3 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Chuyên Đề Bài Học</h3>
            <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">${classLessons.length} <span class="text-xs font-normal text-outline">chuyên đề</span></p>
          </div>

          <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
            <div class="flex justify-between items-start mb-3">
              <div class="w-12 h-12 rounded-xl bg-tertiary-container/15 flex items-center justify-center text-tertiary">
                <span class="material-symbols-outlined text-2xl">military_tech</span>
              </div>
              <span class="bg-surface-container-highest text-tertiary font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">Mục tiêu</span>
            </div>
            <h3 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Mục Tiêu Thi Vào 10</h3>
            <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">9.0+ <span class="text-xs font-normal text-outline">điểm</span></p>
          </div>

          <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
            <div class="flex justify-between items-start mb-3">
              <div class="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center text-green-700">
                <span class="material-symbols-outlined text-2xl">local_fire_department</span>
              </div>
              <span class="bg-green-100 text-green-800 font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">Chăm chỉ</span>
            </div>
            <h3 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Chuỗi Ngày Học</h3>
            <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">12 <span class="text-xs font-normal text-outline">ngày liên tiếp</span></p>
          </div>
        </div>

        <!-- Lessons List -->
        <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-headline-md text-lg font-bold text-on-surface">Chuyên Đề Bài Học - ${activeClass.name}</h3>
              <p class="text-xs text-on-surface-variant">Luyện tập từ vựng hoặc làm bài kiểm tra 3 dạng bài theo từng Unit</p>
            </div>
            ${!isStudent ? `
              <button onclick="App.openCreateLessonModal()" class="text-primary font-bold text-xs flex items-center gap-1 hover:underline">
                <span class="material-symbols-outlined text-sm">add_circle</span> Thêm bài học
              </button>
            ` : ''}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            ${classLessons.map(lesson => {
              const count = classVocab.filter(v => v.lesson_id === lesson.id).length;
              return `
                <div class="p-5 rounded-xl bg-surface-container-low border border-outline-variant/40 hover:border-primary/50 transition-all hover-lift flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <span class="px-2.5 py-0.5 bg-surface-container-high rounded-full text-xs font-bold text-primary">Unit #${lesson.id}</span>
                      <span class="text-xs text-outline">${count} từ vựng</span>
                    </div>
                    <h4 class="font-headline-md text-sm font-bold text-on-surface mb-3">${lesson.title}</h4>
                  </div>
                  <div class="flex items-center gap-2 pt-3 border-t border-outline-variant/30">
                    <button onclick="App.state.selectedLessonId = ${lesson.id}; App.switchTab('flashcards');" class="flex-1 bg-surface-container-lowest text-primary py-2 rounded-lg font-bold text-xs border border-primary/20 hover:bg-primary hover:text-on-primary transition-colors text-center flex items-center justify-center gap-1">
                      <span class="material-symbols-outlined text-sm">style</span> Luyện thẻ
                    </button>
                    <button onclick="App.startNewQuiz(${lesson.id}, false)" class="flex-1 bg-primary text-on-primary py-2 rounded-lg font-bold text-xs hover:bg-primary-container transition-colors text-center flex items-center justify-center gap-1">
                      <span class="material-symbols-outlined text-sm">quiz</span> Thi thử (3 Dạng)
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  },

  // 1.1. Account Management & Provisioning View (Host & Assistant Teacher)
  renderAccountManagementView() {
    if (state.currentUser?.role === 'student') {
      return this.renderDashboardView();
    }

    const users = state.usersList;
    const isHost = state.currentUser?.role === 'host';

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 text-primary font-bold text-xs mb-1">
              <span class="material-symbols-outlined text-base">manage_accounts</span>
              <span>PHÂN HỆ QUẢN TRỊ TÀI KHOẢN & PHÂN QUYỀN</span>
            </div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">Quản Lý & Cấp Tài Khoản</h2>
            <p class="font-body-md text-sm text-on-surface-variant">Cấp tài khoản mới cho Giáo viên phụ và Học sinh, quản lý mật khẩu và phân quyền lớp học.</p>
          </div>

          <button onclick="App.openCreateUserModal()" class="bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm btn-press flex items-center gap-2 hover-lift shadow-sm self-start sm:self-auto">
            <span class="material-symbols-outlined text-lg">person_add</span>
            + Cấp Tài Khoản Mới
          </button>
        </div>

        <!-- Accounts Table -->
        <div class="bg-surface-container-lowest rounded-2xl ambient-shadow border border-outline-variant/30 overflow-hidden">
          <div class="p-5 border-b border-outline-variant/30 flex items-center justify-between">
            <h3 class="font-headline-md text-base font-bold text-on-surface">Danh sách tài khoản hệ thống (${users.length} tài khoản)</h3>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="bg-surface-container-low text-outline uppercase font-bold border-b border-outline-variant/30">
                <tr>
                  <th class="p-4 w-12 text-center">STT</th>
                  <th class="p-4">Họ và Tên</th>
                  <th class="p-4">Tên Đăng Nhập</th>
                  <th class="p-4">Mật Khẩu</th>
                  <th class="p-4">Vai Trò</th>
                  <th class="p-4">Lớp Phân Công</th>
                  <th class="p-4 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/20">
                ${users.map((u, idx) => {
                  const assignedClass = state.classes.find(c => c.id === u.class_id);
                  const isUserHost = u.role === 'host';

                  return `
                    <tr class="hover:bg-surface-container-low/50 transition-colors">
                      <td class="p-4 text-center font-bold text-outline">${idx + 1}</td>
                      <td class="p-4 font-bold text-on-surface flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full ${isUserHost ? 'bg-amber-100 text-amber-900 font-bold' : u.role === 'assistant_teacher' ? 'bg-blue-100 text-blue-900' : 'bg-green-100 text-green-900'} flex items-center justify-center text-xs">
                          ${isUserHost ? '👑' : u.role === 'assistant_teacher' ? '👩‍🏫' : '🎓'}
                        </div>
                        <span>${u.full_name}</span>
                      </td>
                      <td class="p-4 font-mono font-bold text-primary">@${u.username}</td>
                      <td class="p-4 font-mono text-outline">
                        <span class="bg-surface-container px-2 py-1 rounded">${u.password || '••••••••'}</span>
                      </td>
                      <td class="p-4">
                        <span class="px-2.5 py-1 rounded-full font-bold text-[11px] ${
                          isUserHost ? 'bg-amber-100 text-amber-900' :
                          u.role === 'assistant_teacher' ? 'bg-blue-100 text-blue-900' : 'bg-green-100 text-green-900'
                        }">
                          ${isUserHost ? 'Quản trị viên (Host)' : u.role === 'assistant_teacher' ? 'Giáo viên phụ' : 'Học sinh'}
                        </span>
                      </td>
                      <td class="p-4 text-on-surface">
                        ${isUserHost ? '<span class="text-primary font-bold">Toàn bộ các lớp</span>' : assignedClass ? assignedClass.name : 'Chưa gán'}
                      </td>
                      <td class="p-4 text-center">
                        <div class="flex items-center justify-center gap-2">
                          <button onclick="App.handleChangePassword('${u.id}', '${u.full_name}')" class="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-[11px] transition-colors" title="Đổi mật khẩu">
                            Đổi Pass
                          </button>
                          ${!isUserHost && isHost ? `
                            <button onclick="App.handleDeleteUser('${u.id}', '${u.full_name}')" class="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error-container/20 transition-colors" title="Xóa tài khoản">
                              <span class="material-symbols-outlined text-base">delete</span>
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // 2. Batch Vocabulary Input Table View
  renderTableInputView() {
    if (state.currentUser?.role === 'student') return this.renderDashboardView();

    const classLessons = state.lessons.filter(l => l.class_id === state.selectedClassId);

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <!-- Navigation Back Header -->
        <div class="flex items-center justify-between">
          <button onclick="App.safeGoBack('vocabulary')" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs transition-all hover-lift">
            <span class="material-symbols-outlined text-base">arrow_back</span>
            <span>← Quay lại Kho từ vựng</span>
          </button>
          <span class="text-xs font-bold text-primary uppercase">Thêm từ vựng nhiều dòng</span>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">Bảng Nhập Từ Vựng Hàng Loạt</h2>
            <p class="font-body-md text-sm text-on-surface-variant">Nhập từ vựng, hỗ trợ dán Clipboard và tự động tạo IPA + Ví dụ bằng Gemini AI.</p>
          </div>
        </div>

        <!-- Target Class & Lesson Card -->
        <div class="bg-surface-container-lowest p-5 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-4 w-full sm:w-auto">
            <div>
              <label class="block text-xs font-bold text-outline uppercase mb-1">Lớp học đích (*)</label>
              <select id="table-input-class" onchange="App.selectClass(this.value)" class="py-2.5 px-3.5 bg-surface-container-low border border-outline-variant/40 rounded-xl text-sm font-bold text-primary focus:outline-none">
                ${state.classes.map(c => `<option value="${c.id}" ${c.id === state.selectedClassId ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-outline uppercase mb-1">Bài học đích (*)</label>
              <select id="table-input-lesson" class="py-2.5 px-3.5 bg-surface-container-low border border-outline-variant/40 rounded-xl text-sm font-semibold focus:outline-none">
                ${classLessons.map(l => `<option value="${l.id}" ${l.id === state.selectedLessonId ? 'selected' : ''}>${l.title}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            <button onclick="App.pasteClipboardToTable()" class="bg-secondary-container text-on-secondary-container px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 hover-lift shadow-sm">
              <span class="material-symbols-outlined text-sm">content_paste</span> Dán từ Clipboard
            </button>
            <button onclick="App.addBatchTableRow()" class="bg-surface-container text-primary px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1 hover:bg-surface-container-high">
              <span class="material-symbols-outlined text-sm">add</span> +1 Dòng
            </button>
            <button onclick="App.addBatchTable5Rows()" class="bg-surface-container text-primary px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1 hover:bg-surface-container-high">
              <span class="material-symbols-outlined text-sm">add_box</span> +5 Dòng
            </button>
          </div>
        </div>

        <!-- Table -->
        <div class="bg-surface-container-lowest rounded-2xl ambient-shadow border border-outline-variant/30 overflow-hidden">
          <div class="overflow-x-auto max-h-[500px]">
            <table class="w-full text-left text-sm border-collapse">
              <thead class="bg-surface-container-low text-on-surface uppercase text-xs font-bold border-b border-outline-variant/30 sticky top-0 z-10">
                <tr>
                  <th class="p-4 w-16 text-center text-outline">STT</th>
                  <th class="p-4 w-1/2">Từ vựng tiếng Anh (Word / Phrase) (*)</th>
                  <th class="p-4 w-1/2">Ý nghĩa tiếng Việt (Meaning) (*)</th>
                  <th class="p-4 w-20 text-center text-outline">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/20 bg-surface-container-lowest">
                ${state.batchTableRows.map((row, idx) => `
                  <tr class="hover:bg-surface-container-low/40 transition-colors">
                    <td class="p-4 text-center font-bold text-xs text-outline">${idx + 1}</td>
                    <td class="p-3">
                      <input 
                        type="text" 
                        value="${row.word.replace(/"/g, '&quot;')}"
                        placeholder="Nhập từ vựng (ví dụ: ubiquitous, perseverance...)"
                        oninput="App.updateBatchTableCell(${row.id}, 'word', this.value)"
                        class="w-full px-3.5 py-2.5 bg-surface-container-low/60 border border-outline-variant/40 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:border-primary focus:bg-white transition-all"
                      />
                    </td>
                    <td class="p-3">
                      <input 
                        type="text" 
                        value="${row.meaning.replace(/"/g, '&quot;')}"
                        placeholder="Nhập ý nghĩa tiếng Việt..."
                        oninput="App.updateBatchTableCell(${row.id}, 'meaning', this.value)"
                        class="w-full px-3.5 py-2.5 bg-surface-container-low/60 border border-outline-variant/40 rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:bg-white transition-all"
                      />
                    </td>
                    <td class="p-3 text-center">
                      <button onclick="App.removeBatchTableRow(${row.id})" class="p-2 text-outline hover:text-error rounded-xl hover:bg-error-container/20 transition-colors" title="Xóa dòng này">
                        <span class="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="p-5 bg-surface-container-low border-t border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="text-xs text-on-surface-variant">
              💡 <strong>Mẹo:</strong> Điền <em>Từ vựng</em> và <em>Nghĩa</em>, <strong>Gemini AI</strong> sẽ tự động bổ sung <strong>Phiên âm IPA chuẩn</strong> và <strong>Câu ví dụ tiếng Anh</strong>!
            </div>

            <div class="flex items-center gap-3">
              <button onclick="App.addBatchTableRow()" class="px-4 py-2.5 rounded-xl border border-outline-variant text-primary font-bold text-xs hover:bg-surface-container">
                + Thêm Dòng
              </button>
              <button 
                onclick="App.saveBatchTableToSupabase()" 
                ${state.isSavingBatchTable ? 'disabled' : ''} 
                class="bg-gradient-to-r from-primary to-primary-container text-on-primary px-7 py-3 rounded-xl font-bold text-sm btn-press flex items-center gap-2 hover-lift shadow-md disabled:opacity-50"
              >
                ${state.isSavingBatchTable ? `
                  <span class="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  <span>Đang xử lý AI & Lưu...</span>
                ` : `
                  <span class="material-symbols-outlined text-base">auto_awesome</span>
                  <span>Lưu Toàn Bộ Từ Vựng Vào Supabase</span>
                `}
              </button>
            </div>
          </div>
        </div>

        ${state.isSavingBatchTable ? `
          <div class="p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center gap-3 text-primary text-sm font-bold">
            <span class="material-symbols-outlined animate-spin text-xl">sync</span>
            <span>${state.batchSaveProgressText}</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  // 3. Classes View (Admin / Teacher Only)
  renderClassesView() {
    if (state.currentUser?.role === 'student') return this.renderDashboardView();

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">Quản lý Lớp học & Học viên</h2>
            <p class="font-body-md text-sm text-on-surface-variant">Tạo lớp học mới, chia sẻ Mã lớp và quản lý kho từ vựng.</p>
          </div>
          <button onclick="App.openCreateClassModal()" class="bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 btn-press hover-lift self-start sm:self-auto">
            <span class="material-symbols-outlined">add</span>
            Tạo Lớp Học Mới
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          ${state.classes.map(c => {
            const classVocab = state.vocabulary.filter(v => v.class_id === c.id);
            const classLessons = state.lessons.filter(l => l.class_id === c.id);
            const classStudents = state.usersList.filter(u => u.class_id === c.id && u.role === 'student');
            const isSelected = c.id === state.selectedClassId;

            return `
              <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border-2 ${isSelected ? 'border-primary' : 'border-outline-variant/30'} flex flex-col justify-between hover-lift">
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <span class="px-3 py-1 rounded-full ${isSelected ? 'bg-primary text-on-primary font-bold' : 'bg-primary-container/20 text-primary font-bold'} text-xs">Mã: ${c.class_code}</span>
                    <button onclick="navigator.clipboard.writeText('${c.class_code}'); App.showToast('Đã copy mã lớp ${c.class_code}!', 'success')" class="text-outline hover:text-primary p-1" title="Copy mã lớp">
                      <span class="material-symbols-outlined text-base">content_copy</span>
                    </button>
                  </div>
                  <h3 class="font-headline-md text-base font-bold text-on-surface mb-2">${c.name}</h3>
                  <div class="flex items-center gap-3 text-xs text-on-surface-variant mb-4">
                    <span>📚 ${classVocab.length} từ</span>
                    <span>📖 ${classLessons.length} bài</span>
                    <span>👥 ${classStudents.length} học sinh</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 pt-3 border-t border-outline-variant/30">
                  <button onclick="App.selectClass(${c.id}); App.switchTab('vocabulary');" class="flex-1 bg-surface-container text-primary font-bold text-xs py-2.5 rounded-xl hover:bg-primary hover:text-on-primary transition-colors text-center">
                    Kho từ vựng
                  </button>
                  <button onclick="App.deleteClass(${c.id})" class="p-2 text-outline hover:text-error rounded-xl">
                    <span class="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // 4. Lessons View (Admin / Teacher Only)
  renderLessonsView() {
    if (state.currentUser?.role === 'student') return this.renderDashboardView();

    const activeClass = state.classes.find(c => c.id === state.selectedClassId) || state.classes[0];
    const classLessons = state.lessons.filter(l => l.class_id === Number(state.selectedClassId));

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">Quản lý Bài học - ${activeClass.name}</h2>
            <p class="font-body-md text-sm text-on-surface-variant">Danh mục chuyên đề ôn thi vào 10 cho ${activeClass.name}.</p>
          </div>
          <div class="flex items-center gap-3">
            <button onclick="App.openCreateLessonModal()" class="bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 btn-press hover-lift">
              <span class="material-symbols-outlined">add</span> Thêm Bài Học
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          ${classLessons.map(l => {
            const vocab = state.vocabulary.filter(v => v.lesson_id === l.id);
            return `
              <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col justify-between hover-lift">
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <span class="px-3 py-1 bg-primary-container/20 text-primary font-bold text-xs rounded-full">Unit #${l.id}</span>
                    <span class="text-xs text-outline">${vocab.length} từ vựng</span>
                  </div>
                  <h3 class="font-headline-md text-base font-bold text-on-surface mb-2">${l.title}</h3>
                </div>
                <div class="flex items-center gap-2 pt-4 border-t border-outline-variant/30">
                  <button onclick="App.state.selectedLessonId = ${l.id}; App.switchTab('vocabulary');" class="flex-1 bg-surface-container text-primary font-bold text-xs py-2.5 rounded-xl hover:bg-primary hover:text-on-primary transition-colors text-center">
                    Kho từ
                  </button>
                  <button onclick="App.startNewQuiz(${l.id})" class="flex-1 bg-primary text-on-primary font-bold text-xs py-2.5 rounded-xl hover:bg-primary-container transition-colors text-center">
                    Thi thử
                  </button>
                  <button onclick="App.deleteLesson(${l.id})" class="p-2 text-outline hover:text-error rounded-xl">
                    <span class="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  // 5. Vocabulary Inventory View (Class-Scoped for Student)
  renderVocabularyView() {
    const isStudent = state.currentUser?.role === 'student';
    const targetClassId = isStudent ? Number(state.currentUser.class_id || 1) : Number(state.selectedClassId);
    const activeClass = state.classes.find(c => c.id === targetClassId) || state.classes[0];
    const classLessons = state.lessons.filter(l => l.class_id === targetClassId);
    
    const filteredVocab = state.vocabulary.filter(v => {
      const matchClass = v.class_id === targetClassId;
      const matchLesson = !state.selectedLessonId || v.lesson_id === Number(state.selectedLessonId);
      const matchGrammar = state.filterGrammar === 'all' 
        ? true 
        : state.filterGrammar === 'grammar' 
          ? Boolean(v.is_grammar) 
          : !Boolean(v.is_grammar);
      const matchSearch = !state.searchQuery || 
        v.word.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
        v.meaning.toLowerCase().includes(state.searchQuery.toLowerCase());
      return matchClass && matchLesson && matchGrammar && matchSearch;
    });

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 text-primary font-bold text-xs mb-1">
              <span class="material-symbols-outlined text-base">school</span>
              <span>KHO TỪ VỰNG: ${activeClass.name}</span>
            </div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">Kho Từ Vựng Tiếng Anh</h2>
            <p class="font-body-md text-sm text-on-surface-variant">
              ${isStudent ? `Toàn bộ từ vựng & cấu trúc ôn thi vào 10 dành riêng cho lớp ${activeClass.name}.` : 'Được cách ly riêng biệt theo từng lớp học ôn thi vào 10.'}
            </p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <button onclick="App.ExcelService.exportVocabulary(filteredVocab)" class="bg-surface-container text-on-surface px-4 py-2.5 rounded-xl font-bold text-xs border border-outline-variant/40 flex items-center gap-1.5 hover:bg-surface-container-high">
              <span class="material-symbols-outlined text-sm">download</span> Xuất Excel
            </button>
            ${!isStudent ? `
              <button onclick="App.openBatchTableModal()" class="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 btn-press hover-lift">
                <span class="material-symbols-outlined text-sm">table_rows</span> + Thêm Từ Dạng Bảng
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Filters Bar -->
        <div class="bg-surface-container-lowest p-4 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col md:flex-row items-center gap-3">
          ${!isStudent ? `
            <select 
              onchange="App.selectClass(this.value)"
              class="w-full md:w-60 py-2.5 px-3 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs font-bold text-primary focus:outline-none"
            >
              ${state.classes.map(c => `<option value="${c.id}" ${c.id === state.selectedClassId ? 'selected' : ''}>Lớp: ${c.name}</option>`).join('')}
            </select>
          ` : ''}

          <div class="relative flex-1 w-full">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input 
              type="text" 
              placeholder="Tìm kiếm từ vựng, phiên âm hoặc nghĩa tiếng Việt..." 
              value="${state.searchQuery}"
              oninput="App.state.searchQuery = this.value; App.render();"
              class="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs focus:outline-none focus:border-primary"
            />
          </div>

          <select 
            onchange="App.state.selectedLessonId = this.value ? Number(this.value) : null; App.updateStudyList(); App.render();"
            class="w-full md:w-52 py-2.5 px-3 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs focus:outline-none"
          >
            <option value="">Tất cả bài học lớp này</option>
            ${classLessons.map(l => `<option value="${l.id}" ${state.selectedLessonId === l.id ? 'selected' : ''}>${l.title}</option>`).join('')}
          </select>
        </div>

        <!-- Vocabulary Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          ${filteredVocab.length > 0 ? filteredVocab.map(item => `
            <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col justify-between hover-lift group">
              <div>
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 class="font-headline-md text-lg font-bold text-primary flex items-center gap-2">
                      ${item.word}
                      <button onclick="App.speakWord('${item.word}')" class="w-7 h-7 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors" title="Nghe phát âm">
                        <span class="material-symbols-outlined text-sm">volume_up</span>
                      </button>
                    </h3>
                    <span class="font-mono text-xs text-outline">${item.ipa || ''}</span>
                  </div>
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${item.is_grammar ? 'bg-amber-100 text-amber-800' : 'bg-primary-container/20 text-primary'}">
                    ${item.is_grammar ? 'Ngữ pháp' : 'Từ vựng'}
                  </span>
                </div>

                <div class="my-3">
                  <p class="font-body-md text-on-surface font-medium text-xs leading-relaxed">${item.meaning}</p>
                  ${item.example ? `
                    <div class="mt-2.5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface-variant">
                      <p class="italic text-on-surface">"${item.example}"</p>
                    </div>
                  ` : ''}
                </div>
              </div>

              <div class="flex items-center justify-between pt-3 border-t border-outline-variant/30 text-xs text-outline mt-2">
                <span>Unit #${item.lesson_id}</span>
                ${!isStudent ? `
                  <div class="flex items-center gap-2">
                    <button onclick="App.deleteVocabulary(${item.id}, '${item.word}')" class="text-error hover:underline font-bold">Xóa</button>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('') : `
            <div class="col-span-full py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 text-center flex flex-col items-center justify-center">
              <span class="material-symbols-outlined text-5xl text-outline mb-2">menu_book</span>
              <p class="font-headline-md text-base font-bold text-on-surface">Chưa có từ vựng nào trong lớp/bài học này</p>
              ${!isStudent ? `
                <button onclick="App.openBatchTableModal()" class="mt-3 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs btn-press">
                  + Thêm Từ Vựng Dạng Bảng Ngay
                </button>
              ` : ''}
            </div>
          `}
        </div>
      </div>
    `;
  },

  // 6. Flashcards 3D View
  renderFlashcardsView() {
    const list = state.studyList;
    const activeClass = state.classes.find(c => c.id === state.selectedClassId) || state.classes[0];

    if (list.length === 0) {
      return `
        <div class="flex-1 flex flex-col items-center justify-center p-12 text-center max-w-lg mx-auto">
          <button onclick="App.safeGoBack('dashboard')" class="mb-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold text-xs">
            <span class="material-symbols-outlined text-base">arrow_back</span> Về Menu
          </button>
          <span class="material-symbols-outlined text-6xl text-outline mb-3">style</span>
          <h2 class="font-headline-md text-lg font-bold text-on-surface">Chưa có từ vựng nào trong ${activeClass.name}</h2>
          <p class="text-xs text-outline mt-1 mb-4">Hãy chờ thầy cô thêm từ vựng mới để bắt đầu luyện Flashcard nhé.</p>
        </div>
      `;
    }

    const currentWord = list[state.flashcardIndex] || list[0];
    const progressPct = Math.round(((state.flashcardIndex + 1) / list.length) * 100);

    return `
      <div class="flex-1 flex flex-col items-center max-w-2xl mx-auto w-full gap-stack-md">
        <!-- Top Navigation Bar -->
        <div class="w-full flex items-center justify-between">
          <button onclick="App.safeGoBack('dashboard')" class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs transition-all hover-lift">
            <span class="material-symbols-outlined text-base">arrow_back</span>
            <span>🏠 Về Menu</span>
          </button>
          
          <div class="text-center">
            <span class="text-[11px] font-bold text-primary uppercase">${activeClass.name}</span>
            <h2 class="font-headline-md text-sm font-bold text-on-surface">Thẻ ${state.flashcardIndex + 1} / ${list.length}</h2>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-secondary bg-secondary-container/20 px-3 py-1 rounded-full flex items-center gap-1">
              <span class="material-symbols-outlined text-sm">local_fire_department</span> Chuỗi 12 ngày
            </span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
          <div class="bg-primary h-full rounded-full transition-all duration-300" style="width: ${progressPct}%;"></div>
        </div>

        <!-- 3D Card -->
        <div class="w-full perspective-1000 my-2">
          <div 
            id="main-flashcard" 
            onclick="App.flipFlashcard()" 
            class="flashcard w-full h-[350px] relative cursor-pointer transform-style-3d transition-transform duration-500 rounded-3xl"
          >
            <!-- Front -->
            <div class="flashcard-inner absolute inset-0 bg-surface-container-lowest rounded-3xl p-8 ambient-shadow border-2 border-primary/20 flex flex-col justify-between backface-hidden">
              <div class="flex justify-between items-center text-xs text-outline">
                <span class="font-bold text-primary uppercase">Mặt trước (Bấm để lật)</span>
                <span class="px-2.5 py-0.5 rounded-full bg-surface-container font-semibold">${currentWord.is_grammar ? 'Ngữ pháp' : 'Từ vựng'}</span>
              </div>
              <div class="text-center my-auto">
                <h1 class="font-display-lg text-4xl font-bold text-primary tracking-tight mb-2">${currentWord.word}</h1>
                <p class="font-mono text-base text-outline mb-4">${currentWord.ipa || ''}</p>
                <button onclick="event.stopPropagation(); App.speakWord('${currentWord.word}')" class="w-12 h-12 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-on-primary flex items-center justify-center transition-all shadow-sm mx-auto">
                  <span class="material-symbols-outlined text-2xl">volume_up</span>
                </button>
              </div>
              <div class="text-center text-xs text-outline">
                Nhấn Space hoặc bấm vào thẻ để xem nghĩa
              </div>
            </div>

            <!-- Back -->
            <div class="flashcard-inner absolute inset-0 bg-gradient-to-br from-surface-container-low to-surface-container-lowest rounded-3xl p-8 ambient-shadow border-2 border-secondary/40 flex flex-col justify-between backface-hidden rotate-y-180">
              <div class="flex justify-between items-center text-xs text-outline">
                <span class="font-bold text-secondary uppercase">Mặt sau (Giải nghĩa)</span>
                <button onclick="event.stopPropagation(); App.speakWord('${currentWord.word}')" class="text-primary hover:underline font-bold flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">volume_up</span> Nghe lại
                </button>
              </div>
              <div class="my-auto text-center">
                <h3 class="font-headline-md text-2xl font-bold text-on-surface mb-3">${currentWord.meaning}</h3>
                ${currentWord.example ? `
                  <div class="p-4 rounded-xl bg-surface-container border border-outline-variant/30 text-left">
                    <p class="text-xs font-bold text-outline uppercase mb-1">Ví dụ:</p>
                    <p class="font-body-md text-xs text-on-surface italic">"${currentWord.example}"</p>
                  </div>
                ` : ''}
              </div>
              <div class="text-center text-xs text-outline">
                Nhấn lần nữa để lật lại mặt trước
              </div>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="w-full flex items-center justify-between gap-4">
          <button onclick="App.prevFlashcard()" ${state.flashcardIndex === 0 ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-surface-container text-on-surface font-bold text-xs disabled:opacity-30">
            ← Trước
          </button>
          <div class="flex items-center gap-2">
            <button onclick="App.nextFlashcard(false)" class="px-5 py-2.5 rounded-xl bg-amber-100 text-amber-900 font-bold text-xs hover-lift">
              Cần ôn lại
            </button>
            <button onclick="App.nextFlashcard(true)" class="px-6 py-2.5 rounded-xl bg-green-600 text-white font-bold text-xs btn-press hover-lift">
              ✓ Đã thuộc
            </button>
          </div>
          <button onclick="App.nextFlashcard(false)" class="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs btn-press">
            Tiếp →
          </button>
        </div>
      </div>
    `;
  },

  // 7. Quiz View (NO HINTS, Prominent Back Button, 3 Formats, Instant Feedback & Audio)
  renderQuizView() {
    const questions = state.currentQuiz;
    const activeClass = state.classes.find(c => c.id === state.selectedClassId) || state.classes[0];

    if (questions.length === 0) {
      return `
        <div class="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <button onclick="App.safeGoBack('vocabulary')" class="mb-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold text-xs">
            <span class="material-symbols-outlined text-base">arrow_back</span> Về Kho Từ Vựng
          </button>
          <p class="font-bold">Chưa có bài thi nào đang chạy.</p>
          <button onclick="App.startNewQuiz(null, true)" class="mt-4 bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold text-xs btn-press">
            Bắt đầu Kiểm Tra Ngẫu Nhiên (3 Dạng)
          </button>
        </div>
      `;
    }

    const currentQ = questions[state.quizIndex];
    const mins = Math.floor(state.quizTimer / 60).toString().padStart(2, '0');
    const secs = (state.quizTimer % 60).toString().padStart(2, '0');

    return `
      <div class="flex-1 flex flex-col items-center max-w-3xl mx-auto w-full gap-stack-md">
        <!-- Top Status Bar -->
        <div class="w-full flex items-center justify-between bg-surface-container-lowest p-3.5 md:p-4 rounded-2xl ambient-shadow border border-outline-variant/30">
          <button onclick="App.safeGoBack('vocabulary')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs transition-all hover-lift">
            <span class="material-symbols-outlined text-base">arrow_back</span>
            <span>🏠 Về Lớp</span>
          </button>

          <div class="text-center">
            <span class="text-[11px] font-bold text-primary uppercase">${activeClass.name}</span>
            <h2 class="font-headline-md text-sm font-bold text-on-surface">Câu hỏi ${state.quizIndex + 1} / ${questions.length}</h2>
          </div>

          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary-container/20 text-secondary font-mono font-bold text-xs">
              <span class="material-symbols-outlined text-sm">timer</span>
              <span id="quiz-timer-display">${mins}:${secs}</span>
            </div>
          </div>
        </div>

        <!-- Question Card -->
        <div class="w-full bg-surface-container-lowest p-6 md:p-8 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col gap-5">
          
          <!-- Format Badge & Audio Speaker (NO HINTS, Prominent Back Button) -->
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <button onclick="App.safeGoBack('vocabulary')" class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs transition-all hover-lift" title="Quay lại danh sách từ vựng">
                <span class="material-symbols-outlined text-base">arrow_back</span>
                <span>Quay lại</span>
              </button>

              <span class="px-3 py-1 rounded-full text-xs font-bold ${
                currentQ.type === 'type_en' ? 'bg-blue-100 text-blue-800' :
                currentQ.type === 'type_vi' ? 'bg-purple-100 text-purple-800' :
                currentQ.is_grammar ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800'
              }">
                ${
                  currentQ.type === 'type_en' ? '✍️ Dạng bài: Điền từ Tiếng Anh' :
                  currentQ.type === 'type_vi' ? '🇻🇳 Dạng bài: Điền nghĩa Tiếng Việt' :
                  currentQ.is_grammar ? '📘 Cấu trúc Ngữ pháp (Trắc nghiệm)' : '🎯 Trắc nghiệm 4 Lựa chọn'
                }
              </span>
            </div>

            <!-- Only show Audio button if it won't spoil the answer (or when answered) -->
            ${(currentQ.type !== 'type_en' || currentQ.is_checked) ? `
              <button onclick="App.speakWord('${currentQ.word}')" class="w-9 h-9 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors" title="Phát âm từ vựng">
                <span class="material-symbols-outlined text-lg">volume_up</span>
              </button>
            ` : ''}
          </div>

          <!-- Question Prompt (Clean without hint text) -->
          <h3 class="font-headline-md text-lg md:text-xl font-bold text-on-surface leading-relaxed">
            ${currentQ.question}
          </h3>

          <!-- DẠNG 1: ĐIỀN TỪ TIẾNG ANH (type_en - NO HINTS) -->
          ${currentQ.type === 'type_en' ? `
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <input 
                  type="text" 
                  id="quiz-text-input"
                  autofocus
                  autocomplete="off"
                  ${currentQ.is_checked ? 'readonly' : ''}
                  value="${currentQ.user_answer || ''}"
                  placeholder="Gõ từ tiếng Anh vào đây..."
                  oninput="App.updateQuizTextInput(this.value)"
                  onkeydown="if(event.key==='Enter' && !App.state.currentQuiz[App.state.quizIndex].is_checked) App.checkCurrentQuestion();"
                  class="flex-1 px-4 py-3 text-base font-bold rounded-xl border-2 transition-all focus:outline-none ${
                    !currentQ.is_checked ? 'bg-surface-container-low border-outline-variant/40 focus:border-primary focus:bg-white text-primary' :
                    currentQ.is_correct ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-error text-error'
                  }"
                />
                ${!currentQ.is_checked ? `
                  <button onclick="App.checkCurrentQuestion()" class="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm btn-press">
                    Kiểm tra
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- DẠNG 2: ĐIỀN NGHĨA TIẾNG VIỆT (type_vi - NO HINTS) -->
          ${currentQ.type === 'type_vi' ? `
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <input 
                  type="text" 
                  id="quiz-text-input"
                  autofocus
                  autocomplete="off"
                  ${currentQ.is_checked ? 'readonly' : ''}
                  value="${currentQ.user_answer || ''}"
                  placeholder="Gõ nghĩa tiếng Việt vào đây..."
                  oninput="App.updateQuizTextInput(this.value)"
                  onkeydown="if(event.key==='Enter' && !App.state.currentQuiz[App.state.quizIndex].is_checked) App.checkCurrentQuestion();"
                  class="flex-1 px-4 py-3 text-base font-medium rounded-xl border-2 transition-all focus:outline-none ${
                    !currentQ.is_checked ? 'bg-surface-container-low border-outline-variant/40 focus:border-primary focus:bg-white text-on-surface' :
                    currentQ.is_correct ? 'bg-green-50 border-green-500 text-green-800 font-bold' : 'bg-red-50 border-error text-error font-bold'
                  }"
                />
                ${!currentQ.is_checked ? `
                  <button onclick="App.checkCurrentQuestion()" class="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm btn-press">
                    Kiểm tra
                  </button>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <!-- DẠNG 3: TRẮC NGHIỆM 4 ĐÁP ÁN (multiple_choice & Grammar Rule) -->
          ${currentQ.type === 'multiple_choice' ? `
            <div class="grid grid-cols-1 gap-2.5">
              ${currentQ.options.map((opt, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const isSelected = currentQ.user_answer === idx;
                const isCorrectOpt = idx === currentQ.correct_index;

                let optClass = 'border-outline-variant/40 bg-surface-container-low hover:border-primary/50 text-on-surface';
                let circleClass = 'bg-surface-container text-outline';

                if (currentQ.is_checked) {
                  if (isCorrectOpt) {
                    optClass = 'border-green-500 bg-green-50 text-green-900 font-bold';
                    circleClass = 'bg-green-600 text-white';
                  } else if (isSelected && !isCorrectOpt) {
                    optClass = 'border-error bg-red-50 text-error font-bold';
                    circleClass = 'bg-error text-white';
                  }
                } else if (isSelected) {
                  optClass = 'border-primary bg-primary/10 text-primary font-bold';
                  circleClass = 'bg-primary text-on-primary';
                }

                return `
                  <button 
                    onclick="App.selectQuizOption(${idx})" 
                    ${currentQ.is_checked ? 'disabled' : ''}
                    class="p-3.5 rounded-xl text-left border-2 transition-all flex items-center gap-3 ${optClass}"
                  >
                    <span class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${circleClass}">
                      ${letter}
                    </span>
                    <span class="text-xs font-medium flex-1">${opt}</span>
                    ${currentQ.is_checked && isCorrectOpt ? '<span class="material-symbols-outlined text-green-700">check_circle</span>' : ''}
                    ${currentQ.is_checked && isSelected && !isCorrectOpt ? '<span class="material-symbols-outlined text-error">cancel</span>' : ''}
                  </button>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- Instant Result & Explanation Card -->
          ${currentQ.is_checked ? `
            <div class="p-4 rounded-xl border ${currentQ.is_correct ? 'border-green-300 bg-green-50/70' : 'border-error/30 bg-red-50/70'} transition-all">
              <div class="flex items-center justify-between mb-2">
                <span class="font-bold text-sm ${currentQ.is_correct ? 'text-green-800' : 'text-error'} flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-lg">${currentQ.is_correct ? 'check_circle' : 'error'}</span>
                  ${currentQ.is_correct ? 'CHÍNH XÁC! (+10 ĐIỂM)' : 'CHƯA ĐÚNG!'}
                </span>
                <button onclick="App.speakWord('${currentQ.word}')" class="text-primary text-xs font-bold flex items-center gap-1 hover:underline">
                  <span class="material-symbols-outlined text-sm">volume_up</span> Nghe lại
                </button>
              </div>

              ${!currentQ.is_correct ? `
                <p class="text-xs text-on-surface mb-1">
                  <strong>Đáp án chuẩn:</strong> <span class="text-green-800 font-bold">${currentQ.correct_answer || currentQ.word}</span>
                </p>
              ` : ''}

              ${currentQ.explanation ? `
                <p class="text-xs text-on-surface-variant italic mt-1 bg-white/70 p-2.5 rounded-lg border border-outline-variant/20">
                  💡 <strong>Giải thích & Ví dụ:</strong> ${currentQ.explanation}
                </p>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Navigation Controls -->
        <div class="w-full flex items-center justify-between pt-2">
          <button onclick="App.prevQuizQuestion()" ${state.quizIndex === 0 ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-surface-container text-on-surface font-bold text-xs disabled:opacity-30">
            ← Câu trước
          </button>
          
          ${currentQ.is_checked ? (
            state.quizIndex < questions.length - 1 ? `
              <button id="quiz-next-btn" onclick="App.nextQuizQuestion()" class="bg-primary text-on-primary px-7 py-3 rounded-xl font-bold text-xs btn-press shadow-md hover-lift">
                Câu tiếp theo →
              </button>
            ` : `
              <button id="quiz-next-btn" onclick="App.submitQuiz()" class="bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-xs shadow-md btn-press flex items-center gap-1.5 hover-lift">
                <span class="material-symbols-outlined text-base">send</span> Hoàn thành & Xem kết quả
              </button>
            `
          ) : (
            currentQ.type === 'multiple_choice' ? `
              <span class="text-xs text-outline italic">Hãy chọn 1 đáp án để kiểm tra</span>
            ` : `
              <button onclick="App.checkCurrentQuestion()" class="bg-primary text-on-primary px-7 py-3 rounded-xl font-bold text-xs btn-press">
                Kiểm tra đáp án
              </button>
            `
          )}
        </div>
      </div>
    `;
  },

  // 8. Quiz Result View (with Back Button)
  renderQuizResultView() {
    const res = state.lastQuizResult;
    if (!res) {
      return `
        <div class="flex-1 flex flex-col items-center justify-center p-12 text-center">
          <p>Chưa có kết quả.</p>
          <button onclick="App.switchTab('dashboard')" class="mt-4 bg-primary text-on-primary px-5 py-2 rounded-xl font-bold text-xs">Về trang chủ</button>
        </div>
      `;
    }

    return `
      <div class="flex-1 flex flex-col items-center max-w-3xl mx-auto w-full gap-stack-lg">
        <!-- Top Nav -->
        <div class="w-full flex items-center justify-between">
          <button onclick="App.switchTab('vocabulary')" class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs transition-all hover-lift">
            <span class="material-symbols-outlined text-base">arrow_back</span>
            <span>🏠 Về Kho Từ Vựng Lớp</span>
          </button>
        </div>

        <div class="w-full text-center bg-surface-container-lowest p-8 rounded-2xl ambient-shadow border border-outline-variant/30">
          <div class="w-16 h-16 rounded-full ${res.score_percentage >= 80 ? 'bg-green-100 text-green-700' : 'bg-primary-container/20 text-primary'} mx-auto flex items-center justify-center text-3xl mb-3">
            ${res.score_percentage >= 80 ? '🎉' : '💪'}
          </div>
          <h2 class="font-display-lg text-2xl font-bold text-on-surface">
            ${res.score_percentage >= 80 ? 'Xuất Sắc! Chúc mừng em!' : 'Hoàn thành bài kiểm tra!'}
          </h2>
          <p class="text-xs text-on-surface-variant mt-1">Kết quả đã được ghi nhận vào cơ sở dữ liệu Supabase.</p>

          <div class="grid grid-cols-3 gap-3 mt-6 max-w-sm mx-auto">
            <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30">
              <p class="text-[11px] text-outline font-bold">ĐIỂM SỐ</p>
              <p class="font-display-lg text-xl font-bold text-primary mt-0.5">${res.score_percentage}%</p>
            </div>
            <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30">
              <p class="text-[11px] text-outline font-bold">ĐÚNG / TỔNG</p>
              <p class="font-display-lg text-xl font-bold text-green-700 mt-0.5">${res.correct_count}/${res.total_questions}</p>
            </div>
            <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/30">
              <p class="text-[11px] text-outline font-bold">THỜI GIAN</p>
              <p class="font-display-lg text-xl font-bold text-secondary mt-0.5">${res.duration_seconds}s</p>
            </div>
          </div>

          <div class="flex items-center justify-center gap-3 mt-6">
            <button onclick="App.startNewQuiz(null, true)" class="bg-secondary-container text-on-secondary-container px-5 py-2.5 rounded-xl font-bold text-xs hover-lift">
              Thi Ngẫu Nhiên Lại (3 Dạng)
            </button>
            <button onclick="App.switchTab('flashcards')" class="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold text-xs btn-press">
              Ôn Lại Flashcard
            </button>
          </div>
        </div>

        <div class="w-full bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30">
          <h3 class="font-headline-md text-base font-bold text-on-surface mb-4">Chi tiết từng câu & Lời giải thích</h3>
          <div class="space-y-3">
            ${res.details.map((d, i) => `
              <div class="p-4 rounded-xl border ${d.is_correct ? 'border-green-300 bg-green-50/40' : 'border-error/30 bg-error-container/10'} text-xs">
                <div class="flex items-center justify-between mb-1.5">
                  <span class="font-bold ${d.is_correct ? 'text-green-800' : 'text-error'}">
                    ${d.is_correct ? '✓ ĐÚNG' : '✗ CHƯA ĐÚNG'}
                  </span>
                  <span class="text-outline">Câu ${i + 1}</span>
                </div>
                <p class="font-bold text-sm text-on-surface mb-2">${d.question}</p>
                <p><span class="font-semibold">Bạn chọn/nhập:</span> <span class="${d.is_correct ? 'text-green-700 font-bold' : 'text-error font-bold'}">${d.user_answer}</span></p>
                ${!d.is_correct ? `<p><span class="font-semibold text-green-800">Đáp án đúng:</span> <span class="text-green-800 font-bold">${d.correct_answer}</span></p>` : ''}
                ${d.explanation ? `<p class="italic mt-2 text-on-surface bg-white/80 p-2.5 rounded border border-outline-variant/20">💡 <strong>Giải thích:</strong> ${d.explanation}</p>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  // 9. Reports View (Comprehensive Class Overview & Individual Student Drill-Down)
  renderReportsView() {
    const isStudent = state.currentUser?.role === 'student';
    const targetClassId = isStudent ? Number(state.currentUser.class_id || 1) : Number(state.selectedClassId);
    const activeClass = state.classes.find(c => c.id === targetClassId) || state.classes[0] || { name: "Lớp học" };
    
    // Students in this class
    const classStudents = state.usersList.filter(u => u.role === 'student' && u.class_id === targetClassId);
    
    // Compute student metrics
    const studentMetrics = classStudents.map(st => {
      const sessions = state.testSessions.filter(s => 
        s.user_id === st.id || 
        (st.username === 'an_nguyen' && s.user_id === '00000000-0000-0000-0000-000000000002')
      );
      const totalTests = sessions.length;
      const avgScore = totalTests > 0 ? Math.round(sessions.reduce((acc, s) => acc + (s.score_percentage || 0), 0) / totalTests) : 0;
      const maxScore = totalTests > 0 ? Math.max(...sessions.map(s => s.score_percentage || 0)) : 0;
      const totalCorrect = sessions.reduce((acc, s) => acc + (s.correct_count || 0), 0);
      const totalQuestions = sessions.reduce((acc, s) => acc + (s.total_questions || 0), 0);
      const avgDuration = totalTests > 0 ? Math.round(sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / totalTests) : 0;

      let evalLabel = "Chưa làm bài";
      let evalClass = "bg-surface-container text-outline border-outline-variant/30";
      if (totalTests > 0) {
        if (avgScore >= 90) {
          evalLabel = "Xuất sắc (9.0+)";
          evalClass = "bg-green-100 text-green-900 border-green-300 font-bold";
        } else if (avgScore >= 80) {
          evalLabel = "Giỏi (8.0 - 8.9)";
          evalClass = "bg-blue-100 text-blue-900 border-blue-300 font-bold";
        } else if (avgScore >= 65) {
          evalLabel = "Khá (6.5 - 7.9)";
          evalClass = "bg-amber-100 text-amber-900 border-amber-300 font-bold";
        } else {
          evalLabel = "Cần cố gắng (<6.5)";
          evalClass = "bg-red-100 text-red-900 border-red-300 font-bold";
        }
      }

      return {
        student: st,
        sessions,
        totalTests,
        avgScore,
        maxScore,
        totalCorrect,
        totalQuestions,
        avgDuration,
        evalLabel,
        evalClass
      };
    });

    // If active user is student, lock view directly to their own report
    const effectiveSelectedStudentId = isStudent 
      ? state.currentUser.id 
      : state.selectedReportStudentId;

    // -------------------------------------------------------------
    // CHẾ ĐỘ 1: XEM CHI TIẾT BÁO CÁO CỦA MỘT HỌC SINH CỤ THỂ
    // -------------------------------------------------------------
    if (effectiveSelectedStudentId) {
      let selectedMetric = studentMetrics.find(m => m.student.id === effectiveSelectedStudentId || m.student.username === effectiveSelectedStudentId);
      
      // Fallback if not found in current class list
      if (!selectedMetric) {
        const foundUser = state.usersList.find(u => u.id === effectiveSelectedStudentId);
        if (foundUser) {
          selectedMetric = {
            student: foundUser,
            sessions: state.testSessions.filter(s => s.user_id === foundUser.id || (foundUser.username === 'an_nguyen' && s.user_id === '00000000-0000-0000-0000-000000000002')),
            totalTests: 0,
            avgScore: 0,
            maxScore: 0,
            totalCorrect: 0,
            totalQuestions: 0,
            avgDuration: 0,
            evalLabel: "Chưa có bài thi",
            evalClass: "bg-surface-container text-outline"
          };
        }
      }

      if (!selectedMetric) {
        return `
          <div class="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <p class="text-on-surface font-bold">Không tìm thấy thông tin học sinh.</p>
            <button onclick="App.selectReportStudent(null)" class="mt-3 bg-primary text-on-primary px-4 py-2 rounded-xl text-xs font-bold">
              ← Quay lại danh sách lớp
            </button>
          </div>
        `;
      }

      const st = selectedMetric.student;
      const sList = selectedMetric.sessions;

      return `
        <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
          
          <!-- Navigation & Quick Switcher -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              ${!isStudent ? `
                <button onclick="App.selectReportStudent(null)" class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs transition-all hover-lift">
                  <span class="material-symbols-outlined text-base">arrow_back</span>
                  <span>← Danh sách cả lớp</span>
                </button>
              ` : ''}
              <div>
                <span class="text-xs font-bold text-primary uppercase tracking-wider">Hồ Sơ Năng Lực Học Sinh</span>
                <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">${st.full_name}</h2>
              </div>
            </div>

            <div class="flex items-center gap-3 flex-wrap">
              ${!isStudent ? `
                <select 
                  onchange="App.selectReportStudent(this.value || null)"
                  class="py-2.5 px-3 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs font-bold text-primary focus:outline-none"
                >
                  <option value="">-- Chuyển sang học sinh khác --</option>
                  ${classStudents.map(cs => `
                    <option value="${cs.id}" ${cs.id === effectiveSelectedStudentId ? 'selected' : ''}>
                      ${cs.full_name} (@${cs.username})
                    </option>
                  `).join('')}
                </select>
              ` : ''}
              
              <button onclick="App.exportCurrentStudentExcel('${st.id}')" class="bg-surface-container text-on-surface hover:bg-surface-container-high px-4 py-2.5 rounded-xl font-bold text-xs border border-outline-variant/40 flex items-center gap-1.5 transition-colors">
                <span class="material-symbols-outlined text-sm">download</span> Xuất Báo Cáo Excel
              </button>
            </div>
          </div>

          <!-- Student Profile & KPI Summary -->
          <div class="bg-surface-container-lowest p-6 md:p-8 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div class="flex items-center gap-4">
              <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary flex items-center justify-center text-2xl font-bold shadow-md">
                ${st.full_name.charAt(0)}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-headline-md text-lg font-bold text-on-surface">${st.full_name}</h3>
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${selectedMetric.evalClass}">
                    ${selectedMetric.evalLabel}
                  </span>
                </div>
                <p class="text-xs text-outline font-mono mt-0.5">Username: <strong>@${st.username}</strong> • Lớp: <strong>${activeClass.name}</strong></p>
                <div class="flex items-center gap-3 text-xs text-on-surface-variant mt-2">
                  <span class="flex items-center gap-1 text-secondary font-bold">
                    <span class="material-symbols-outlined text-sm">local_fire_department</span> Chuỗi ${st.streak || 12} ngày
                  </span>
                  <span>•</span>
                  <span>Mục tiêu vào 10: <strong class="text-primary">9.0+ Điểm</strong></span>
                </div>
              </div>
            </div>

            <!-- 4 Quick Stats -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
              <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center min-w-[100px]">
                <p class="text-[10px] text-outline font-bold uppercase">Lượt Thi Đã Nộp</p>
                <p class="font-display-lg text-xl font-bold text-primary mt-0.5">${selectedMetric.totalTests} <span class="text-[10px] font-normal text-outline">bài</span></p>
              </div>

              <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center min-w-[100px]">
                <p class="text-[10px] text-outline font-bold uppercase">Điểm Trung Bình</p>
                <p class="font-display-lg text-xl font-bold text-on-surface mt-0.5">${selectedMetric.avgScore}%</p>
              </div>

              <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center min-w-[100px]">
                <p class="text-[10px] text-outline font-bold uppercase">Điểm Cao Nhất</p>
                <p class="font-display-lg text-xl font-bold text-green-700 mt-0.5">${selectedMetric.maxScore}%</p>
              </div>

              <div class="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center min-w-[100px]">
                <p class="text-[10px] text-outline font-bold uppercase">Thời Gian TB</p>
                <p class="font-display-lg text-xl font-bold text-secondary mt-0.5">${selectedMetric.avgDuration}s</p>
              </div>
            </div>
          </div>

          <!-- Format Competency Analysis -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            <div class="bg-surface-container-lowest p-5 rounded-2xl ambient-shadow border border-outline-variant/30">
              <div class="flex items-center justify-between mb-2">
                <span class="font-bold text-xs text-on-surface flex items-center gap-1.5">
                  <span class="w-3 h-3 rounded-full bg-blue-500"></span> Điền Từ Tiếng Anh (type_en)
                </span>
                <span class="font-bold text-xs text-primary">${Math.min(100, selectedMetric.avgScore > 0 ? selectedMetric.avgScore + 2 : 88)}%</span>
              </div>
              <div class="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mb-2">
                <div class="bg-primary h-full rounded-full" style="width: ${Math.min(100, selectedMetric.avgScore > 0 ? selectedMetric.avgScore + 2 : 88)}%;"></div>
              </div>
              <p class="text-[11px] text-outline">Kỹ năng chính tả & nhớ từ vựng tiếng Anh trực tiếp.</p>
            </div>

            <div class="bg-surface-container-lowest p-5 rounded-2xl ambient-shadow border border-outline-variant/30">
              <div class="flex items-center justify-between mb-2">
                <span class="font-bold text-xs text-on-surface flex items-center gap-1.5">
                  <span class="w-3 h-3 rounded-full bg-purple-500"></span> Điền Nghĩa Tiếng Việt (type_vi)
                </span>
                <span class="font-bold text-xs text-purple-700">${Math.min(100, selectedMetric.avgScore > 0 ? selectedMetric.avgScore + 5 : 92)}%</span>
              </div>
              <div class="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mb-2">
                <div class="bg-purple-600 h-full rounded-full" style="width: ${Math.min(100, selectedMetric.avgScore > 0 ? selectedMetric.avgScore + 5 : 92)}%;"></div>
              </div>
              <p class="text-[11px] text-outline">Kỹ năng hiểu nghĩa và ngữ cảnh dịch thuật.</p>
            </div>

            <div class="bg-surface-container-lowest p-5 rounded-2xl ambient-shadow border border-outline-variant/30">
              <div class="flex items-center justify-between mb-2">
                <span class="font-bold text-xs text-on-surface flex items-center gap-1.5">
                  <span class="w-3 h-3 rounded-full bg-green-500"></span> Trắc Nghiệm & Ngữ Pháp
                </span>
                <span class="font-bold text-xs text-green-700">${Math.min(100, selectedMetric.avgScore > 0 ? selectedMetric.avgScore - 3 : 85)}%</span>
              </div>
              <div class="w-full bg-surface-container-high h-2 rounded-full overflow-hidden mb-2">
                <div class="bg-green-600 h-full rounded-full" style="width: ${Math.min(100, selectedMetric.avgScore > 0 ? selectedMetric.avgScore - 3 : 85)}%;"></div>
              </div>
              <p class="text-[11px] text-outline">Phản xạ chọn đáp án và áp dụng cấu trúc câu vào 10.</p>
            </div>
          </div>

          <!-- Individual Test History Table -->
          <div class="bg-surface-container-lowest rounded-2xl ambient-shadow border border-outline-variant/30 overflow-hidden">
            <div class="p-5 border-b border-outline-variant/30 flex items-center justify-between">
              <div>
                <h3 class="font-headline-md text-base font-bold text-on-surface">Lịch Sử Làm Bài Kiểm Tra (${sList.length} phiên thi)</h3>
                <p class="text-xs text-on-surface-variant">Bấm "Xem lại bài thi" để kiểm tra các câu đúng, câu sai và lời giải của Thầy Quang Sơn.</p>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-surface-container-low text-outline uppercase font-bold border-b border-outline-variant/30">
                  <tr>
                    <th class="p-4 w-12 text-center">STT</th>
                    <th class="p-4">Mã Phiên Thi</th>
                    <th class="p-4">Dạng Bài Thi</th>
                    <th class="p-4">Số Câu Đúng / Tổng</th>
                    <th class="p-4">Điểm Số (%)</th>
                    <th class="p-4">Thời Lượng</th>
                    <th class="p-4">Thời Điểm Nộp</th>
                    <th class="p-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-outline-variant/20">
                  ${sList.length > 0 ? sList.map((s, idx) => `
                    <tr class="hover:bg-surface-container-low/50 transition-colors">
                      <td class="p-4 text-center font-bold text-outline">${idx + 1}</td>
                      <td class="p-4 font-mono font-bold text-primary">#TEST-${s.id}</td>
                      <td class="p-4 text-on-surface font-medium">
                        ${s.session_type === 'lesson_based' ? `Chuyên đề Unit #${s.test_scope?.lesson_id || 1}` : 'Kiểm tra 3 dạng ngẫu nhiên'}
                      </td>
                      <td class="p-4">
                        <span class="text-green-700 font-bold">${s.correct_count} đúng</span> / <span class="text-error font-medium">${s.wrong_count} sai</span>
                      </td>
                      <td class="p-4">
                        <span class="px-2.5 py-1 rounded-full font-bold text-[11px] ${
                          s.score_percentage >= 80 ? 'bg-green-100 text-green-900 border border-green-300' :
                          s.score_percentage >= 65 ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-red-100 text-red-900 border border-red-300'
                        }">
                          ${s.score_percentage}%
                        </span>
                      </td>
                      <td class="p-4 text-outline font-mono">${s.duration_seconds}s</td>
                      <td class="p-4 text-on-surface-variant">${new Date(s.created_at).toLocaleString('vi-VN')}</td>
                      <td class="p-4 text-center">
                        <button onclick="App.openSessionDetailsModal(${s.id})" class="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-on-primary font-bold text-[11px] transition-colors flex items-center gap-1 mx-auto">
                          <span class="material-symbols-outlined text-sm">visibility</span> Xem lại bài thi
                        </button>
                      </td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="8" class="p-8 text-center text-outline text-xs">
                        Học sinh này chưa thực hiện bài kiểm tra nào trong hệ thống.
                      </td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    // -------------------------------------------------------------
    // CHẾ ĐỘ 2: BẢNG TỔNG QUAN CẢ LỚP & DANH SÁCH TẤT CẢ HỌC SINH
    // -------------------------------------------------------------
    const totalClassTests = studentMetrics.reduce((acc, m) => acc + m.totalTests, 0);
    const avgClassScore = studentMetrics.length > 0 && totalClassTests > 0
      ? Math.round(studentMetrics.reduce((acc, m) => acc + (m.avgScore * m.totalTests), 0) / totalClassTests)
      : 86;
    const topStudent = studentMetrics.length > 0
      ? studentMetrics.reduce((prev, curr) => (curr.avgScore > prev.avgScore ? curr : prev), studentMetrics[0])
      : null;
    const targetAchievedCount = studentMetrics.filter(m => m.avgScore >= 90).length;
    const targetPercentage = studentMetrics.length > 0 ? Math.round((targetAchievedCount / studentMetrics.length) * 100) : 0;

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 text-primary font-bold text-xs mb-1">
              <span class="material-symbols-outlined text-base">analytics</span>
              <span>BÁO CÁO TIẾN ĐỘ & NĂNG LỰC HỌC TẬP</span>
            </div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">Báo Cáo Học Sinh - ${activeClass.name}</h2>
            <p class="font-body-md text-sm text-on-surface-variant">Theo dõi kết quả ôn thi vào 10 và xem báo cáo chi tiết của từng học sinh.</p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <select 
              onchange="App.selectClass(this.value)"
              class="py-2.5 px-3.5 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs font-bold text-primary focus:outline-none"
            >
              ${state.classes.map(c => `<option value="${c.id}" ${c.id === state.selectedClassId ? 'selected' : ''}>Lớp: ${c.name}</option>`).join('')}
            </select>

            <button onclick="App.ExcelService.exportTestResults(state.testSessions)" class="bg-surface-container text-on-surface px-4 py-2.5 rounded-xl font-bold text-xs border border-outline-variant/40 flex items-center gap-1.5 hover:bg-surface-container-high">
              <span class="material-symbols-outlined text-sm">download</span> Xuất Báo Cáo Lớp
            </button>
          </div>
        </div>

        <!-- Bento Class KPI Stats -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
            <div class="flex justify-between items-start mb-3">
              <div class="w-12 h-12 rounded-xl bg-primary-container/15 flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-2xl">assignment_turned_in</span>
              </div>
              <span class="bg-surface-container-highest text-primary font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">Toàn lớp</span>
            </div>
            <h3 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Tổng Lượt Bài Thi</h3>
            <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">${totalClassTests} <span class="text-xs font-normal text-outline">bài</span></p>
          </div>

          <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
            <div class="flex justify-between items-start mb-3">
              <div class="w-12 h-12 rounded-xl bg-secondary-container/15 flex items-center justify-center text-secondary">
                <span class="material-symbols-outlined text-2xl">grade</span>
              </div>
              <span class="bg-surface-container-highest text-secondary font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">Mục tiêu 9.0</span>
            </div>
            <h3 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Điểm Trung Bình Lớp</h3>
            <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">${avgClassScore}%</p>
          </div>

          <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
            <div class="flex justify-between items-start mb-3">
              <div class="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center text-green-700">
                <span class="material-symbols-outlined text-2xl">trophy</span>
              </div>
              <span class="bg-green-100 text-green-800 font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">Dẫn đầu</span>
            </div>
            <h3 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Học Sinh Dẫn Đầu</h3>
            <p class="font-display-lg text-base font-bold text-on-surface mt-1 truncate">${topStudent ? topStudent.student.full_name : 'Chưa có'}</p>
          </div>

          <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
            <div class="flex justify-between items-start mb-3">
              <div class="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-800">
                <span class="material-symbols-outlined text-2xl">target</span>
              </div>
              <span class="bg-amber-100 text-amber-800 font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">Kỳ vọng</span>
            </div>
            <h3 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Tỷ Lệ Đạt Điểm 9.0+</h3>
            <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">${targetPercentage}%</p>
          </div>
        </div>

        <!-- Student Performance Leaderboard Table -->
        <div class="bg-surface-container-lowest rounded-2xl ambient-shadow border border-outline-variant/30 overflow-hidden">
          <div class="p-5 border-b border-outline-variant/30 flex items-center justify-between">
            <div>
              <h3 class="font-headline-md text-base font-bold text-on-surface">Bảng Đánh Giá Năng Lực Từng Học Sinh (${studentMetrics.length} học sinh)</h3>
              <p class="text-xs text-on-surface-variant">Bấm nút "Xem chi tiết" ở mỗi dòng để xem lịch sử làm bài và năng lực từng dạng bài của học sinh đó.</p>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="bg-surface-container-low text-outline uppercase font-bold border-b border-outline-variant/30">
                <tr>
                  <th class="p-4 w-12 text-center">STT</th>
                  <th class="p-4">Họ và Tên Học Sinh</th>
                  <th class="p-4">Tên Đăng Nhập</th>
                  <th class="p-4 text-center">Số Bài Thi</th>
                  <th class="p-4 text-center">Điểm TB</th>
                  <th class="p-4 text-center">Điểm Cao Nhất</th>
                  <th class="p-4 text-center">Chuỗi Học</th>
                  <th class="p-4 text-center">Đánh Giá Năng Lực</th>
                  <th class="p-4 text-center">Báo Cáo</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-outline-variant/20">
                ${studentMetrics.length > 0 ? studentMetrics.map((m, idx) => `
                  <tr class="hover:bg-surface-container-low/50 transition-colors">
                    <td class="p-4 text-center font-bold text-outline">${idx + 1}</td>
                    <td class="p-4 font-bold text-on-surface flex items-center gap-2.5">
                      <div class="w-7 h-7 rounded-full bg-green-100 text-green-900 flex items-center justify-center text-xs font-bold">
                        ${m.student.full_name.charAt(0)}
                      </div>
                      <span>${m.student.full_name}</span>
                    </td>
                    <td class="p-4 font-mono font-bold text-primary">@${m.student.username}</td>
                    <td class="p-4 text-center font-semibold">${m.totalTests} bài</td>
                    <td class="p-4 text-center font-bold text-primary text-sm">${m.avgScore}%</td>
                    <td class="p-4 text-center font-bold text-green-700">${m.maxScore}%</td>
                    <td class="p-4 text-center text-secondary font-bold">🔥 ${m.student.streak || 12} ngày</td>
                    <td class="p-4 text-center">
                      <span class="px-2.5 py-1 rounded-full font-bold text-[11px] border ${m.evalClass}">
                        ${m.evalLabel}
                      </span>
                    </td>
                    <td class="p-4 text-center">
                      <button onclick="App.selectReportStudent('${m.student.id}')" class="bg-primary text-on-primary hover:bg-primary-container px-3 py-1.5 rounded-lg font-bold text-[11px] btn-press flex items-center gap-1 mx-auto transition-colors shadow-sm">
                        <span class="material-symbols-outlined text-sm">visibility</span> Xem Chi Tiết
                      </button>
                    </td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="9" class="p-8 text-center text-outline text-xs">
                      Chưa có học sinh nào được phân công vào lớp này.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // 10. AI Tutor Chat View (with Pedagogic Prompt & Rich Formatting)
  renderTutorView() {
    return `
      <div class="flex-1 flex flex-col max-w-3xl mx-auto w-full h-[650px] bg-surface-container-lowest rounded-2xl ambient-shadow border border-outline-variant/30 overflow-hidden">
        <!-- Top Chat Header with Back Button -->
        <div class="p-4 bg-primary text-on-primary flex items-center justify-between shadow-sm">
          <div class="flex items-center gap-3">
            <button onclick="App.safeGoBack('dashboard')" class="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors" title="Về Menu">
              <span class="material-symbols-outlined text-lg">arrow_back</span>
            </button>
            <div class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold">
              <span class="material-symbols-outlined">psychology</span>
            </div>
            <div>
              <h3 class="font-headline-md text-sm font-bold">Gia Sư AI - Thầy Quang Sơn</h3>
              <p class="text-[11px] text-white/80">Luyện thi Tiếng Anh vào 10 (Chuẩn Sư Phạm • Gemini API)</p>
            </div>
          </div>
          <span class="px-2.5 py-0.5 bg-green-500 text-white rounded-full text-[10px] font-bold">Online</span>
        </div>

        <!-- Chat Messages Container -->
        <div id="tutor-chat-messages" class="flex-1 p-5 overflow-y-auto space-y-3 bg-[#F8FAFC]">
          ${state.chatMessages.map(m => `
            <div class="flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}">
              ${m.sender === 'bot' ? `<div class="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold shrink-0">QS</div>` : ''}
              <div class="max-w-md p-4 rounded-2xl text-xs leading-relaxed ${
                m.sender === 'user' 
                  ? 'bg-primary text-on-primary rounded-tr-none' 
                  : 'bg-surface-container-lowest text-on-surface rounded-tl-none border border-outline-variant/30 shadow-sm'
              }">
                ${formatMarkdown(m.text)}
              </div>
            </div>
          `).join('')}

          <!-- Typing Indicator -->
          ${state.isTutorTyping ? `
            <div class="flex gap-2.5 justify-start">
              <div class="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold shrink-0">QS</div>
              <div class="p-3.5 rounded-2xl bg-surface-container-lowest text-xs text-outline border border-outline-variant/30 rounded-tl-none flex items-center gap-2 shadow-sm">
                <span class="material-symbols-outlined animate-spin text-sm text-primary">sync</span>
                <span>Thầy Quang Sơn đang soạn câu trả lời chi tiết...</span>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Input Form -->
        <form onsubmit="App.sendTutorMessage(event)" class="p-3 bg-surface-container-lowest border-t border-outline-variant/30 flex items-center gap-2">
          <input 
            type="text" 
            id="tutor-chat-input"
            ${state.isTutorTyping ? 'disabled' : ''}
            placeholder="Hỏi thầy về từ vựng, ngữ pháp hoặc các dạng bài thi vào 10..." 
            class="flex-1 px-4 py-2.5 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs focus:outline-none focus:border-primary disabled:opacity-50"
          />
          <button 
            type="submit" 
            ${state.isTutorTyping ? 'disabled' : ''}
            class="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs btn-press disabled:opacity-50 flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-sm">send</span> Gửi
          </button>
        </form>
      </div>
    `;
  },

  // 11. Settings View
  renderSettingsView() {
    const user = state.currentUser;
    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <div>
          <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">Cài đặt & Tài khoản Cá nhân</h2>
          <p class="font-body-md text-sm text-on-surface-variant">Quản lý bảo mật tài khoản và thông tin hệ thống.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          
          <!-- User Profile & Password Change Card -->
          <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 space-y-4">
            <h3 class="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-primary">badge</span> Tài khoản của bạn
            </h3>
            <div class="space-y-2 text-xs">
              <p><span class="font-bold text-outline">Họ và tên:</span> ${user.full_name}</p>
              <p><span class="font-bold text-outline">Tên đăng nhập:</span> @${user.username}</p>
              <p><span class="font-bold text-outline">Vai trò:</span> ${user.role === 'host' ? 'Quản trị viên (Host)' : user.role === 'assistant_teacher' ? 'Giáo viên phụ' : 'Học sinh'}</p>
            </div>
            <div class="pt-3 border-t border-outline-variant/30">
              <button onclick="App.openChangeMyPasswordModal()" class="w-full bg-primary text-on-primary py-2.5 rounded-xl font-bold text-xs btn-press flex items-center justify-center gap-1.5 hover-lift">
                <span class="material-symbols-outlined text-base">key</span> Đổi Mật Khẩu Của Bạn
              </button>
            </div>
          </div>

          <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 space-y-3">
            <h3 class="font-headline-md text-base font-bold text-on-surface flex items-center gap-2">
              <span class="material-symbols-outlined text-green-700">security</span> Bảo mật & Phiên làm việc
            </h3>
            <div class="space-y-2 text-xs">
              <p class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-green-500"></span> <strong>Bản quyền:</strong> ${CONFIG.BRAND.FOOTER_COPYRIGHT}</p>
              <p class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-green-500"></span> <strong>Phiên đăng nhập:</strong> Lưu vào Cookies 30 ngày</p>
              <p class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-green-500"></span> <strong>Phân quyền:</strong> ${user.role === 'student' ? 'Giới hạn trong Lớp học cá nhân' : 'Quyền Quản trị viên'}</p>
            </div>
            <div class="pt-3 border-t border-outline-variant/30">
              <button onclick="App.handleLogout()" class="w-full bg-error text-on-error py-2.5 rounded-xl font-bold text-xs btn-press flex items-center justify-center gap-1.5 hover:bg-red-700">
                <span class="material-symbols-outlined text-base">logout</span> Đăng Xuất Khỏi Hệ Thống
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

// Initialize on DOM Ready
if (typeof document !== "undefined") {
  document.addEventListener('DOMContentLoaded', () => {
    window.App.init();
  });
}
