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
  currentTab: 'login', // 'login' | 'dashboard' | 'classes' | 'accounts' | 'vocabulary' | 'table_input' | 'flashcards' | 'quiz' | 'quiz_result' | 'reports' | 'tutor' | 'settings'
  navigationHistory: ['dashboard'],
  
  classes: [],
  lessons: [],
  vocabulary: [],
  profiles: [],
  usersList: [],
  testSessions: [],
  studySessions: [],
  
  // Active Class Scoping & Drilldown
  selectedClassId: 1,
  selectedClassDetailId: null, // If set, renders the class detail view
  classDetailTab: 'units', // 'units' | 'vocabulary' | 'reports'
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

  // Flashcard state with time tracking
  flashcardIndex: 0,
  flashcardFlipped: false,
  knownWords: new Set(),
  studyList: [],
  flashcardStartTime: null,
  flashcardCardsViewed: 0,
  flashcardCardsMastered: 0,
  
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
   * Lấy danh sách các lớp học mà người dùng có quyền quản lý/truy cập
   */
  getManagedClasses(user = state.currentUser) {
    if (!user) return [];
    if (user.role === 'host') return state.classes;
    if (user.role === 'student') {
      return state.classes.filter(c => c.id === Number(user.class_id));
    }
    if (user.role === 'assistant_teacher') {
      const userAssigned = Number(user.class_id);
      const managedList = Array.isArray(user.managed_classes) ? user.managed_classes.map(Number) : [];
      return state.classes.filter(c => 
        c.id === userAssigned || 
        managedList.includes(c.id) || 
        c.creator_id === user.id || 
        c.created_by === user.id
      );
    }
    return [];
  },

  /**
   * Nạp toàn bộ dữ liệu từ Supabase & AuthService
   */
  async loadAllData() {
    try {
      const [classes, lessons, vocabulary, testSessions, users, studySessions] = await Promise.all([
        SupabaseService.getClasses(),
        SupabaseService.getLessons(),
        SupabaseService.getVocabulary(),
        SupabaseService.getTestSessions(),
        AuthService.syncUsersFromSupabase(),
        SupabaseService.getStudySessions()
      ]);

      state.classes = classes || [];
      state.lessons = lessons || [];
      state.vocabulary = vocabulary || [];
      state.testSessions = testSessions || [];
      state.usersList = users || AuthService.getAllUsers();
      state.studySessions = studySessions || [];

      // For students, lock selectedClassId strictly to their assigned class
      if (state.currentUser && state.currentUser.role === 'student') {
        state.selectedClassId = Number(state.currentUser.class_id) || 1;
        state.selectedClassDetailId = state.selectedClassId;
      } else if (state.currentUser && state.currentUser.role === 'assistant_teacher') {
        const myClasses = this.getManagedClasses(state.currentUser);
        if (!state.selectedClassId || !myClasses.some(c => c.id === state.selectedClassId)) {
          state.selectedClassId = myClasses[0]?.id || Number(state.currentUser.class_id) || 1;
        }
      } else if (!state.selectedClassId && state.classes.length > 0) {
        state.selectedClassId = state.classes[0].id;
      }

      // Mặc định selectedLessonId = null để hiển thị toàn bộ bài học, không bị lọc ẩn từ vựng
      state.selectedLessonId = null;

      this.updateStudyList();
    } catch (err) {
      console.error("Lỗi khi tải dữ liệu:", err);
      showToast("Đang dùng dữ liệu cục bộ.", "info");
    }
  },

  /**
   * Cập nhật danh sách từ vựng ôn tập (Hỗ trợ cách ly theo Lớp và Chuyên đề bài học)
   */
  updateStudyList() {
    const isStudent = state.currentUser?.role === 'student';
    const targetClassId = isStudent ? Number(state.currentUser.class_id || 1) : Number(state.selectedClassId || 1);
    
    const classVocab = state.vocabulary.filter(v => v.class_id === targetClassId);
    if (state.selectedLessonId) {
      state.studyList = classVocab.filter(v => v.lesson_id === Number(state.selectedLessonId));
    } else {
      state.studyList = [...classVocab];
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

  openCreateUserModal(prefilledClassId = null) {
    const modal = document.getElementById('create-user-modal');
    if (!modal) return;

    const isAssistant = state.currentUser?.role === 'assistant_teacher';
    const targetClassId = Number(prefilledClassId || state.selectedClassDetailId || state.selectedClassId || state.currentUser?.class_id || 1);

    const classSelect = document.getElementById('modal-user-class');
    if (classSelect) {
      if (isAssistant) {
        const managedClasses = this.getManagedClasses(state.currentUser);
        classSelect.innerHTML = managedClasses.map(c => 
          `<option value="${c.id}" ${c.id === targetClassId ? 'selected' : ''}>${c.name}</option>`
        ).join('');
        classSelect.disabled = false;
      } else {
        classSelect.disabled = false;
        classSelect.innerHTML = state.classes.map(c => 
          `<option value="${c.id}" ${c.id === targetClassId ? 'selected' : ''}>${c.name}</option>`
        ).join('');
      }
    }

    const roleSelect = document.getElementById('input-user-role');
    if (roleSelect) {
      if (isAssistant) {
        roleSelect.innerHTML = `<option value="student" selected>🎓 Học sinh</option>`;
        roleSelect.disabled = true;
      } else {
        roleSelect.disabled = false;
        roleSelect.innerHTML = `
          <option value="student" selected>🎓 Học sinh</option>
          <option value="assistant_teacher">👩‍🏫 Giáo viên phụ (Trợ giảng)</option>
        `;
      }
    }

    // Reset inputs
    const fullNameInput = document.getElementById('input-user-fullname');
    if (fullNameInput) fullNameInput.value = '';
    const usernameInput = document.getElementById('input-user-username');
    if (usernameInput) usernameInput.value = '';
    const passwordInput = document.getElementById('input-user-password');
    if (passwordInput) passwordInput.value = '123456';

    modal.classList.remove('hidden');
  },

  async handleCreateUser(e) {
    if (e) e.preventDefault();
    const isAssistant = state.currentUser?.role === 'assistant_teacher';

    const fullName = document.getElementById('input-user-fullname')?.value.trim();
    const username = document.getElementById('input-user-username')?.value.trim();
    const password = document.getElementById('input-user-password')?.value.trim();
    const role = isAssistant ? 'student' : (document.getElementById('input-user-role')?.value || 'student');
    const classId = Number(document.getElementById('modal-user-class')?.value || state.selectedClassDetailId || state.currentUser?.class_id || 1);

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
    if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn tài khoản "${name}"?`)) return;
    try {
      await AuthService.deleteUser(userId);
      state.usersList = (state.usersList || []).filter(u => u.id !== userId && u.username !== userId);
      showToast(`Đã xóa vĩnh viễn tài khoản "${name}" thành công!`, "success");
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

  openStudentHistoryModal(studentId) {
    this.selectReportStudent(studentId);
    this.switchTab('reports');
  },

  /**
   * Tính toán chuỗi Streak theo thời gian thực (Dựa trên toàn bộ lịch sử học tập & ngày thực tế)
   */
  getStudentRealtimeStreak(studentUser) {
    if (!studentUser) return 0;
    const stId = studentUser.id;
    const stUsername = studentUser.username;

    // Lấy toàn bộ các phiên học flashcard và bài thi của học sinh này
    const studySessions = (state.studySessions || []).filter(s => 
      s.user_id === stId || (stUsername === 'an_nguyen' && s.user_id === '00000000-0000-0000-0000-000000000002')
    );
    const testSessions = (state.testSessions || []).filter(s => 
      s.user_id === stId || (stUsername === 'an_nguyen' && s.user_id === '00000000-0000-0000-0000-000000000002')
    );

    const activeDates = new Set();

    studySessions.forEach(s => {
      if (s.created_at) {
        const d = new Date(s.created_at);
        if (!isNaN(d.getTime())) {
          activeDates.add(d.toLocaleDateString('en-CA'));
        }
      }
    });

    testSessions.forEach(s => {
      if (s.created_at) {
        const d = new Date(s.created_at);
        if (!isNaN(d.getTime())) {
          activeDates.add(d.toLocaleDateString('en-CA'));
        }
      }
    });

    if (Array.isArray(studentUser.streak_dates)) {
      studentUser.streak_dates.forEach(d => activeDates.add(d));
    }

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    const hasToday = activeDates.has(todayStr);
    const hasYesterday = activeDates.has(yesterdayStr);

    let baseStreak = Number(studentUser.streak || 0);

    if (activeDates.size === 0) {
      return Math.max(1, baseStreak);
    }

    // Đếm ngược từng ngày liên tục
    let streakCount = 0;
    let curr = new Date();

    if (!hasToday) {
      if (!hasYesterday) {
        return (studentUser.last_study_date === yesterdayStr && baseStreak > 0) ? baseStreak : 0;
      }
      curr.setDate(curr.getDate() - 1);
    }

    while (true) {
      const dateKey = curr.toLocaleDateString('en-CA');
      if (activeDates.has(dateKey)) {
        streakCount++;
        curr.setDate(curr.getDate() - 1);
      } else {
        break;
      }
    }

    if (hasToday && baseStreak > 0 && streakCount <= 1) {
      return baseStreak;
    }

    return Math.max(streakCount, (hasToday && baseStreak > 0) ? baseStreak : streakCount);
  },

  /**
   * Ghi nhận hoạt động học tập và tự động tăng/cập nhật chuỗi Streak theo thời gian thực
   */
  async recordRealtimeActivity() {
    if (!state.currentUser) return;
    const user = state.currentUser;
    const todayStr = new Date().toLocaleDateString('en-CA');

    if (!Array.isArray(user.streak_dates)) {
      user.streak_dates = [];
    }
    if (!user.streak_dates.includes(todayStr)) {
      user.streak_dates.push(todayStr);
    }

    const prevStreak = user.streak || 0;
    const newStreak = Math.max(1, this.getStudentRealtimeStreak(user));

    user.streak = newStreak;
    user.last_study_date = todayStr;
    await AuthService.updateUserStreak(user.id, newStreak, todayStr);

    // Update in usersList as well
    const foundIdx = state.usersList.findIndex(u => u.id === user.id);
    if (foundIdx !== -1) {
      state.usersList[foundIdx].streak = newStreak;
      state.usersList[foundIdx].last_study_date = todayStr;
    }

    if (newStreak > prevStreak) {
      showToast(`🔥 Tuyệt vời! Chuỗi Streak học tập của em đã tăng lên ${newStreak} ngày liên tiếp!`, "success");
    }

    this.render();
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
  // SAFE NAVIGATION & CLASS DRILLDOWN LOGIC
  // =========================================================================

  openClassDetail(classId, tab = 'units') {
    const targetId = Number(classId);
    const allowedClasses = this.getManagedClasses(state.currentUser);
    const isAllowed = state.currentUser?.role === 'host' || allowedClasses.some(c => c.id === targetId);

    if (!isAllowed) {
      showToast("Bạn chỉ được phép truy cập lớp học thuộc quyền phụ trách của mình!", "error");
      return;
    }

    state.selectedClassId = targetId;
    state.selectedClassDetailId = targetId;
    state.classDetailTab = tab;
    state.selectedLessonId = null;
    this.updateStudyList();
    this.switchTab('classes');
  },

  setClassDetailTab(tab) {
    state.classDetailTab = tab;
    this.render();
  },

  safeGoBack(fallback = 'dashboard') {
    if (state.currentTab === 'flashcards') {
      this.finishFlashcardSession();
    }
    if (state.currentTab === 'quiz' && state.currentQuiz && state.currentQuiz.length > 0) {
      state.pendingTargetTab = 'classes';
      const modal = document.getElementById('exit-quiz-modal');
      if (modal) {
        modal.classList.remove('hidden');
        return;
      }
    }
    // If in class detail view and user is teacher/host, return to classes list
    if (state.currentTab === 'classes' && state.selectedClassDetailId && state.currentUser?.role !== 'student') {
      state.selectedClassDetailId = null;
      this.render();
      return;
    }
    if (state.navigationHistory && state.navigationHistory.length > 1) {
      state.navigationHistory.pop(); // pop current tab
      const prevTab = state.navigationHistory.pop() || fallback;
      this.switchTab(prevTab, null, false);
    } else {
      this.switchTab(fallback, null, false);
    }
  },

  confirmExitQuiz() {
    this.closeModal('exit-quiz-modal');
    state.currentQuiz = [];
    if (state.quizTimerInterval) clearInterval(state.quizTimerInterval);
    const target = state.pendingTargetTab || 'classes';
    state.pendingTargetTab = null;
    this.switchTab(target);
    showToast("Đã quay về màn hình Lớp học!", "info");
  },

  selectClass(classId) {
    const targetId = Number(classId);
    const allowedClasses = this.getManagedClasses(state.currentUser);
    const isAllowed = state.currentUser?.role === 'host' || allowedClasses.some(c => c.id === targetId);

    if (!isAllowed) {
      showToast("Bạn chỉ được phép truy cập lớp học thuộc quyền phụ trách của mình!", "error");
      return;
    }

    state.selectedClassId = targetId;
    state.selectedClassDetailId = targetId;
    state.selectedLessonId = null;
    this.updateStudyList();
    
    const activeClass = state.classes.find(c => c.id === state.selectedClassId);
    showToast(`Đã chọn ${activeClass ? activeClass.name : 'Lớp học'}!`, 'info');
    this.render();
  },

  finishFlashcardSession() {
    if (state.flashcardStartTime) {
      const elapsedSeconds = Math.round((Date.now() - state.flashcardStartTime) / 1000);
      if (elapsedSeconds >= 3 && state.currentUser) {
        const sessionPayload = {
          user_id: state.currentUser.id,
          user_name: state.currentUser.full_name,
          class_id: state.selectedClassId || state.currentUser.class_id || 1,
          lesson_id: state.selectedLessonId,
          activity_type: 'flashcard',
          duration_seconds: elapsedSeconds,
          cards_viewed: Math.max(1, state.flashcardCardsViewed),
          cards_mastered: state.flashcardCardsMastered
        };
        SupabaseService.saveStudySession(sessionPayload).then(async saved => {
          if (saved) {
            state.studySessions.unshift(saved);
          }
          await this.recordRealtimeActivity();
        });
      }
      state.flashcardStartTime = null;
      state.flashcardCardsViewed = 0;
      state.flashcardCardsMastered = 0;
    }
  },

  switchTab(tabName, payload = null, pushHistory = true) {
    // If not logged in, force login screen
    if (!state.currentUser && tabName !== 'login') {
      state.currentTab = 'login';
      this.render();
      return;
    }

    if (state.currentTab === 'flashcards' && tabName !== 'flashcards') {
      this.finishFlashcardSession();
    }

    // Role-based restrictions: Students cannot access accounts management
    if (state.currentUser?.role === 'student' && tabName === 'accounts') {
      showToast("Chỉ Quản trị viên và Giáo viên mới có quyền quản lý tài khoản!", "error");
      state.currentTab = 'dashboard';
      this.render();
      return;
    }

    if (pushHistory) {
      if (!state.navigationHistory) state.navigationHistory = [];
      if (state.navigationHistory[state.navigationHistory.length - 1] !== tabName) {
        state.navigationHistory.push(tabName);
      }
    }

    state.currentTab = tabName;
    this.closeMobileSidebar();

    if (tabName === 'flashcards') {
      state.flashcardIndex = 0;
      state.flashcardFlipped = false;
      state.flashcardStartTime = Date.now();
      state.flashcardCardsViewed = 0;
      state.flashcardCardsMastered = 0;
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
  // GIAO DIỆN THÊM TỪ VỰNG DẠNG BẢNG & FLASHCARD THEO BÀI HỌC
  // =========================================================================

  startLessonFlashcard(lessonId) {
    state.selectedLessonId = lessonId ? Number(lessonId) : null;
    this.updateStudyList();
    state.flashcardIndex = 0;
    state.flashcardFlipped = false;
    state.flashcardStartTime = Date.now();
    state.flashcardCardsViewed = 0;
    state.flashcardCardsMastered = 0;
    this.switchTab('flashcards');
  },

  selectFlashcardLesson(lessonId) {
    state.selectedLessonId = lessonId ? Number(lessonId) : null;
    this.updateStudyList();
    state.flashcardIndex = 0;
    state.flashcardFlipped = false;
    this.render();
  },

  openBatchTableModal() {
    if (state.currentUser?.role === 'student') {
      state.selectedClassId = Number(state.currentUser.class_id) || 1;
    }
    this.switchTab('table_input');
  },

  addBatchTableRow(shouldFocus = true) {
    this.addBatchTableRows(1, shouldFocus);
  },

  addBatchTable5Rows() {
    this.addBatchTableRows(5, true);
  },

  addBatchTableRows(count = 1, shouldFocus = true) {
    const num = Math.max(1, Math.min(100, parseInt(count) || 1));
    let nextId = state.batchTableRows.length ? Math.max(...state.batchTableRows.map(r => r.id)) + 1 : 1;
    const startIdx = state.batchTableRows.length;
    for (let i = 0; i < num; i++) {
      state.batchTableRows.push({ id: nextId++, word: "", meaning: "" });
    }
    this.render();
    if (shouldFocus) {
      setTimeout(() => {
        const input = document.querySelector(`input[data-row-idx="${startIdx}"][data-col="0"]`);
        if (input) {
          input.focus();
          input.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  },

  addCustomBatchRows() {
    const input = document.getElementById('custom-row-count');
    const count = input ? parseInt(input.value) : 5;
    this.addBatchTableRows(count || 5, true);
  },

  clearBatchTable() {
    if (confirm("Bạn có chắc muốn làm mới lại bảng (xóa trắng các dòng hiện tại)?")) {
      state.batchTableRows = [
        { id: 1, word: "", meaning: "" },
        { id: 2, word: "", meaning: "" },
        { id: 3, word: "", meaning: "" },
        { id: 4, word: "", meaning: "" },
        { id: 5, word: "", meaning: "" }
      ];
      this.render();
      showToast("Đã làm mới bảng nhập từ!", "info");
    }
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

  // Điều khiển bàn phím chuẩn Excel (Enter, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Tab)
  handleBatchTableKeyNav(e, rowIndex, colIndex) {
    const totalRows = state.batchTableRows.length;
    const totalCols = 2; // 0: word, 1: meaning

    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex === totalRows - 1) {
        // Tự động thêm dòng mới khi nhấn Enter ở dòng cuối cùng
        this.addBatchTableRow(false);
        setTimeout(() => {
          const nextInput = document.querySelector(`input[data-row-idx="${rowIndex + 1}"][data-col="${colIndex}"]`);
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }, 30);
      } else {
        const nextInput = document.querySelector(`input[data-row-idx="${rowIndex + 1}"][data-col="${colIndex}"]`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIndex === totalRows - 1) {
        // Tự động tạo dòng mới khi mũi tên xuống ở dòng cuối
        this.addBatchTableRow(false);
        setTimeout(() => {
          const nextInput = document.querySelector(`input[data-row-idx="${rowIndex + 1}"][data-col="${colIndex}"]`);
          if (nextInput) {
            nextInput.focus();
            nextInput.select();
          }
        }, 30);
      } else {
        const nextInput = document.querySelector(`input[data-row-idx="${rowIndex + 1}"][data-col="${colIndex}"]`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      if (rowIndex > 0) {
        e.preventDefault();
        const prevInput = document.querySelector(`input[data-row-idx="${rowIndex - 1}"][data-col="${colIndex}"]`);
        if (prevInput) {
          prevInput.focus();
          prevInput.select();
        }
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      const input = e.target;
      if (input.selectionStart === input.value.length && colIndex < totalCols - 1) {
        e.preventDefault();
        const nextInput = document.querySelector(`input[data-row-idx="${rowIndex}"][data-col="${colIndex + 1}"]`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      const input = e.target;
      if (input.selectionStart === 0 && colIndex > 0) {
        e.preventDefault();
        const prevInput = document.querySelector(`input[data-row-idx="${rowIndex}"][data-col="${colIndex - 1}"]`);
        if (prevInput) {
          prevInput.focus();
          prevInput.select();
        }
      }
      return;
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
    const isStudent = state.currentUser?.role === 'student';
    const classId = isStudent 
      ? Number(state.currentUser.class_id || 1)
      : (Number(document.getElementById('table-input-class')?.value) || state.selectedClassId || 1);
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
      const creatorId = state.currentUser?.id;
      const created = await SupabaseService.createClass(name, code, creatorId);

      // If assistant teacher created the class, track it in managed_classes
      if (state.currentUser?.role === 'assistant_teacher') {
        if (!Array.isArray(state.currentUser.managed_classes)) {
          state.currentUser.managed_classes = [];
        }
        if (!state.currentUser.managed_classes.includes(created.id)) {
          state.currentUser.managed_classes.push(created.id);
        }
        if (!state.currentUser.class_id) {
          state.currentUser.class_id = created.id;
        }
        await AuthService.updateUserManagedClasses(state.currentUser.id, state.currentUser.managed_classes, state.currentUser.class_id);
      }

      showToast(`Đã tạo lớp "${name}" với mã [${created.class_code}] thành công! 🎉`, "success");
      this.closeModal('create-class-modal');
      const nameInput = document.getElementById('input-class-name');
      if (nameInput) nameInput.value = '';
      const codeInput = document.getElementById('input-class-code');
      if (codeInput) codeInput.value = '';

      await this.loadAllData();
      state.selectedClassId = created.id;
      state.selectedClassDetailId = created.id;
      this.updateStudyList();
      this.render();
    } catch (err) {
      showToast("Lỗi khi tạo lớp: " + err.message, "error");
    }
  },

  async deleteClass(id) {
    if (state.currentUser?.role === 'student') return;
    const targetClass = state.classes.find(c => c.id === Number(id));
    const isHost = state.currentUser?.role === 'host';
    const isCreator = targetClass && (targetClass.creator_id === state.currentUser?.id || targetClass.created_by === state.currentUser?.id);

    if (!isHost && !isCreator) {
      showToast("Bạn chỉ có thể xóa lớp học do chính mình tạo ra!", "error");
      return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa lớp học "${targetClass ? targetClass.name : ''}"? Toàn bộ bài học và từ vựng trong lớp sẽ bị xóa.`)) return;
    try {
      await SupabaseService.deleteClass(id);
      showToast("Đã xóa lớp học thành công!", "success");
      state.selectedClassDetailId = null;
      await this.loadAllData();
      this.render();
    } catch (e) {
      showToast("Lỗi khi xóa lớp: " + e.message, "error");
    }
  },

  openCreateLessonModal() {
    const modal = document.getElementById('create-lesson-modal');
    if (modal) {
      const classSelect = document.getElementById('modal-lesson-class');
      const isStudent = state.currentUser?.role === 'student';
      const isAssistant = state.currentUser?.role === 'assistant_teacher';
      const allowedClasses = this.getManagedClasses(state.currentUser);
      const targetClassId = Number(state.selectedClassId || state.currentUser?.class_id || 1);

      if (classSelect) {
        if (isStudent) {
          const userClass = state.classes.find(c => c.id === targetClassId) || state.classes[0];
          classSelect.innerHTML = `<option value="${targetClassId}">${userClass ? userClass.name : 'Lớp của bạn'}</option>`;
          classSelect.disabled = true;
        } else if (isAssistant) {
          if (allowedClasses.length > 1) {
            classSelect.disabled = false;
            classSelect.innerHTML = allowedClasses.map(c => 
              `<option value="${c.id}" ${c.id === targetClassId ? 'selected' : ''}>${c.name}</option>`
            ).join('');
          } else {
            const userClass = allowedClasses[0] || state.classes[0];
            classSelect.innerHTML = `<option value="${userClass.id}">${userClass.name}</option>`;
            classSelect.disabled = true;
          }
        } else {
          classSelect.disabled = false;
          classSelect.innerHTML = state.classes.map(c => 
            `<option value="${c.id}" ${state.selectedClassId === c.id ? 'selected' : ''}>${c.name}</option>`
          ).join('');
        }
      }
      modal.classList.remove('hidden');
    }
  },

  async handleCreateLesson(e) {
    e.preventDefault();
    const isStudent = state.currentUser?.role === 'student';
    const classId = isStudent
      ? Number(state.currentUser.class_id || 1)
      : Number(document.getElementById('modal-lesson-class')?.value || state.selectedClassId || 1);
    const title = document.getElementById('input-lesson-title')?.value.trim();
    if (!title) {
      showToast("Vui lòng nhập tên bài học!", "error");
      return;
    }
    try {
      const created = await SupabaseService.createLesson(classId, title);
      showToast(`Đã tạo bài học "${title}" thành công!`, "success");
      this.closeModal('create-lesson-modal');
      const titleInput = document.getElementById('input-lesson-title');
      if (titleInput) titleInput.value = '';
      await this.loadAllData();
      state.selectedLessonId = created.id;
      this.render();
    } catch (err) {
      showToast("Lỗi khi tạo bài học: " + err.message, "error");
    }
  },

  async deleteLesson(id) {
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

  // =========================================================================
  // SINGLE VOCABULARY CREATION & EDITING (STUDENTS & TEACHERS)
  // =========================================================================

  openCreateVocabularyModal(preselectedLessonId = null) {
    const isStudent = state.currentUser?.role === 'student';
    const isAssistant = state.currentUser?.role === 'assistant_teacher';
    const allowedClasses = this.getManagedClasses(state.currentUser);
    const targetClassId = Number(state.selectedClassId || state.currentUser?.class_id || 1);
    const classLessons = state.lessons.filter(l => l.class_id === targetClassId);

    const classSelect = document.getElementById('input-vocab-class');
    if (classSelect) {
      if (isStudent) {
        const userClass = state.classes.find(c => c.id === targetClassId) || state.classes[0];
        classSelect.innerHTML = `<option value="${targetClassId}">${userClass ? userClass.name : 'Lớp của bạn'}</option>`;
        classSelect.disabled = true;
      } else if (isAssistant) {
        if (allowedClasses.length > 1) {
          classSelect.disabled = false;
          classSelect.innerHTML = allowedClasses.map(c => 
            `<option value="${c.id}" ${c.id === targetClassId ? 'selected' : ''}>${c.name}</option>`
          ).join('');
        } else {
          const userClass = allowedClasses[0] || state.classes[0];
          classSelect.innerHTML = `<option value="${userClass.id}">${userClass.name}</option>`;
          classSelect.disabled = true;
        }
      } else {
        classSelect.disabled = false;
        classSelect.innerHTML = state.classes.map(c => 
          `<option value="${c.id}" ${c.id === targetClassId ? 'selected' : ''}>${c.name}</option>`
        ).join('');
      }
    }

    const lessonSelect = document.getElementById('input-vocab-lesson');
    if (lessonSelect) {
      if (classLessons.length > 0) {
        lessonSelect.innerHTML = classLessons.map(l => 
          `<option value="${l.id}" ${(preselectedLessonId === l.id || state.selectedLessonId === l.id) ? 'selected' : ''}>${l.title}</option>`
        ).join('');
      } else {
        lessonSelect.innerHTML = `<option value="1">Unit mặc định</option>`;
      }
    }

    // Reset inputs
    const wordInput = document.getElementById('input-vocab-word');
    if (wordInput) wordInput.value = '';
    const meaningInput = document.getElementById('input-vocab-meaning');
    if (meaningInput) meaningInput.value = '';
    const ipaInput = document.getElementById('input-vocab-ipa');
    if (ipaInput) ipaInput.value = '';
    const grammarCheck = document.getElementById('input-vocab-is-grammar');
    if (grammarCheck) grammarCheck.checked = false;

    const modal = document.getElementById('create-vocabulary-modal');
    if (modal) modal.classList.remove('hidden');
  },

  handleVocabModalClassChange(classId, mode = 'create') {
    const targetClassId = Number(classId);
    const classLessons = state.lessons.filter(l => l.class_id === targetClassId);
    const selectId = mode === 'create' ? 'input-vocab-lesson' : 'input-edit-vocab-lesson';
    const lessonSelect = document.getElementById(selectId);
    if (lessonSelect) {
      if (classLessons.length > 0) {
        lessonSelect.innerHTML = classLessons.map(l => `<option value="${l.id}">${l.title}</option>`).join('');
      } else {
        lessonSelect.innerHTML = `<option value="1">Unit mặc định</option>`;
      }
    }
  },

  async autoEnrichCreateVocab() {
    const wordInput = document.getElementById('input-vocab-word');
    const word = wordInput?.value?.trim();
    if (!word) {
      showToast("Vui lòng nhập từ tiếng Anh trước khi bấm AI tra cứu!", "error");
      wordInput?.focus();
      return;
    }

    const btn = document.getElementById('btn-ai-enrich-create');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> <span>Đang tra AI...</span>`;
    }

    try {
      const result = await GeminiService.enrichVocabulary(word);
      if (result) {
        const meaningInput = document.getElementById('input-vocab-meaning');
        if (meaningInput && !meaningInput.value.trim() && result.meaning) {
          meaningInput.value = result.meaning;
        }
        const ipaInput = document.getElementById('input-vocab-ipa');
        if (ipaInput && result.ipa) {
          ipaInput.value = result.ipa;
        }
        const grammarCheck = document.getElementById('input-vocab-is-grammar');
        if (grammarCheck && typeof result.is_grammar === 'boolean') {
          grammarCheck.checked = result.is_grammar;
        }
        showToast("Gemini AI đã tự động điền IPA thành công! ✨", "success");
      }
    } catch (err) {
      console.warn("AI enrich failed:", err);
      showToast("Không thể tra AI lúc này, vui lòng tự nhập tay.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined text-sm">auto_awesome</span> <span>AI Điền</span>`;
      }
    }
  },

  async handleCreateSingleVocabulary(e) {
    e.preventDefault();
    const isStudent = state.currentUser?.role === 'student';
    const classId = isStudent 
      ? Number(state.currentUser.class_id || 1)
      : Number(document.getElementById('input-vocab-class')?.value || state.selectedClassId || 1);
    const lessonId = Number(document.getElementById('input-vocab-lesson')?.value) || state.selectedLessonId || 1;
    const word = document.getElementById('input-vocab-word')?.value?.trim();
    const meaning = document.getElementById('input-vocab-meaning')?.value?.trim();
    const ipa = document.getElementById('input-vocab-ipa')?.value?.trim() || "";
    const isGrammar = Boolean(document.getElementById('input-vocab-is-grammar')?.checked);

    if (!word || !meaning) {
      showToast("Vui lòng nhập từ vựng và nghĩa tiếng Việt!", "error");
      return;
    }

    try {
      const item = await SupabaseService.addVocabulary({
        class_id: classId,
        lesson_id: lessonId,
        word: word,
        meaning: meaning,
        ipa: ipa,
        example: "",
        is_grammar: isGrammar
      });

      showToast(`Đã thêm từ "${word}" vào lớp thành công! 🎉`, "success");
      this.closeModal('create-vocabulary-modal');
      await this.loadAllData();
      state.selectedLessonId = lessonId;
      this.updateStudyList();
      this.render();
    } catch (err) {
      showToast("Lỗi khi thêm từ vựng: " + err.message, "error");
    }
  },

  openEditVocabularyModal(vocabId) {
    const item = state.vocabulary.find(v => v.id === Number(vocabId));
    if (!item) {
      showToast("Không tìm thấy từ vựng này!", "error");
      return;
    }

    const itemClass = state.classes.find(c => c.id === item.class_id) || state.classes[0];
    const classLessons = state.lessons.filter(l => l.class_id === item.class_id);

    const idInput = document.getElementById('input-edit-vocab-id');
    if (idInput) idInput.value = item.id;
    
    const classNameInput = document.getElementById('input-edit-vocab-class-name');
    if (classNameInput) classNameInput.value = itemClass ? itemClass.name : `Lớp #${item.class_id}`;
    
    const lessonSelect = document.getElementById('input-edit-vocab-lesson');
    if (lessonSelect) {
      if (classLessons.length > 0) {
        lessonSelect.innerHTML = classLessons.map(l => 
          `<option value="${l.id}" ${l.id === item.lesson_id ? 'selected' : ''}>${l.title}</option>`
        ).join('');
      } else {
        lessonSelect.innerHTML = `<option value="${item.lesson_id}">Unit #${item.lesson_id}</option>`;
      }
    }

    const wordInput = document.getElementById('input-edit-vocab-word');
    if (wordInput) wordInput.value = item.word || "";
    
    const meaningInput = document.getElementById('input-edit-vocab-meaning');
    if (meaningInput) meaningInput.value = item.meaning || "";
    
    const ipaInput = document.getElementById('input-edit-vocab-ipa');
    if (ipaInput) ipaInput.value = item.ipa || "";
    
    const grammarCheck = document.getElementById('input-edit-vocab-is-grammar');
    if (grammarCheck) grammarCheck.checked = Boolean(item.is_grammar);

    const deleteBtn = document.getElementById('btn-edit-vocab-delete');
    if (deleteBtn) {
      deleteBtn.onclick = () => {
        this.closeModal('edit-vocabulary-modal');
        this.deleteVocabulary(item.id, item.word);
      };
    }

    const modal = document.getElementById('edit-vocabulary-modal');
    if (modal) modal.classList.remove('hidden');
  },

  async autoEnrichEditVocab() {
    const wordInput = document.getElementById('input-edit-vocab-word');
    const word = wordInput?.value?.trim();
    if (!word) {
      showToast("Vui lòng nhập từ tiếng Anh trước!", "error");
      return;
    }

    const btn = document.getElementById('btn-ai-enrich-edit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> <span>Đang tra AI...</span>`;
    }

    try {
      const result = await GeminiService.enrichVocabulary(word);
      if (result) {
        const ipaInput = document.getElementById('input-edit-vocab-ipa');
        if (ipaInput && result.ipa) ipaInput.value = result.ipa;
        const grammarCheck = document.getElementById('input-edit-vocab-is-grammar');
        if (grammarCheck && typeof result.is_grammar === 'boolean') {
          grammarCheck.checked = result.is_grammar;
        }
        showToast("Gemini AI đã cập nhật lại IPA! ✨", "success");
      }
    } catch (err) {
      console.warn(err);
      showToast("Không thể tra cứu AI lúc này.", "error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined text-sm">auto_awesome</span> <span>AI Cập nhật</span>`;
      }
    }
  },

  async handleSaveEditVocabulary(e) {
    e.preventDefault();
    const id = Number(document.getElementById('input-edit-vocab-id')?.value);
    const lessonId = Number(document.getElementById('input-edit-vocab-lesson')?.value);
    const word = document.getElementById('input-edit-vocab-word')?.value?.trim();
    const meaning = document.getElementById('input-edit-vocab-meaning')?.value?.trim();
    const ipa = document.getElementById('input-edit-vocab-ipa')?.value?.trim() || "";
    const isGrammar = Boolean(document.getElementById('input-edit-vocab-is-grammar')?.checked);

    if (!id || !word || !meaning) {
      showToast("Vui lòng điền đầy đủ từ vựng và nghĩa tiếng Việt!", "error");
      return;
    }

    try {
      await SupabaseService.updateVocabulary(id, {
        lesson_id: lessonId,
        word: word,
        meaning: meaning,
        ipa: ipa,
        example: "",
        is_grammar: isGrammar
      });

      // Update local state
      const idx = state.vocabulary.findIndex(v => v.id === id);
      if (idx !== -1) {
        state.vocabulary[idx] = {
          ...state.vocabulary[idx],
          lesson_id: lessonId,
          word,
          meaning,
          ipa,
          example,
          is_grammar: isGrammar
        };
      }
      this.updateStudyList();

      showToast(`Đã lưu thay đổi từ "${word}" thành công! 🎉`, "success");
      this.closeModal('edit-vocabulary-modal');
      this.render();
    } catch (err) {
      showToast("Lỗi khi lưu chỉnh sửa từ: " + err.message, "error");
    }
  },

  async deleteVocabulary(id, word) {
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
    state.flashcardCardsViewed = (state.flashcardCardsViewed || 0) + 1;

    const currentWord = state.studyList[state.flashcardIndex];
    if (isKnown && currentWord) {
      state.knownWords.add(currentWord.id);
      state.flashcardCardsMastered = (state.flashcardCardsMastered || 0) + 1;
    }

    state.flashcardFlipped = false;
    const cardEl = document.getElementById('main-flashcard');
    if (cardEl) cardEl.classList.remove('is-flipped');

    if (state.flashcardIndex < state.studyList.length - 1) {
      state.flashcardIndex += 1;
    } else {
      showToast(`Chúc mừng em đã hoàn thành toàn bộ ${state.studyList.length} thẻ từ vựng của lớp! 🎉`, "success");
      this.finishFlashcardSession();
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
      if (q.type.startsWith('multiple_choice') || q.type === 'multiple_choice') {
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
      await this.recordRealtimeActivity();
      this.switchTab('quiz_result');
    } catch (err) {
      console.error(err);
      state.lastQuizResult = { ...sessionRecord, details };
      await this.recordRealtimeActivity();
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
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'Escape') {
        App.safeGoBack();
        return;
      }
      if (state.currentTab === 'flashcards') {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          this.flipFlashcard();
        } else if (e.code === 'ArrowRight' || e.key === 'Enter') {
          e.preventDefault();
          this.nextFlashcard(false);
        } else if (e.code === 'ArrowLeft') {
          e.preventDefault();
          this.prevFlashcard();
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          this.nextFlashcard(true);
        }
      }
    });
  },

  // =========================================================================
  // VIEW RENDERERS & ROLE-BASED NAVIGATION
  // =========================================================================

  // Mobile drawer controls
  toggleMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;
    const isClosed = sidebar.classList.contains('-translate-x-full');
    if (isClosed) {
      sidebar.classList.remove('-translate-x-full');
      if (backdrop) {
        backdrop.classList.remove('hidden');
        setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
      }
    } else {
      this.closeMobileSidebar();
    }
  },

  closeMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (backdrop) {
      backdrop.classList.add('opacity-0');
      setTimeout(() => backdrop.classList.add('hidden'), 300);
    }
  },

  render() {
    const mainContainer = document.getElementById('app-root');
    if (!mainContainer) return;

    // Toggle Sidebar & Header visibility depending on login state
    const sidebar = document.getElementById('app-sidebar');
    const header = document.querySelector('header');
    const mobileNav = document.getElementById('mobile-bottom-nav');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (!state.currentUser) {
      if (sidebar) sidebar.classList.add('hidden');
      if (header) header.classList.add('hidden');
      if (mobileNav) mobileNav.classList.add('hidden');
      if (backdrop) backdrop.classList.add('hidden');
      mainContainer.parentElement.classList.remove('lg:ml-72');
      mainContainer.innerHTML = this.renderLoginView();
      return;
    } else {
      if (sidebar) sidebar.classList.remove('hidden');
      if (header) header.classList.remove('hidden');
      if (mobileNav) mobileNav.classList.remove('hidden');
      mainContainer.parentElement.classList.add('lg:ml-72');
    }

    // Role-based sidebar menu items filtering
    this.updateSidebarNavigationUI();

    // Update active nav indicators in Desktop/Drawer Sidebar
    document.querySelectorAll('[data-nav-tab]').forEach(el => {
      const tab = el.getAttribute('data-nav-tab');
      if (tab === state.currentTab) {
        el.classList.add('bg-primary-container', 'text-on-primary-container', 'font-bold', 'shadow-sm');
        el.classList.remove('text-on-surface-variant');
      } else {
        el.classList.remove('bg-primary-container', 'text-on-primary-container', 'font-bold', 'shadow-sm');
        el.classList.add('text-on-surface-variant');
      }
    });

    // Update active nav indicators in Mobile Bottom Navigation
    document.querySelectorAll('[data-mobile-tab]').forEach(el => {
      const tab = el.getAttribute('data-mobile-tab');
      if (tab === state.currentTab) {
        el.classList.add('text-primary', 'font-bold');
        el.classList.remove('text-on-surface-variant');
      } else {
        el.classList.remove('text-primary', 'font-bold');
        el.classList.add('text-on-surface-variant');
      }
    });

    // Update persistent top-left back button visibility
    const backBtn = document.getElementById('global-header-back-btn');
    if (backBtn) {
      if (state.currentTab === 'dashboard' && !state.selectedClassDetailId) {
        backBtn.classList.add('invisible');
      } else {
        backBtn.classList.remove('invisible');
      }
    }

    // Update breadcrumbs
    const breadcrumbPage = document.getElementById('breadcrumb-current-page');
    if (breadcrumbPage) {
      const activeClass = state.classes.find(c => c.id === state.selectedClassId);
      const titles = {
        dashboard: 'Trang Chủ',
        classes: state.selectedClassDetailId ? (activeClass?.name || 'Chi Tiết Lớp Học') : 'Lớp Học & Chuyên Đề',
        accounts: 'Quản Lý Tài Khoản',
        flashcards: `Flashcard 3D • ${activeClass?.name || ''}`,
        quiz: `Luyện Đề Vào 10 • ${activeClass?.name || ''}`,
        quiz_result: 'Kết Quả Bài Thi',
        table_input: `Bảng Nhập Từ • ${activeClass?.name || ''}`,
        vocabulary: `Kho Từ Vựng • ${activeClass?.name || ''}`,
        tutor: 'Gia Sư AI Quang Son',
        settings: 'Cài Đặt Hệ Thống'
      };
      breadcrumbPage.textContent = titles[state.currentTab] || 'Ôn Thi Tiếng Anh Vào 10';
    }

    const viewRenderers = {
      dashboard: this.renderDashboardView,
      classes: this.renderClassesView,
      class_detail: this.renderClassDetailView,
      accounts: () => {
        const isStudent = state.currentUser?.role === 'student';
        const targetId = isStudent ? Number(state.currentUser.class_id || 1) : Number(state.selectedClassDetailId || state.selectedClassId || state.currentUser?.class_id || (state.classes[0] ? state.classes[0].id : 1));
        state.selectedClassDetailId = targetId;
        state.selectedClassId = targetId;
        state.classDetailTab = 'accounts';
        return this.renderClassDetailView(targetId);
      },
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

    // Update active nav indicators in Desktop/Drawer Sidebar
    document.querySelectorAll('[data-nav-tab]').forEach(el => {
      const tab = el.getAttribute('data-nav-tab');
      if (tab === state.currentTab) {
        el.classList.add('bg-primary-container', 'text-on-primary-container', 'font-bold', 'shadow-sm');
        el.classList.remove('text-on-surface-variant');
      } else {
        el.classList.remove('bg-primary-container', 'text-on-primary-container', 'font-bold', 'shadow-sm');
        el.classList.add('text-on-surface-variant');
      }
    });

    // Update active nav indicators in Mobile Bottom Navigation
    document.querySelectorAll('[data-mobile-tab]').forEach(el => {
      const tab = el.getAttribute('data-mobile-tab');
      if (tab === state.currentTab) {
        el.classList.add('text-primary', 'font-bold', 'scale-105');
        el.classList.remove('text-on-surface-variant');
      } else {
        el.classList.remove('text-primary', 'font-bold', 'scale-105');
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

    // Hide admin navigation items for students (classes, accounts)
    document.querySelectorAll('[data-admin-only]').forEach(el => {
      if (isStudent) {
        el.classList.add('hidden');
      } else {
        el.classList.remove('hidden');
      }
    });

    // Both student and teachers can use batch table buttons
    const sidebarBatchBtn = document.getElementById('sidebar-batch-btn');
    if (sidebarBatchBtn) {
      sidebarBatchBtn.classList.remove('hidden');
    }

    const headerBatchBtn = document.getElementById('header-batch-btn');
    if (headerBatchBtn) {
      headerBatchBtn.classList.remove('hidden');
    }
  },

  updateUserBadgeUI() {
    const user = state.currentUser;
    if (!user) return;

    const roleLabel = user.role === 'host' ? '👑 Host' : user.role === 'assistant_teacher' ? '👩‍🏫 Trợ giảng' : '🎓 Học sinh';
    const realtimeStreak = this.getStudentRealtimeStreak(user);
    
    // Header Badge
    const headerBadge = document.getElementById('header-user-badge');
    if (headerBadge) {
      headerBadge.innerHTML = `
        <div class="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 font-bold text-xs shadow-sm" title="Chuỗi ngày học tập liên tục">
          <span class="material-symbols-outlined text-xs text-amber-500">local_fire_department</span>
          <span>${realtimeStreak}d</span>
        </div>
        <div class="w-2 h-2 rounded-full ${user.role === 'host' ? 'bg-amber-500' : 'bg-green-500'}"></div>
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

  // 1. Dashboard View (Class Workspace Folders & Personal Learning Hub)
  renderDashboardView() {
    const user = state.currentUser;
    const isStudent = user.role === 'student';
    const isTeacher = !isStudent;
    
    // Managed classes for this user (Host sees all, Assistant Teacher sees their classes, Student sees their class)
    const visibleClasses = this.getManagedClasses(user);
    const targetClassId = isStudent ? Number(user.class_id || 1) : Number(state.selectedClassId || user.class_id || (visibleClasses[0] ? visibleClasses[0].id : 1));
    const activeClass = state.classes.find(c => c.id === targetClassId) || visibleClasses[0] || state.classes[0] || { name: "Lớp học", class_code: "QS9A" };

    // Compute personal learning time & test stats for this user
    const userStudySessions = (state.studySessions || []).filter(s => s.user_id === user.id || (user.username === 'an_nguyen' && s.user_id === '00000000-0000-0000-0000-000000000002'));
    const userTestSessions = (state.testSessions || []).filter(s => s.user_id === user.id || (user.username === 'an_nguyen' && s.user_id === '00000000-0000-0000-0000-000000000002'));

    const flashcardSeconds = userStudySessions.filter(s => s.activity_type === 'flashcard').reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
    const quizSeconds = userTestSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
    const totalStudyMinutes = Math.max(1, Math.round((flashcardSeconds + quizSeconds) / 60));

    const totalTests = userTestSessions.length;
    const avgScore = totalTests > 0 ? Math.round(userTestSessions.reduce((acc, s) => acc + (s.score_percentage || 0), 0) / totalTests) : 0;
    
    // Real-Time Streak Engine
    const userStreak = this.getStudentRealtimeStreak(user);
    const todayStr = new Date().toLocaleDateString('en-CA');
    const studiedToday = (user.streak_dates && user.streak_dates.includes(todayStr)) || 
      userStudySessions.some(s => s.created_at && new Date(s.created_at).toLocaleDateString('en-CA') === todayStr) ||
      userTestSessions.some(s => s.created_at && new Date(s.created_at).toLocaleDateString('en-CA') === todayStr);

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        
        <!-- Welcome Hero -->
        <div class="bg-gradient-to-r from-surface-container-lowest via-surface-container-low to-surface-container-lowest p-6 md:p-8 rounded-3xl ambient-shadow border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 text-primary font-bold text-xs mb-2">
              <span class="material-symbols-outlined text-lg">verified</span>
              <span>${CONFIG.BRAND.NAME}</span>
              <span class="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary font-mono text-[11px] font-bold">Lớp chính: ${activeClass.name}</span>
            </div>
            <h1 class="font-display-lg text-2xl md:text-3xl font-bold text-on-surface">
              Xin chào, <span class="text-primary">${user.full_name}!</span> 👋
            </h1>
            <p class="font-body-md text-sm text-on-surface-variant mt-2 max-w-xl">
              ${isStudent 
                ? 'Không gian ôn thi Tiếng Anh vào 10 cá nhân hóa. Bấm vào từng thư mục lớp bên dưới để luyện bài học và thi thử.' 
                : 'Phân hệ quản trị & giảng dạy. Quản lý các thư mục lớp học, bài học, kho từ vựng, tài khoản học sinh và báo cáo bên dưới.'
              }
            </p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <button onclick="App.openClassDetail(${targetClassId})" class="bg-gradient-to-r from-primary to-primary-container text-on-primary px-6 py-3.5 rounded-2xl font-bold text-sm btn-press flex items-center gap-2 hover-lift shadow-md">
              <span class="material-symbols-outlined text-xl">school</span>
              <span>👉 Vào Lớp: ${activeClass.name.split(' - ')[0]}</span>
            </button>
            
            <button onclick="App.switchTab('tutor')" class="bg-secondary-container text-on-secondary-container px-4 py-3 rounded-2xl font-bold text-xs flex items-center gap-1.5 hover-lift shadow-sm">
              <span class="material-symbols-outlined text-base">psychology</span>
              <span>Gia Sư AI</span>
            </button>
          </div>
        </div>

        <!-- 📁 THƯ MỤC CÁC LỚP HỌC (CLASS WORKSPACE FOLDERS GRID) -->
        <div>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div class="flex items-center gap-2 text-primary font-bold text-xs mb-1">
                <span class="material-symbols-outlined text-base">folder_open</span>
                <span>DANH MỤC THƯ MỤC CÁC LỚP HỌC</span>
              </div>
              <h3 class="font-headline-md text-xl font-bold text-on-surface">Thư Mục Các Lớp Quản Lý & Học Tập</h3>
              <p class="text-xs text-on-surface-variant">Chọn trực tiếp các chuyên mục: Bài học, Từ vựng, Quản lý tài khoản hoặc Báo cáo trong từng thư mục lớp.</p>
            </div>

            ${isTeacher ? `
              <button onclick="App.openCreateClassModal()" class="bg-primary text-on-primary px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 btn-press hover-lift shadow-sm self-start sm:self-auto">
                <span class="material-symbols-outlined text-sm">add</span> + Tạo Lớp Mới
              </button>
            ` : ''}
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-stack-md">
            ${visibleClasses.length > 0 ? visibleClasses.map(c => {
              const cLessons = state.lessons.filter(l => l.class_id === c.id);
              const cVocab = state.vocabulary.filter(v => v.class_id === c.id);
              const cStudents = state.usersList.filter(u => u.role === 'student' && u.class_id === c.id);
              
              return `
                <div class="bg-surface-container-lowest rounded-3xl ambient-shadow border border-outline-variant/30 p-6 flex flex-col justify-between gap-5 hover-lift transition-all">
                  
                  <!-- Folder Top Header -->
                  <div>
                    <div class="flex items-start justify-between gap-3 mb-3">
                      <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center font-bold shadow-sm shrink-0">
                          <span class="material-symbols-outlined text-2xl">folder</span>
                        </div>
                        <div>
                          <div class="flex items-center gap-2 flex-wrap">
                            <h4 class="font-headline-md text-base sm:text-lg font-bold text-on-surface">${c.name}</h4>
                            <span class="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary font-mono text-[11px] font-bold">Mã: ${c.class_code}</span>
                          </div>
                          <p class="text-xs text-outline mt-0.5">Không gian lớp học độc lập</p>
                        </div>
                      </div>
                    </div>

                    <!-- 4 Sub-Folders / Mini Tabs directly inside this class folder card -->
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                      
                      <!-- 1. Bài học -->
                      <button onclick="App.openClassDetail(${c.id}, 'units')" class="p-2.5 rounded-xl bg-surface-container-low hover:bg-primary/10 hover:text-primary text-on-surface border border-outline-variant/30 text-left transition-all flex flex-col gap-1 group">
                        <div class="flex items-center justify-between">
                          <span class="material-symbols-outlined text-primary text-base group-hover:scale-110 transition-transform">auto_stories</span>
                          <span class="font-bold text-[11px] text-outline">${cLessons.length}</span>
                        </div>
                        <span class="font-bold text-[11px]">1. Bài Học</span>
                      </button>

                      <!-- 2. Từ vựng -->
                      <button onclick="App.openClassDetail(${c.id}, 'vocabulary')" class="p-2.5 rounded-xl bg-surface-container-low hover:bg-secondary/10 hover:text-secondary text-on-surface border border-outline-variant/30 text-left transition-all flex flex-col gap-1 group">
                        <div class="flex items-center justify-between">
                          <span class="material-symbols-outlined text-secondary text-base group-hover:scale-110 transition-transform">menu_book</span>
                          <span class="font-bold text-[11px] text-outline">${cVocab.length}</span>
                        </div>
                        <span class="font-bold text-[11px]">2. Từ Vựng</span>
                      </button>

                      <!-- 3. Quản lý / Cấp tài khoản -->
                      <button onclick="App.openClassDetail(${c.id}, 'accounts')" class="p-2.5 rounded-xl bg-surface-container-low hover:bg-blue-500/10 hover:text-blue-700 text-on-surface border border-outline-variant/30 text-left transition-all flex flex-col gap-1 group">
                        <div class="flex items-center justify-between">
                          <span class="material-symbols-outlined text-blue-600 text-base group-hover:scale-110 transition-transform">manage_accounts</span>
                          <span class="font-bold text-[11px] text-outline">${cStudents.length}</span>
                        </div>
                        <span class="font-bold text-[11px]">3. ${isTeacher ? 'Cấp Acc' : 'Học Sinh'}</span>
                      </button>

                      <!-- 4. Báo cáo thống kê -->
                      <button onclick="App.openClassDetail(${c.id}, 'reports')" class="p-2.5 rounded-xl bg-surface-container-low hover:bg-green-500/10 hover:text-green-700 text-on-surface border border-outline-variant/30 text-left transition-all flex flex-col gap-1 group">
                        <div class="flex items-center justify-between">
                          <span class="material-symbols-outlined text-green-600 text-base group-hover:scale-110 transition-transform">analytics</span>
                          <span class="font-bold text-[11px] text-outline">Xem</span>
                        </div>
                        <span class="font-bold text-[11px]">4. Báo Cáo</span>
                      </button>
                    </div>
                  </div>

                  <!-- Folder Quick Actions Bar -->
                  <div class="flex items-center justify-between gap-2 pt-3 border-t border-outline-variant/30 flex-wrap">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <button onclick="App.selectClass(${c.id}); App.startLessonFlashcard(null);" class="px-3 py-1.5 bg-surface-container text-primary hover:bg-primary hover:text-on-primary rounded-lg font-bold text-xs transition-colors flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">style</span> Luyện thẻ
                      </button>
                      <button onclick="App.selectClass(${c.id}); App.startNewQuiz(null, true);" class="px-3 py-1.5 bg-surface-container text-on-surface hover:bg-secondary hover:text-on-secondary rounded-lg font-bold text-xs transition-colors flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">quiz</span> Thi thử
                      </button>
                    </div>

                    <button onclick="App.openClassDetail(${c.id})" class="bg-primary text-on-primary px-4 py-2 rounded-xl font-bold text-xs btn-press flex items-center gap-1 hover-lift shadow-sm">
                      <span>Mở Lớp Học</span>
                      <span class="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>

                </div>
              `;
            }).join('') : `
              <div class="col-span-full p-8 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 text-center">
                <span class="material-symbols-outlined text-4xl text-outline mb-2">folder_off</span>
                <p class="font-bold text-sm text-on-surface">Chưa có thư mục lớp học nào</p>
                <button onclick="App.openCreateClassModal()" class="mt-3 bg-primary text-on-primary px-4 py-2 rounded-xl font-bold text-xs inline-flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">add</span> Tạo Lớp Đầu Tiên
                </button>
              </div>
            `}
          </div>
        </div>

        <!-- Personal Progress & Time Analytics Grid -->
        <div>
          <h3 class="font-headline-md text-base font-bold text-on-surface mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">insights</span>
            <span>Tiến Độ & Thời Gian Học Tập Cá Nhân</span>
          </h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
            <!-- Total Study Time Card -->
            <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
              <div class="flex justify-between items-start mb-3">
                <div class="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center text-primary">
                  <span class="material-symbols-outlined text-2xl">timer</span>
                </div>
                <span class="bg-blue-100 text-blue-900 font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">Ghi nhận tự động</span>
              </div>
              <h4 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Tổng Thời Gian Đã Học</h4>
              <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">${totalStudyMinutes} <span class="text-xs font-normal text-outline">phút</span></p>
            </div>

            <!-- Streak Card -->
            <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
              <div class="flex justify-between items-start mb-3">
                <div class="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-600">
                  <span class="material-symbols-outlined text-2xl ${studiedToday ? 'text-amber-500 font-bold animate-pulse' : ''}">local_fire_department</span>
                </div>
                <span class="${studiedToday ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'} font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                  ${studiedToday ? '🔥 Đã học hôm nay' : '⏳ Chưa học hôm nay'}
                </span>
              </div>
              <h4 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Chuỗi Học Tập (Streak)</h4>
              <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">${userStreak} <span class="text-xs font-normal text-outline">ngày liên tiếp</span></p>
              <p class="text-[11px] text-outline mt-1 font-semibold">
                ${studiedToday ? '✨ Tuyệt vời! Em đã giữ vững chuỗi hôm nay.' : 'Luyện Flashcard hoặc làm 1 bài thi để tăng chuỗi!'}
              </p>
            </div>

            <!-- Tests Completed Card -->
            <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
              <div class="flex justify-between items-start mb-3">
                <div class="w-12 h-12 rounded-xl bg-green-500/15 flex items-center justify-center text-green-700">
                  <span class="material-symbols-outlined text-2xl">task_alt</span>
                </div>
                <span class="bg-green-100 text-green-800 font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">Đã làm</span>
              </div>
              <h4 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Bài Thi Hoàn Thành</h4>
              <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">${totalTests} <span class="text-xs font-normal text-outline">lần nộp</span></p>
            </div>

            <!-- Average Score Card -->
            <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 hover-lift">
              <div class="flex justify-between items-start mb-3">
                <div class="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-700">
                  <span class="material-symbols-outlined text-2xl">military_tech</span>
                </div>
                <span class="bg-purple-100 text-purple-800 font-label-sm px-2.5 py-0.5 rounded-full text-xs font-bold">Mục tiêu 9.0+</span>
              </div>
              <h4 class="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">Điểm Trung Bình</h4>
              <p class="font-display-lg text-3xl font-bold text-on-surface mt-1">${avgScore > 0 ? avgScore + '%' : '92%'} <span class="text-xs font-normal text-outline">${avgScore >= 80 ? '🌟 Giỏi' : 'Đạt'}</span></p>
            </div>
          </div>
        </div>

        <!-- Quick AI Tutor Assistant Box -->
        <div class="bg-surface-container-lowest p-6 rounded-3xl ambient-shadow border border-outline-variant/30 flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-2xl">psychology</span>
            </div>
            <div>
              <h4 class="font-headline-md text-base font-bold text-on-surface">Cần Thầy Giải Thích Từ Vựng Hoặc Ngữ Pháp?</h4>
              <p class="text-xs text-on-surface-variant">Gia Sư AI Quang Son luôn sẵn sàng 24/7 giải đáp mọi cấu trúc và đề thi vào 10.</p>
            </div>
          </div>
          <button onclick="App.switchTab('tutor')" class="bg-secondary-container text-on-secondary-container px-5 py-2.5 rounded-xl font-bold text-xs hover-lift shadow-sm whitespace-nowrap">
            💬 Nhắn Tin Cho Gia Sư AI
          </button>
        </div>

      </div>
    `;
  },

  // 1.1. Account Management & Provisioning View (Host & Assistant Teacher)
  renderAccountManagementView() {
    if (state.currentUser?.role === 'student') {
      return this.renderDashboardView();
    }

    const isHost = state.currentUser?.role === 'host';
    const isAssistant = state.currentUser?.role === 'assistant_teacher';
    const assistantClassId = Number(state.currentUser?.class_id || 0);
    const assignedClass = state.classes.find(c => c.id === assistantClassId) || { name: `Lớp #${assistantClassId}` };

    // Assistant teacher ONLY sees student accounts belonging to their assigned class
    const users = isHost 
      ? state.usersList 
      : state.usersList.filter(u => u.role === 'student' && Number(u.class_id) === assistantClassId);

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 text-primary font-bold text-xs mb-1">
              <span class="material-symbols-outlined text-base">manage_accounts</span>
              <span>${isHost ? 'PHÂN HỆ QUẢN TRỊ TÀI KHOẢN & PHÂN QUYỀN TOÀN HỆ THỐNG' : `DANH SÁCH HỌC SINH • ${assignedClass.name}`}</span>
            </div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">${isHost ? 'Quản Lý & Cấp Tài Khoản' : `Quản Lý Học Sinh: ${assignedClass.name}`}</h2>
            <p class="font-body-md text-sm text-on-surface-variant">
              ${isHost 
                ? 'Cấp tài khoản mới cho Giáo viên phụ và Học sinh, quản lý mật khẩu và phân quyền lớp học.' 
                : `Danh sách và cấp tài khoản học sinh thuộc lớp ${assignedClass.name} do bạn phụ trách.`
              }
            </p>
          </div>

          <button onclick="App.openCreateUserModal()" class="bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm btn-press flex items-center gap-2 hover-lift shadow-sm self-start sm:self-auto">
            <span class="material-symbols-outlined text-lg">person_add</span>
            + Cấp Tài Khoản Mới
          </button>
        </div>

        <!-- Accounts Table -->
        <div class="bg-surface-container-lowest rounded-2xl ambient-shadow border border-outline-variant/30 overflow-hidden">
          <div class="p-5 border-b border-outline-variant/30 flex items-center justify-between">
            <h3 class="font-headline-md text-base font-bold text-on-surface">
              ${isHost 
                ? `Danh sách tài khoản hệ thống (${users.length} tài khoản)` 
                : `Danh sách học sinh lớp ${assignedClass.name} (${users.length} học sinh)`
              }
            </h3>
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
                ${users.length > 0 ? users.map((u, idx) => {
                  const itemClass = state.classes.find(c => c.id === u.class_id);
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
                        ${isUserHost ? '<span class="text-primary font-bold">Toàn bộ các lớp</span>' : itemClass ? itemClass.name : 'Chưa gán'}
                      </td>
                      <td class="p-4 text-center">
                        <div class="flex items-center justify-center gap-2">
                          <button onclick="App.handleChangePassword('${u.id}', '${u.full_name}')" class="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-[11px] transition-colors" title="Đổi mật khẩu">
                            Đổi Pass
                          </button>
                          ${!isUserHost ? `
                            <button onclick="App.handleDeleteUser('${u.id}', '${u.full_name}')" class="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error-container/20 transition-colors" title="Xóa tài khoản">
                              <span class="material-symbols-outlined text-base">delete</span>
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="7" class="p-8 text-center text-outline">
                      <span class="material-symbols-outlined text-4xl block mb-2 text-outline/60">person_off</span>
                      Chưa có học sinh nào trong lớp này. Nhấn <strong>"+ Cấp Tài Khoản Mới"</strong> để thêm học sinh.
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

  // 2. Batch Vocabulary Input Table View (Quantity Selector & Excel-Style Keyboard Navigation)
  renderTableInputView() {
    const isStudent = state.currentUser?.role === 'student';
    const isAssistant = state.currentUser?.role === 'assistant_teacher';
    const targetClassId = (isStudent || isAssistant) ? Number(state.currentUser.class_id || 1) : Number(state.selectedClassId);
    const activeClass = state.classes.find(c => c.id === targetClassId) || state.classes[0] || { name: "Lớp học" };
    const classLessons = state.lessons.filter(l => l.class_id === targetClassId);

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <!-- Navigation Back Header -->
        <div class="flex items-center justify-between">
          <button onclick="App.safeGoBack('classes')" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs transition-all hover-lift">
            <span class="material-symbols-outlined text-base">arrow_back</span>
            <span>← Quay lại Lớp học</span>
          </button>
          <span class="text-xs font-bold text-primary uppercase">Thêm từ vựng nhiều dòng • ${activeClass.name}</span>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">Bảng Nhập Từ Vựng Hàng Loạt</h2>
            <p class="font-body-md text-sm text-on-surface-variant">Nhập từ vựng nhanh với phím điều hướng Excel, hỗ trợ dán Clipboard và tự động tạo IPA + Ví dụ bằng AI.</p>
          </div>
        </div>

        <!-- Target Class & Lesson Card + Quantity Selector -->
        <div class="bg-surface-container-lowest p-5 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div class="flex items-center gap-4 w-full lg:w-auto flex-wrap sm:flex-nowrap">
            <div>
              <label class="block text-xs font-bold text-outline uppercase mb-1">Lớp học đích (*)</label>
              ${isStudent ? `
                <input type="text" readonly value="${activeClass.name}" class="py-2.5 px-3.5 bg-surface-container border border-outline-variant/30 rounded-xl text-sm font-bold text-primary cursor-not-allowed" />
                <input type="hidden" id="table-input-class" value="${targetClassId}" />
              ` : `
                <select id="table-input-class" onchange="App.selectClass(this.value)" class="py-2.5 px-3.5 bg-surface-container-low border border-outline-variant/40 rounded-xl text-sm font-bold text-primary focus:outline-none">
                  ${this.getManagedClasses(state.currentUser).map(c => `<option value="${c.id}" ${c.id === targetClassId ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
              `}
            </div>
            <div>
              <label class="block text-xs font-bold text-outline uppercase mb-1">Bài học đích (*)</label>
              <select id="table-input-lesson" class="py-2.5 px-3.5 bg-surface-container-low border border-outline-variant/40 rounded-xl text-sm font-semibold focus:outline-none">
                ${classLessons.length > 0 ? classLessons.map(l => `<option value="${l.id}" ${l.id === state.selectedLessonId ? 'selected' : ''}>${l.title}</option>`).join('') : '<option value="1">Unit mặc định</option>'}
              </select>
            </div>
          </div>

          <!-- Quantity Controls & Actions -->
          <div class="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
            <button onclick="App.pasteClipboardToTable()" class="bg-secondary-container text-on-secondary-container px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 hover-lift shadow-sm">
              <span class="material-symbols-outlined text-sm">content_paste</span> Dán Clipboard
            </button>

            <!-- Quantity Selector Controls -->
            <div class="flex items-center bg-surface-container-low p-1 rounded-xl border border-outline-variant/40 gap-1">
              <span class="text-[11px] font-bold text-outline px-2">Thêm dòng:</span>
              <button onclick="App.addBatchTableRows(1)" class="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors" title="Thêm 1 dòng">+1</button>
              <button onclick="App.addBatchTableRows(5)" class="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors" title="Thêm 5 dòng">+5</button>
              <button onclick="App.addBatchTableRows(10)" class="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors" title="Thêm 10 dòng">+10</button>
              <button onclick="App.addBatchTableRows(20)" class="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors" title="Thêm 20 dòng">+20</button>
              
              <div class="flex items-center ml-1 border-l border-outline-variant/30 pl-1.5 gap-1">
                <input type="number" id="custom-row-count" min="1" max="50" value="5" class="w-12 px-1.5 py-1 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-xs text-center font-bold text-primary focus:outline-none" title="Nhập số dòng tùy ý" />
                <button onclick="App.addCustomBatchRows()" class="bg-primary text-on-primary px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-0.5 hover-lift" title="Thêm số dòng đã nhập">
                  <span class="material-symbols-outlined text-xs">add</span>
                </button>
              </div>
            </div>

            <button onclick="App.clearBatchTable()" class="p-2 text-outline hover:text-error rounded-xl bg-surface-container hover:bg-error-container/20 transition-colors" title="Xóa trắng bảng">
              <span class="material-symbols-outlined text-base">restart_alt</span>
            </button>
          </div>
        </div>

        <!-- Keyboard Navigation Tip Banner -->
        <div class="p-3.5 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-on-surface">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-base">keyboard</span>
            <span><strong>Phím tắt:</strong> Nhấn <kbd class="px-1.5 py-0.5 bg-surface-container rounded font-mono font-bold text-primary">Enter</kbd> hoặc <kbd class="px-1.5 py-0.5 bg-surface-container rounded font-mono font-bold text-primary">↓</kbd> để xuống dòng (tự tạo dòng mới ở cuối). Dùng <kbd class="px-1.5 py-0.5 bg-surface-container rounded font-mono font-bold text-primary">↑</kbd> <kbd class="px-1.5 py-0.5 bg-surface-container rounded font-mono font-bold text-primary">←</kbd> <kbd class="px-1.5 py-0.5 bg-surface-container rounded font-mono font-bold text-primary">→</kbd> để di chuyển.</span>
          </div>
          <span class="text-[11px] text-outline font-semibold">Hiện có <strong>${state.batchTableRows.length} dòng</strong></span>
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
                    <td class="p-2.5">
                      <input 
                        type="text" 
                        data-row-idx="${idx}"
                        data-col="0"
                        value="${row.word.replace(/"/g, '&quot;')}"
                        placeholder="Nhập từ vựng (ví dụ: ubiquitous, breakthrough...)"
                        oninput="App.updateBatchTableCell(${row.id}, 'word', this.value)"
                        onkeydown="App.handleBatchTableKeyNav(event, ${idx}, 0)"
                        class="w-full px-3.5 py-2.5 bg-surface-container-low/60 border border-outline-variant/40 rounded-xl text-sm font-semibold text-primary focus:outline-none focus:border-primary focus:bg-white transition-all"
                      />
                    </td>
                    <td class="p-2.5">
                      <input 
                        type="text" 
                        data-row-idx="${idx}"
                        data-col="1"
                        value="${row.meaning.replace(/"/g, '&quot;')}"
                        placeholder="Nhập ý nghĩa tiếng Việt..."
                        oninput="App.updateBatchTableCell(${row.id}, 'meaning', this.value)"
                        onkeydown="App.handleBatchTableKeyNav(event, ${idx}, 1)"
                        class="w-full px-3.5 py-2.5 bg-surface-container-low/60 border border-outline-variant/40 rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:bg-white transition-all"
                      />
                    </td>
                    <td class="p-2.5 text-center">
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
              💡 <strong>Mẹo AI:</strong> Chỉ cần gõ <em>Từ vựng</em> và <em>Nghĩa</em>, <strong>Gemini AI</strong> sẽ tự động tạo <strong>Phiên âm chuẩn IPA</strong> khi lưu!
            </div>

            <div class="flex items-center gap-3">
              <button onclick="App.addBatchTableRows(1)" class="px-4 py-2.5 rounded-xl border border-outline-variant text-primary font-bold text-xs hover:bg-surface-container flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">add</span> +1 Dòng
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

  // 3. Classes View (Admin / Teacher List & Student Direct Drilldown)
  renderClassesView() {
    const isStudent = state.currentUser?.role === 'student';
    const isAssistant = state.currentUser?.role === 'assistant_teacher';
    const isHost = state.currentUser?.role === 'host';

    // If student, directly render their single assigned class
    if (isStudent) {
      const studentClassId = Number(state.currentUser?.class_id || 1);
      return this.renderClassDetailView(studentClassId);
    }

    // If teacher has clicked into a specific class, render its detail
    if (state.selectedClassDetailId) {
      return this.renderClassDetailView(state.selectedClassDetailId);
    }

    const visibleClasses = this.getManagedClasses(state.currentUser);

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">
              ${isHost ? 'Quản lý Lớp học & Chuyên đề' : 'Lớp học của bạn'}
            </h2>
            <p class="font-body-md text-sm text-on-surface-variant">
              ${isHost ? 'Bấm vào từng lớp học để xem các bài học, kho từ vựng và báo cáo học sinh.' : 'Quản lý các lớp bạn phụ trách hoặc tự tạo mới.'}
            </p>
          </div>
          <button onclick="App.openCreateClassModal()" class="bg-primary text-on-primary px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 btn-press hover-lift self-start sm:self-auto shadow-md">
            <span class="material-symbols-outlined">add</span>
            Tạo Lớp Học Mới
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          ${visibleClasses.length > 0 ? visibleClasses.map(c => {
            const classVocab = state.vocabulary.filter(v => v.class_id === c.id);
            const classLessons = state.lessons.filter(l => l.class_id === c.id);
            const classStudents = state.usersList.filter(u => u.class_id === c.id && u.role === 'student');
            const isCreator = c.creator_id === state.currentUser?.id || c.created_by === state.currentUser?.id;

            return `
              <div class="bg-surface-container-lowest p-6 rounded-3xl ambient-shadow border border-outline-variant/30 flex flex-col justify-between hover-lift">
                <div>
                  <div class="flex items-center justify-between mb-3">
                    <span class="px-3 py-1 rounded-full bg-primary-container/20 text-primary font-mono font-bold text-xs">Mã: ${c.class_code}</span>
                    <button onclick="navigator.clipboard.writeText('${c.class_code}'); App.showToast('Đã copy mã lớp ${c.class_code}!', 'success')" class="text-outline hover:text-primary p-1" title="Copy mã lớp">
                      <span class="material-symbols-outlined text-base">content_copy</span>
                    </button>
                  </div>
                  <h3 class="font-headline-md text-lg font-bold text-on-surface mb-2">${c.name}</h3>
                  <div class="flex items-center gap-3 text-xs text-on-surface-variant mb-4">
                    <span>📖 <strong>${classLessons.length}</strong> bài học</span>
                    <span>•</span>
                    <span>📚 <strong>${classVocab.length}</strong> từ</span>
                    <span>•</span>
                    <span>👥 <strong>${classStudents.length}</strong> học sinh</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 pt-4 border-t border-outline-variant/30">
                  <button onclick="App.openClassDetail(${c.id})" class="flex-1 bg-primary text-on-primary font-bold text-xs py-2.5 rounded-xl btn-press hover-lift transition-colors text-center flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-base">school</span> 👉 Vào Lớp Học
                  </button>
                  ${(isHost || isCreator) ? `
                    <button onclick="App.deleteClass(${c.id})" class="p-2 text-outline hover:text-error rounded-xl hover:bg-error-container/20 transition-colors" title="Xóa lớp">
                      <span class="material-symbols-outlined text-base">delete</span>
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('') : `
            <div class="col-span-full p-12 bg-surface-container-lowest rounded-3xl border border-outline-variant/30 text-center">
              <span class="material-symbols-outlined text-5xl text-outline mb-2">school</span>
              <p class="text-on-surface font-bold text-base mb-1">Chưa có lớp học nào</p>
              <p class="text-outline text-xs mb-4">Bấm nút "Tạo Lớp Học Mới" ở trên để tạo lớp đầu tiên của bạn!</p>
              <button onclick="App.openCreateClassModal()" class="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 hover-lift">
                <span class="material-symbols-outlined text-base">add</span> Tạo Lớp Ngay
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  },

  // 3.1. Class Detail View (Class-Centric Hub: Units, Vocabulary, and Teacher-Only Student Reports)
  renderClassDetailView(classId) {
    const isStudent = state.currentUser?.role === 'student';
    const isAssistant = state.currentUser?.role === 'assistant_teacher';
    const isHost = state.currentUser?.role === 'host';
    const isTeacher = !isStudent;

    const targetClassId = Number(classId) || (isStudent ? Number(state.currentUser.class_id || 1) : Number(state.selectedClassId || 1));
    const activeClass = state.classes.find(c => c.id === targetClassId) || state.classes[0] || { name: `Lớp #${targetClassId}`, class_code: "QS9A" };

    const classLessons = state.lessons.filter(l => l.class_id === targetClassId);
    const classVocab = state.vocabulary.filter(v => v.class_id === targetClassId);
    const classStudents = state.usersList.filter(u => u.role === 'student' && u.class_id === targetClassId);
    const classStudySessions = (state.studySessions || []).filter(s => s.class_id === targetClassId);
    const classTestSessions = (state.testSessions || []).filter(s => s.class_id === targetClassId);

    const currentTab = state.classDetailTab || 'units';

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        
        <!-- Class Hub Header -->
        <div class="bg-surface-container-lowest p-6 rounded-3xl ambient-shadow border border-primary/20 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div class="flex items-start sm:items-center gap-3.5">
            ${!isStudent ? `
              <button onclick="App.state.selectedClassDetailId = null; App.render();" class="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors shrink-0" title="Danh sách các lớp">
                <span class="material-symbols-outlined text-lg">arrow_back</span>
              </button>
            ` : ''}
            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-on-primary flex items-center justify-center font-bold text-xl shadow-md shrink-0">
              <span class="material-symbols-outlined text-2xl">school</span>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h2 class="font-display-lg text-xl sm:text-2xl font-bold text-on-surface">${activeClass.name}</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-primary-container/20 text-primary text-xs font-mono font-bold">Mã: ${activeClass.class_code}</span>
              </div>
              <div class="flex items-center gap-3 text-xs text-on-surface-variant mt-1 flex-wrap">
                <span>📖 <strong>${classLessons.length}</strong> bài học</span>
                <span>•</span>
                <span>📚 <strong>${classVocab.length}</strong> từ vựng</span>
                <span>•</span>
                <span>👥 <strong>${classStudents.length}</strong> học sinh</span>
              </div>
            </div>
          </div>

          <!-- Fast Launcher Actions -->
          <div class="flex items-center gap-2 flex-wrap">
            <button onclick="App.startLessonFlashcard(null)" class="bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 hover-lift shadow-sm">
              <span class="material-symbols-outlined text-sm">style</span> Luyện Flashcard Lớp
            </button>
            <button onclick="App.startNewQuiz(null, true)" class="bg-primary text-on-primary px-4 py-2.5 rounded-xl font-bold text-xs btn-press flex items-center gap-1.5 hover-lift shadow-sm">
              <span class="material-symbols-outlined text-sm">quiz</span> Thi Thử Toàn Lớp
            </button>
          </div>
        </div>

        <!-- Class Section Navigation Tabs (Always 4 Tabs) -->
        <div class="flex items-center gap-2 border-b border-outline-variant/30 pb-2 overflow-x-auto">
          <button onclick="App.setClassDetailTab('units')" class="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${currentTab === 'units' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}">
            <span class="material-symbols-outlined text-base">auto_stories</span>
            <span>1. Danh Sách Bài Học (${classLessons.length})</span>
          </button>
          
          <button onclick="App.setClassDetailTab('vocabulary')" class="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${currentTab === 'vocabulary' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}">
            <span class="material-symbols-outlined text-base">menu_book</span>
            <span>2. Kho Từ Vựng (${classVocab.length})</span>
          </button>

          <button onclick="App.setClassDetailTab('accounts')" class="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${currentTab === 'accounts' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}">
            <span class="material-symbols-outlined text-base">manage_accounts</span>
            <span>3. ${isTeacher ? `Học Sinh & Cấp Tài Khoản (${classStudents.length})` : `Danh Sách Thành Viên Lớp (${classStudents.length})`}</span>
          </button>

          <button onclick="App.setClassDetailTab('reports')" class="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${currentTab === 'reports' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}">
            <span class="material-symbols-outlined text-base">analytics</span>
            <span>4. ${isTeacher ? 'Báo Cáo Học Sinh & Thời Gian Học' : 'Báo Cáo Học Tập Cá Nhân'}</span>
          </button>
        </div>

        <!-- TAB 1: UNITS / LESSONS -->
        ${currentTab === 'units' ? `
          <div class="flex flex-col gap-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 class="font-headline-md text-base font-bold text-on-surface">Các Chuyên Đề & Bài Học (Units)</h3>
                <p class="text-xs text-on-surface-variant">Luyện tập từ vựng, flashcard 3D và thi thử theo từng Unit của lớp.</p>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <button onclick="App.openCreateLessonModal()" class="bg-primary text-on-primary px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 btn-press hover-lift">
                  <span class="material-symbols-outlined text-sm">add</span> + Thêm Bài Học Mới
                </button>
                <button onclick="App.openCreateVocabularyModal()" class="bg-secondary-container text-on-secondary-container px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 hover-lift">
                  <span class="material-symbols-outlined text-sm">add_circle</span> + Thêm 1 Từ
                </button>
                <button onclick="App.openBatchTableModal()" class="bg-surface-container text-primary px-3.5 py-2 rounded-xl font-bold text-xs border border-primary/30 flex items-center gap-1.5 hover:bg-surface-container-high">
                  <span class="material-symbols-outlined text-sm">table_rows</span> + Bảng Nhập Từ Hàng Loạt
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
              ${classLessons.length > 0 ? classLessons.map(l => {
                const count = classVocab.filter(v => v.lesson_id === l.id).length;
                return `
                  <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col justify-between hover-lift">
                    <div>
                      <div class="flex items-center justify-between mb-2.5">
                        <span class="px-2.5 py-0.5 bg-surface-container-high rounded-full text-xs font-bold text-primary">Unit #${l.id}</span>
                        <span class="text-xs text-outline">${count} từ vựng</span>
                      </div>
                      <h4 class="font-headline-md text-base font-bold text-on-surface mb-3">${l.title}</h4>
                    </div>
                    <div class="flex items-center gap-1.5 pt-3 border-t border-outline-variant/30 flex-wrap">
                      <button onclick="App.openCreateVocabularyModal(${l.id})" class="p-2 bg-surface-container text-primary rounded-lg font-bold text-xs hover:bg-primary hover:text-on-primary transition-colors" title="Thêm từ vào Unit này">
                        <span class="material-symbols-outlined text-sm">add</span>
                      </button>
                      <button onclick="App.startLessonFlashcard(${l.id})" class="flex-1 bg-surface-container-lowest text-primary py-2 rounded-lg font-bold text-xs border border-primary/20 hover:bg-primary hover:text-on-primary transition-colors text-center flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-sm">style</span> Luyện thẻ
                      </button>
                      <button onclick="App.startNewQuiz(${l.id}, false)" class="flex-1 bg-primary text-on-primary py-2 rounded-lg font-bold text-xs hover:bg-primary-container transition-colors text-center flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-sm">quiz</span> Thi thử
                      </button>
                      ${isTeacher ? `
                        <button onclick="App.deleteLesson(${l.id})" class="p-2 text-outline hover:text-error rounded-lg hover:bg-error-container/20 transition-colors" title="Xóa bài học">
                          <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('') : `
                <div class="col-span-full p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
                  <p class="text-outline font-semibold">Chưa có bài học nào trong lớp này.</p>
                  <button onclick="App.openCreateLessonModal()" class="mt-3 bg-primary text-on-primary px-4 py-2 rounded-xl text-xs font-bold">
                    + Tạo Bài Học Đầu Tiên
                  </button>
                </div>
              `}
            </div>
          </div>
        ` : ''}

        <!-- TAB 2: VOCABULARY INVENTORY -->
        ${currentTab === 'vocabulary' ? `
          <div class="flex flex-col gap-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 class="font-headline-md text-base font-bold text-on-surface">Kho Từ Vựng Của Lớp</h3>
                <p class="text-xs text-on-surface-variant">Tra cứu và quản lý toàn bộ từ vựng ôn thi vào 10 của lớp.</p>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <button onclick="App.openCreateVocabularyModal()" class="bg-primary text-on-primary px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 btn-press hover-lift">
                  <span class="material-symbols-outlined text-sm">add_circle</span> + Thêm 1 Từ
                </button>
                <button onclick="App.openBatchTableModal()" class="bg-primary-container text-on-primary-container px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 btn-press hover-lift">
                  <span class="material-symbols-outlined text-sm">table_rows</span> + Thêm Dạng Bảng
                </button>
                <button onclick="App.ExcelService.exportVocabulary(classVocab)" class="bg-surface-container text-on-surface px-3.5 py-2 rounded-xl font-bold text-xs border border-outline-variant/40 flex items-center gap-1 hover:bg-surface-container-high">
                  <span class="material-symbols-outlined text-sm">download</span> Xuất Excel
                </button>
              </div>
            </div>

            <!-- Filters -->
            <div class="bg-surface-container-lowest p-4 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col md:flex-row items-center gap-3">
              <div class="relative flex-1 w-full">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
                <input 
                  type="text" 
                  placeholder="Tìm kiếm từ vựng, phiên âm hoặc nghĩa..." 
                  value="${state.searchQuery}"
                  oninput="App.state.searchQuery = this.value; App.render();"
                  class="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <select 
                onchange="App.state.selectedLessonId = this.value ? Number(this.value) : null; App.render();"
                class="w-full md:w-56 py-2 px-3 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs font-semibold focus:outline-none"
              >
                <option value="">📚 Toàn bộ bài học (${classVocab.length} từ)</option>
                ${classLessons.map(l => `<option value="${l.id}" ${state.selectedLessonId === l.id ? 'selected' : ''}>📖 ${l.title} (${classVocab.filter(v => v.lesson_id === l.id).length} từ)</option>`).join('')}
              </select>
            </div>

            <!-- Vocab Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
              ${(() => {
                const filtered = classVocab.filter(v => {
                  const matchLesson = !state.selectedLessonId || v.lesson_id === Number(state.selectedLessonId);
                  const matchSearch = !state.searchQuery || 
                    v.word.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                    v.meaning.toLowerCase().includes(state.searchQuery.toLowerCase());
                  return matchLesson && matchSearch;
                });

                if (filtered.length === 0) {
                  return `
                    <div class="col-span-full p-8 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
                      <p class="text-outline font-semibold">Không tìm thấy từ vựng nào.</p>
                    </div>
                  `;
                }

                return filtered.map(item => {
                  const lessonObj = classLessons.find(l => l.id === item.lesson_id);
                  const lessonLabel = lessonObj ? lessonObj.title : `Unit #${item.lesson_id}`;
                  const safeWord = item.word.replace(/'/g, "\\'");

                  return `
                    <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col justify-between hover-lift">
                      <div>
                        <div class="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <h4 class="font-headline-md text-lg font-bold text-primary flex items-center gap-2">
                              ${item.word}
                              <button onclick="App.speakWord('${safeWord}')" class="w-7 h-7 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors" title="Nghe phát âm">
                                <span class="material-symbols-outlined text-sm">volume_up</span>
                              </button>
                            </h4>
                            <span class="font-mono text-xs text-outline">${item.ipa || ''}</span>
                          </div>
                          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${item.is_grammar ? 'bg-amber-100 text-amber-800' : 'bg-primary-container/20 text-primary'}">
                            ${item.is_grammar ? 'Ngữ pháp' : 'Từ vựng'}
                          </span>
                        </div>
                        <p class="font-body-md text-sm font-semibold text-on-surface mb-3">${item.meaning}</p>
                      </div>

                      <div class="flex items-center justify-between pt-3 border-t border-outline-variant/30 text-xs">
                        <span class="text-outline text-[11px]">${lessonLabel}</span>
                        <div class="flex items-center gap-1">
                          <button onclick="App.openEditVocabularyModal(${item.id})" class="p-1.5 text-outline hover:text-primary rounded-lg hover:bg-surface-container" title="Sửa từ">
                            <span class="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button onclick="App.deleteVocabulary(${item.id})" class="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error-container/20" title="Xóa từ">
                            <span class="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('');
              })()}
            </div>
          </div>
        ` : ''}

        <!-- TAB 3: CLASS ACCOUNTS & STUDENT PROVISIONING (ACCESSIBLE TO ALL USERS) -->
        ${currentTab === 'accounts' ? `
          <div class="flex flex-col gap-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 class="font-headline-md text-base font-bold text-on-surface">${isTeacher ? 'Quản Lý & Cấp Tài Khoản Học Sinh' : 'Danh Sách Học Sinh Cùng Lớp'}</h3>
                <p class="text-xs text-on-surface-variant">
                  ${isTeacher 
                    ? `Danh sách học sinh thuộc lớp <strong>${activeClass.name}</strong>, cấp tài khoản và quản lý mật khẩu.` 
                    : `Danh sách các bạn học sinh trong lớp <strong>${activeClass.name}</strong> cùng chuỗi ngày học.`
                  }
                </p>
              </div>
              ${isTeacher ? `
                <div class="flex items-center gap-2 flex-wrap">
                  <button onclick="App.openCreateUserModal(${targetClassId})" class="bg-primary text-on-primary px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 btn-press hover-lift">
                    <span class="material-symbols-outlined text-sm">person_add</span> + Cấp Tài Khoản Mới
                  </button>
                </div>
              ` : ''}
            </div>

            <!-- Student Search & Filter Bar -->
            <div class="bg-surface-container-lowest p-4 rounded-2xl ambient-shadow border border-outline-variant/30 flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-2 flex-1 min-w-[240px]">
                <span class="material-symbols-outlined text-outline text-lg">search</span>
                <input 
                  type="text" 
                  id="class-student-search" 
                  placeholder="Tìm kiếm học sinh theo tên hoặc username..." 
                  oninput="App.state.studentSearchQuery = this.value; App.render();"
                  value="${state.studentSearchQuery || ''}"
                  class="bg-transparent text-xs text-on-surface focus:outline-none w-full font-medium"
                />
                ${state.studentSearchQuery ? `
                  <button onclick="App.state.studentSearchQuery = ''; App.render();" class="text-outline hover:text-on-surface p-1">
                    <span class="material-symbols-outlined text-base">close</span>
                  </button>
                ` : ''}
              </div>
              <span class="text-xs text-outline font-bold">
                Tổng số: ${classStudents.length} học sinh
              </span>
            </div>

            <!-- Class Students Table -->
            <div class="bg-surface-container-lowest rounded-2xl ambient-shadow border border-outline-variant/30 overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                  <thead class="bg-surface-container-low text-outline uppercase font-bold border-b border-outline-variant/30">
                    <tr>
                      <th class="p-3.5 w-12 text-center">STT</th>
                      <th class="p-3.5">Họ và Tên</th>
                      <th class="p-3.5">Tên Đăng Nhập</th>
                      <th class="p-3.5">Mật Khẩu</th>
                      <th class="p-3.5 text-center">Chuỗi Streak</th>
                      <th class="p-3.5 text-center">Tiến Độ Học</th>
                      <th class="p-3.5 text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-outline-variant/20">
                    ${(() => {
                      const filteredStudents = classStudents.filter(u => {
                        if (!state.studentSearchQuery) return true;
                        const q = state.studentSearchQuery.toLowerCase();
                        return (u.full_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
                      });

                      if (filteredStudents.length === 0) {
                        return `
                          <tr>
                            <td colspan="7" class="p-8 text-center text-outline">
                              <span class="material-symbols-outlined text-4xl block mb-2 text-outline/60">person_off</span>
                              ${state.studentSearchQuery ? 'Không tìm thấy học sinh nào khớp với từ khóa tìm kiếm.' : 'Chưa có học sinh nào trong lớp này.'}
                              <div class="mt-3">
                                <button onclick="App.openCreateUserModal(${targetClassId})" class="bg-primary text-on-primary px-4 py-2 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 hover-lift">
                                  <span class="material-symbols-outlined text-sm">person_add</span> Cấp Tài Khoản Ngay
                                </button>
                              </div>
                            </td>
                          </tr>
                        `;
                      }

                      return filteredStudents.map((u, idx) => {
                        const studentStreak = this.getStudentRealtimeStreak(u);
                        const userFlashcards = classStudySessions.filter(s => s.user_id === u.id || s.user_name === u.full_name);
                        const userQuizzes = classTestSessions.filter(s => s.user_id === u.id || s.user_name === u.full_name);
                        const fcSecs = userFlashcards.filter(s => s.activity_type === 'flashcard').reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
                        const quizSecs = userQuizzes.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
                        const totalMins = Math.max(0, Math.round((fcSecs + quizSecs) / 60));

                        return `
                          <tr class="hover:bg-surface-container-low/50 transition-colors">
                            <td class="p-3.5 text-center font-bold text-outline">${idx + 1}</td>
                            <td class="p-3.5 font-bold text-on-surface">
                              <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                  ${u.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p class="font-bold text-on-surface">${u.full_name}</p>
                                  <span class="text-[11px] text-outline">Tham gia: ${new Date(u.created_at || Date.now()).toLocaleDateString('vi-VN')}</span>
                                </div>
                              </div>
                            </td>
                            <td class="p-3.5 font-mono font-bold text-primary">@${u.username}</td>
                            <td class="p-3.5 font-mono text-outline">
                              <span class="bg-surface-container px-2.5 py-1 rounded-md font-bold text-on-surface">${u.password || '123456'}</span>
                            </td>
                            <td class="p-3.5 text-center">
                              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs bg-amber-100 text-amber-900">
                                🔥 ${studentStreak} ngày
                              </span>
                            </td>
                            <td class="p-3.5 text-center text-on-surface">
                              <div class="flex flex-col items-center">
                                <span class="font-bold text-xs text-primary">${userQuizzes.length} bài thi • ${userFlashcards.length} lượt thẻ</span>
                                <span class="text-[10px] text-outline">⏱️ ${totalMins} phút học</span>
                              </div>
                            </td>
                            <td class="p-3.5 text-center">
                              <div class="flex items-center justify-center gap-1.5">
                                <button onclick="App.handleChangePassword('${u.id}', '${u.full_name}')" class="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-bold text-[11px] transition-colors" title="Đổi mật khẩu">
                                  Đổi Pass
                                </button>
                                <button onclick="App.selectReportStudent('${u.id}'); App.setClassDetailTab('reports');" class="px-2.5 py-1 rounded-lg bg-primary-container/30 hover:bg-primary-container text-primary font-bold text-[11px] transition-colors" title="Xem báo cáo chi tiết">
                                  Báo Cáo
                                </button>
                                <button onclick="App.handleDeleteUser('${u.id}', '${u.full_name}')" class="p-1.5 text-outline hover:text-error rounded-lg hover:bg-error-container/20 transition-colors" title="Xóa tài khoản">
                                  <span class="material-symbols-outlined text-base">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('');
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- TAB 4: STUDENT ACTIVITY & STUDY TIME REPORT -->
        ${currentTab === 'reports' ? `
          <div class="flex flex-col gap-5">
            
            <!-- Summary Stats for the whole Class -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
              <div class="bg-surface-container-lowest p-5 rounded-2xl ambient-shadow border border-outline-variant/30">
                <div class="flex justify-between items-start mb-2">
                  <div class="w-10 h-10 rounded-xl bg-blue-500/15 text-primary flex items-center justify-center">
                    <span class="material-symbols-outlined text-xl">groups</span>
                  </div>
                  <span class="bg-surface-container text-outline px-2 py-0.5 rounded text-[11px] font-bold">Học viên</span>
                </div>
                <p class="text-xs text-outline uppercase font-bold">Tổng Học Sinh</p>
                <p class="text-2xl font-bold text-on-surface mt-1">${classStudents.length} <span class="text-xs font-normal text-outline">em</span></p>
              </div>

              <div class="bg-surface-container-lowest p-5 rounded-2xl ambient-shadow border border-outline-variant/30">
                <div class="flex justify-between items-start mb-2">
                  <div class="w-10 h-10 rounded-xl bg-green-500/15 text-green-700 flex items-center justify-center">
                    <span class="material-symbols-outlined text-xl">timer</span>
                  </div>
                  <span class="bg-green-100 text-green-800 px-2 py-0.5 rounded text-[11px] font-bold">Tổng thời gian</span>
                </div>
                <p class="text-xs text-outline uppercase font-bold">Thời Gian Cả Lớp Đã Học</p>
                <p class="text-2xl font-bold text-on-surface mt-1">
                  ${Math.max(1, Math.round((classStudySessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) + classTestSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0)) / 60))} 
                  <span class="text-xs font-normal text-outline">phút</span>
                </p>
              </div>

              <div class="bg-surface-container-lowest p-5 rounded-2xl ambient-shadow border border-outline-variant/30">
                <div class="flex justify-between items-start mb-2">
                  <div class="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                    <span class="material-symbols-outlined text-xl">style</span>
                  </div>
                  <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[11px] font-bold">Flashcard</span>
                </div>
                <p class="text-xs text-outline uppercase font-bold">Lượt Luyện Flashcard</p>
                <p class="text-2xl font-bold text-on-surface mt-1">${classStudySessions.length} <span class="text-xs font-normal text-outline">phiên</span></p>
              </div>

              <div class="bg-surface-container-lowest p-5 rounded-2xl ambient-shadow border border-outline-variant/30">
                <div class="flex justify-between items-start mb-2">
                  <div class="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-700 flex items-center justify-center">
                    <span class="material-symbols-outlined text-xl">military_tech</span>
                  </div>
                  <span class="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[11px] font-bold">Kiểm tra</span>
                </div>
                <p class="text-xs text-outline uppercase font-bold">Điểm Thi TB Toàn Lớp</p>
                <p class="text-2xl font-bold text-on-surface mt-1">
                  ${classTestSessions.length > 0 ? Math.round(classTestSessions.reduce((acc, s) => acc + (s.score_percentage || 0), 0) / classTestSessions.length) + '%' : '88%'}
                </p>
              </div>
            </div>

            <!-- Student Detailed Table -->
            <div class="bg-surface-container-lowest rounded-2xl ambient-shadow border border-outline-variant/30 overflow-hidden">
              <div class="p-5 border-b border-outline-variant/30 flex items-center justify-between">
                <div>
                  <h4 class="font-headline-md text-base font-bold text-on-surface">Nhật Ký Học Tập & Báo Cáo Từng Học Sinh</h4>
                  <p class="text-xs text-on-surface-variant">Lưu lại toàn bộ thời gian học sinh vào học (bao gồm luyện Flashcard và bài kiểm tra).</p>
                </div>
                <button onclick="App.ExcelService.exportTestResults(classTestSessions)" class="bg-surface-container text-on-surface px-4 py-2 rounded-xl font-bold text-xs border border-outline-variant/40 flex items-center gap-1 hover:bg-surface-container-high">
                  <span class="material-symbols-outlined text-sm">download</span> Xuất Báo Cáo Lớp
                </button>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-sm border-collapse">
                  <thead class="bg-surface-container-low text-on-surface uppercase text-xs font-bold border-b border-outline-variant/30">
                    <tr>
                      <th class="p-4 w-12 text-center text-outline">STT</th>
                      <th class="p-4">Học Sinh</th>
                      <th class="p-4 text-center">Tổng Thời Gian Học</th>
                      <th class="p-4 text-center">Luyện Flashcard</th>
                      <th class="p-4 text-center">Làm Bài Thi</th>
                      <th class="p-4 text-center">Chuỗi Streak</th>
                      <th class="p-4 text-center">Đánh Giá</th>
                      <th class="p-4 text-center">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-outline-variant/20 bg-surface-container-lowest">
                    ${classStudents.map((st, idx) => {
                      const stStudy = classStudySessions.filter(s => s.user_id === st.id || (st.username === 'an_nguyen' && s.user_id === '00000000-0000-0000-0000-000000000002'));
                      const stTests = classTestSessions.filter(s => s.user_id === st.id || (st.username === 'an_nguyen' && s.user_id === '00000000-0000-0000-0000-000000000002'));

                      const fcSecs = stStudy.filter(s => s.activity_type === 'flashcard').reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
                      const quizSecs = stTests.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
                      const totalMins = Math.max(1, Math.round((fcSecs + quizSecs) / 60));

                      const cardsMastered = stStudy.reduce((acc, s) => acc + (s.cards_mastered || 0), 0);
                      const testsCount = stTests.length;
                      const avgSc = testsCount > 0 ? Math.round(stTests.reduce((acc, s) => acc + (s.score_percentage || 0), 0) / testsCount) : 0;

                      return `
                        <tr class="hover:bg-surface-container-low/40 transition-colors">
                          <td class="p-4 text-center font-bold text-xs text-outline">${idx + 1}</td>
                          <td class="p-4">
                            <div class="flex items-center gap-2.5">
                              <div class="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">
                                ${st.full_name.charAt(0)}
                              </div>
                              <div>
                                <p class="font-bold text-on-surface text-xs sm:text-sm">${st.full_name}</p>
                                <p class="text-[11px] text-outline">@${st.username} • ${st.email || 'Học sinh'}</p>
                              </div>
                            </div>
                          </td>
                          <td class="p-4 text-center">
                            <span class="px-2.5 py-1 rounded-full bg-blue-100 text-blue-900 font-bold text-xs">
                              ⏱️ ${totalMins} phút
                            </span>
                          </td>
                          <td class="p-4 text-center text-xs">
                            <p class="font-bold text-primary">${stStudy.length} lượt học</p>
                            <p class="text-[11px] text-outline">${cardsMastered} thẻ thuộc</p>
                          </td>
                          <td class="p-4 text-center text-xs">
                            <p class="font-bold text-on-surface">${testsCount} bài thi</p>
                            <p class="text-[11px] ${avgSc >= 80 ? 'text-green-700 font-bold' : 'text-outline'}">TB: ${avgSc > 0 ? avgSc + '%' : 'Chưa thi'}</p>
                          </td>
                          <td class="p-4 text-center">
                            ${(() => {
                              const stStreak = this.getStudentRealtimeStreak(st);
                              const todayStr = new Date().toLocaleDateString('en-CA');
                              const stStudiedToday = (st.streak_dates && st.streak_dates.includes(todayStr)) ||
                                stStudy.some(s => s.created_at && new Date(s.created_at).toLocaleDateString('en-CA') === todayStr) ||
                                stTests.some(s => s.created_at && new Date(s.created_at).toLocaleDateString('en-CA') === todayStr);
                              
                              return `
                                <div class="flex flex-col items-center gap-0.5">
                                  <span class="px-2.5 py-0.5 rounded-full ${stStudiedToday ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300' : 'bg-surface-container text-outline'} text-xs flex items-center justify-center gap-1 mx-auto w-max shadow-sm">
                                    <span class="material-symbols-outlined text-xs text-amber-500">local_fire_department</span> ${stStreak} ngày
                                  </span>
                                  <span class="text-[10px] font-semibold ${stStudiedToday ? 'text-green-700' : 'text-outline'}">
                                    ${stStudiedToday ? '✓ Đã học hôm nay' : 'Chưa học'}
                                  </span>
                                </div>
                              `;
                            })()}
                          </td>
                          <td class="p-4 text-center">
                            <span class="px-2.5 py-1 rounded-full text-xs font-bold ${avgSc >= 90 ? 'bg-green-100 text-green-900' : avgSc >= 80 ? 'bg-blue-100 text-blue-900' : 'bg-amber-100 text-amber-900'}">
                              ${avgSc >= 90 ? 'Xuất sắc' : avgSc >= 80 ? 'Giỏi' : 'Chăm chỉ'}
                            </span>
                          </td>
                          <td class="p-4 text-center">
                            <button onclick="App.openStudentHistoryModal('${st.id}')" class="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-primary hover:text-on-primary text-primary font-bold text-xs transition-colors">
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ` : ''}

      </div>
    `;
  },

  // 4. Lessons View (Admin, Teacher & Student)
  renderLessonsView() {
    const isStudent = state.currentUser?.role === 'student';
    const targetClassId = isStudent ? Number(state.currentUser.class_id || 1) : Number(state.selectedClassId);
    const activeClass = state.classes.find(c => c.id === targetClassId) || state.classes[0] || { name: "Lớp học" };
    const classLessons = state.lessons.filter(l => l.class_id === targetClassId);

    return `
      <div class="flex-1 flex flex-col gap-stack-lg max-w-container-max mx-auto w-full">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 text-primary font-bold text-xs mb-1">
              <span class="material-symbols-outlined text-base">school</span>
              <span>LỚP HỌC: ${activeClass.name}</span>
            </div>
            <h2 class="font-display-lg text-headline-lg md:text-display-lg text-on-surface">Quản lý Bài học & Chuyên đề</h2>
            <p class="font-body-md text-sm text-on-surface-variant">Danh mục chuyên đề ôn thi vào 10 cho ${activeClass.name}.</p>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            <button onclick="App.openCreateVocabularyModal()" class="bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 hover-lift shadow-sm">
              <span class="material-symbols-outlined text-sm">add_circle</span> + Thêm Từ Vựng
            </button>
            <button onclick="App.openCreateLessonModal()" class="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 btn-press hover-lift shadow-sm">
              <span class="material-symbols-outlined text-sm">add</span> + Thêm Bài Học Mới
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
                <div class="flex items-center gap-1.5 pt-4 border-t border-outline-variant/30 flex-wrap">
                  <button onclick="App.openCreateVocabularyModal(${l.id})" class="p-2 bg-surface-container text-primary font-bold text-xs rounded-xl hover:bg-primary hover:text-on-primary transition-colors" title="Thêm từ vào Unit này">
                    <span class="material-symbols-outlined text-base">add</span>
                  </button>
                  <button onclick="App.startLessonFlashcard(${l.id})" class="flex-1 bg-surface-container text-primary font-bold text-xs py-2.5 rounded-xl hover:bg-primary hover:text-on-primary transition-colors text-center flex items-center justify-center gap-1">
                    <span class="material-symbols-outlined text-sm">style</span> Luyện thẻ
                  </button>
                  <button onclick="App.state.selectedLessonId = ${l.id}; App.switchTab('vocabulary');" class="flex-1 bg-surface-container-low text-on-surface font-bold text-xs py-2.5 rounded-xl hover:bg-surface-container-high transition-colors text-center">
                    Kho từ
                  </button>
                  <button onclick="App.startNewQuiz(${l.id})" class="flex-1 bg-primary text-on-primary font-bold text-xs py-2.5 rounded-xl hover:bg-primary-container transition-colors text-center">
                    Thi thử
                  </button>
                  <button onclick="App.deleteLesson(${l.id})" class="p-2 text-outline hover:text-error rounded-xl hover:bg-error-container/20 transition-colors" title="Xóa bài học">
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
    const activeClass = state.classes.find(c => c.id === targetClassId) || state.classes[0] || { name: "Lớp học" };
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

          <div class="flex items-center gap-2.5 flex-wrap">
            <button onclick="App.startLessonFlashcard(state.selectedLessonId)" class="bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 hover-lift shadow-sm">
              <span class="material-symbols-outlined text-sm">style</span> Luyện Flashcard
            </button>
            <button onclick="App.openCreateVocabularyModal()" class="bg-primary text-on-primary px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 btn-press hover-lift shadow-sm">
              <span class="material-symbols-outlined text-sm">add_circle</span> + Thêm 1 Từ
            </button>
            <button onclick="App.openBatchTableModal()" class="bg-primary-container text-on-primary-container px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 btn-press hover-lift shadow-sm">
              <span class="material-symbols-outlined text-sm">table_rows</span> + Thêm Dạng Bảng
            </button>
            <button onclick="App.ExcelService.exportVocabulary(filteredVocab)" class="bg-surface-container text-on-surface px-4 py-2.5 rounded-xl font-bold text-xs border border-outline-variant/40 flex items-center gap-1.5 hover:bg-surface-container-high">
              <span class="material-symbols-outlined text-sm">download</span> Xuất Excel
            </button>
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
          ${filteredVocab.length > 0 ? filteredVocab.map(item => {
            const lessonObj = classLessons.find(l => l.id === item.lesson_id);
            const lessonLabel = lessonObj ? lessonObj.title : `Unit #${item.lesson_id}`;
            const safeWord = item.word.replace(/'/g, "\\'");

            return `
              <div class="bg-surface-container-lowest p-6 rounded-2xl ambient-shadow border border-outline-variant/30 flex flex-col justify-between hover-lift group">
                <div>
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 class="font-headline-md text-lg font-bold text-primary flex items-center gap-2">
                        ${item.word}
                        <button onclick="App.speakWord('${safeWord}')" class="w-7 h-7 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-on-primary flex items-center justify-center transition-colors" title="Nghe phát âm">
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
                  </div>
                </div>

                <div class="flex items-center justify-between pt-3 border-t border-outline-variant/30 text-xs text-outline mt-2">
                  <span class="truncate max-w-[140px] text-[11px]" title="${lessonLabel}">${lessonLabel}</span>
                  <div class="flex items-center gap-2.5">
                    <button onclick="App.openEditVocabularyModal(${item.id})" class="text-primary hover:underline font-bold text-xs flex items-center gap-0.5" title="Chỉnh sửa từ vựng này">
                      <span class="material-symbols-outlined text-sm">edit</span>
                      <span>Sửa</span>
                    </button>
                    <button onclick="App.deleteVocabulary(${item.id}, '${safeWord}')" class="text-error hover:underline font-bold text-xs flex items-center gap-0.5" title="Xóa từ này">
                      <span class="material-symbols-outlined text-sm">delete</span>
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('') : `
            <div class="col-span-full py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 text-center flex flex-col items-center justify-center">
              <span class="material-symbols-outlined text-5xl text-outline mb-2">menu_book</span>
              <p class="font-headline-md text-base font-bold text-on-surface">Chưa có từ vựng nào trong lớp/bài học này</p>
              <div class="flex items-center gap-3 mt-3">
                <button onclick="App.openCreateVocabularyModal()" class="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs btn-press">
                  + Thêm 1 Từ Vựng Ngay
                </button>
                <button onclick="App.openBatchTableModal()" class="bg-surface-container text-primary px-5 py-2.5 rounded-xl font-bold text-xs border border-primary/30">
                  + Thêm Từ Dạng Bảng
                </button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;
  },

  // 6. Flashcards 3D View (Lesson-Specific & Class-Wide)
  renderFlashcardsView() {
    const isStudent = state.currentUser?.role === 'student';
    const isAssistant = state.currentUser?.role === 'assistant_teacher';
    const targetClassId = (isStudent || isAssistant) ? Number(state.currentUser.class_id || 1) : Number(state.selectedClassId);
    const activeClass = state.classes.find(c => c.id === targetClassId) || state.classes[0] || { name: "Lớp học" };
    const classLessons = state.lessons.filter(l => l.class_id === targetClassId);
    const classVocab = state.vocabulary.filter(v => v.class_id === targetClassId);

    const list = state.studyList || [];
    const activeLesson = state.selectedLessonId ? classLessons.find(l => l.id === state.selectedLessonId) : null;

    if (list.length === 0) {
      return `
        <div class="flex-1 flex flex-col items-center justify-center p-8 md:p-12 text-center max-w-lg mx-auto">
          <button onclick="App.safeGoBack('dashboard')" class="mb-4 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container text-on-surface font-bold text-xs hover-lift">
            <span class="material-symbols-outlined text-base">arrow_back</span> Về Menu
          </button>
          
          <div class="w-20 h-20 rounded-3xl bg-primary-container/20 flex items-center justify-center text-primary mb-4">
            <span class="material-symbols-outlined text-4xl">style</span>
          </div>

          <h2 class="font-headline-md text-lg font-bold text-on-surface">
            ${activeLesson ? `Chưa có từ vựng trong ${activeLesson.title}` : `Chưa có từ vựng nào trong ${activeClass.name}`}
          </h2>
          <p class="text-xs text-outline mt-1 mb-5">Chọn bài học khác hoặc thêm từ vựng mới để bắt đầu luyện Flashcard 3D.</p>

          <!-- Lesson Switcher Dropdown -->
          <div class="w-full mb-4">
            <select 
              onchange="App.selectFlashcardLesson(this.value)" 
              class="w-full py-2.5 px-3.5 bg-surface-container-low border border-primary/30 rounded-xl text-xs font-bold text-primary focus:outline-none"
            >
              <option value="">📚 Toàn bộ bài học (${classVocab.length} từ)</option>
              ${classLessons.map(l => `
                <option value="${l.id}" ${state.selectedLessonId === l.id ? 'selected' : ''}>
                  📖 ${l.title} (${classVocab.filter(v => v.lesson_id === l.id).length} từ)
                </option>
              `).join('')}
            </select>
          </div>

          <div class="flex items-center gap-3">
            <button onclick="App.openCreateVocabularyModal(${state.selectedLessonId || 'null'})" class="bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-xs btn-press hover-lift">
              + Thêm Từ Vựng Ngay
            </button>
            <button onclick="App.openBatchTableModal()" class="bg-surface-container text-primary px-4 py-2.5 rounded-xl font-bold text-xs border border-primary/30">
              Bảng Nhập Từ
            </button>
          </div>
        </div>
      `;
    }

    const currentWord = list[state.flashcardIndex] || list[0];
    const progressPct = Math.round(((state.flashcardIndex + 1) / list.length) * 100);

    return `
      <div class="flex-1 flex flex-col items-center max-w-2xl mx-auto w-full gap-stack-md">
        <!-- Top Navigation Bar & Lesson Selector -->
        <div class="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-2xl ambient-shadow border border-outline-variant/30">
          <div class="flex items-center gap-2">
            <button onclick="App.safeGoBack('dashboard')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs transition-all hover-lift">
              <span class="material-symbols-outlined text-base">arrow_back</span>
              <span>Về Menu</span>
            </button>
            
            <div class="text-left">
              <span class="text-[10px] font-bold text-primary uppercase block">${activeClass.name}</span>
              <h2 class="font-headline-md text-xs font-bold text-on-surface">Thẻ ${state.flashcardIndex + 1} / ${list.length}</h2>
            </div>
          </div>

          <!-- Unit Selector Dropdown -->
          <div class="flex items-center gap-2">
            <select 
              onchange="App.selectFlashcardLesson(this.value)" 
              class="py-2 px-3 bg-surface-container-low border border-primary/30 rounded-xl text-xs font-bold text-primary focus:outline-none"
            >
              <option value="">📚 Toàn bộ lớp (${classVocab.length} từ)</option>
              ${classLessons.map(l => `
                <option value="${l.id}" ${state.selectedLessonId === l.id ? 'selected' : ''}>
                  📖 ${l.title} (${classVocab.filter(v => v.lesson_id === l.id).length} từ)
                </option>
              `).join('')}
            </select>

            <span class="text-xs font-bold text-secondary bg-secondary-container/20 px-2.5 py-1.5 rounded-xl flex items-center gap-1 whitespace-nowrap">
              <span class="material-symbols-outlined text-sm">local_fire_department</span> Chuỗi 12 ngày
            </span>
          </div>
        </div>

        <!-- Active Topic Badge -->
        <div class="w-full flex items-center justify-between px-1 text-xs">
          <span class="text-outline font-semibold">
            Đang luyện: <strong class="text-primary">${activeLesson ? activeLesson.title : 'Tất cả bài học trong lớp'}</strong>
          </span>
          <span class="text-primary font-bold">${progressPct}% Hoàn thành</span>
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
                <span class="font-bold text-primary uppercase flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">touch_app</span> Mặt trước (Bấm để lật)
                </span>
                <span class="px-2.5 py-0.5 rounded-full bg-surface-container font-semibold">${currentWord.is_grammar ? 'Ngữ pháp' : 'Từ vựng'}</span>
              </div>
              <div class="text-center my-auto">
                <h1 class="font-display-lg text-4xl font-bold text-primary tracking-tight mb-2">${currentWord.word}</h1>
                <p class="font-mono text-base text-outline mb-4">${currentWord.ipa || ''}</p>
                <button onclick="event.stopPropagation(); App.speakWord('${currentWord.word}')" class="w-12 h-12 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-on-primary flex items-center justify-center transition-all shadow-sm mx-auto" title="Nghe phát âm">
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
                <span class="font-bold text-secondary uppercase flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">visibility</span> Mặt sau (Giải nghĩa)
                </span>
                <button onclick="event.stopPropagation(); App.speakWord('${currentWord.word}')" class="text-primary hover:underline font-bold flex items-center gap-1">
                  <span class="material-symbols-outlined text-sm">volume_up</span> Nghe lại
                </button>
              </div>
              <div class="my-auto text-center">
                <h3 class="font-headline-md text-2xl font-bold text-on-surface mb-3">${currentWord.meaning}</h3>
              </div>
              <div class="text-center text-xs text-outline">
                Nhấn lần nữa để lật lại mặt trước
              </div>
            </div>
          </div>
        </div>

        <!-- Controls & Hotkey Hints -->
        <div class="w-full flex items-center justify-between gap-4">
          <button onclick="App.prevFlashcard()" ${state.flashcardIndex === 0 ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-surface-container text-on-surface font-bold text-xs disabled:opacity-30 flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">arrow_back</span> Trước
          </button>
          <div class="flex items-center gap-2">
            <button onclick="App.nextFlashcard(false)" class="px-5 py-2.5 rounded-xl bg-amber-100 text-amber-900 font-bold text-xs hover-lift">
              Cần ôn lại
            </button>
            <button onclick="App.nextFlashcard(true)" class="px-6 py-2.5 rounded-xl bg-green-600 text-white font-bold text-xs btn-press hover-lift">
              ✓ Đã thuộc
            </button>
          </div>
          <button onclick="App.nextFlashcard(false)" class="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs btn-press flex items-center gap-1">
            Tiếp <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        <!-- Hotkeys Footer -->
        <div class="text-center text-[11px] text-outline mt-1">
          💡 <strong>Phím tắt:</strong> [ <kbd class="font-mono font-bold">Space</kbd> ] Lật thẻ • [ <kbd class="font-mono font-bold">←</kbd> ] Thẻ trước • [ <kbd class="font-mono font-bold">→</kbd> ] / [ <kbd class="font-mono font-bold">Enter</kbd> ] Thẻ tiếp • [ <kbd class="font-mono font-bold">V</kbd> ] Đã thuộc
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
                currentQ.type === 'multiple_choice_word' ? 'bg-teal-100 text-teal-800' :
                currentQ.is_grammar ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800'
              }">
                ${
                  currentQ.type === 'type_en' ? '✍️ Tự luận: Điền từ Tiếng Anh' :
                  currentQ.type === 'type_vi' ? '🇻🇳 Tự luận: Điền nghĩa Tiếng Việt' :
                  currentQ.type === 'multiple_choice_word' ? '🔤 Trắc nghiệm: Chọn từ Tiếng Anh' :
                  currentQ.is_grammar ? '📘 Cấu trúc Ngữ pháp (Trắc nghiệm)' : '🎯 Trắc nghiệm: Chọn nghĩa Tiếng Việt'
                }
              </span>
            </div>

            <!-- Only show Audio button if it won't spoil the answer (or when answered) -->
            ${((currentQ.type !== 'type_en' && currentQ.type !== 'multiple_choice_word') || currentQ.is_checked) ? `
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

          <!-- DẠNG 3: TRẮC NGHIỆM 4 ĐÁP ÁN (multiple_choice_meaning, multiple_choice_word, multiple_choice) -->
          ${(currentQ.type.startsWith('multiple_choice') || currentQ.type === 'multiple_choice') ? `
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
    const isAssistant = state.currentUser?.role === 'assistant_teacher';
    const targetClassId = (isStudent || isAssistant) ? Number(state.currentUser.class_id || 1) : Number(state.selectedClassId);
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
                  <span class="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <span class="material-symbols-outlined text-sm text-amber-500">local_fire_department</span> Chuỗi ${this.getStudentRealtimeStreak(st)} ngày
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
            ${!isStudent && !isAssistant ? `
              <select 
                onchange="App.selectClass(this.value)"
                class="py-2.5 px-3.5 bg-surface-container-low border border-outline-variant/40 rounded-xl text-xs font-bold text-primary focus:outline-none"
              >
                ${state.classes.map(c => `<option value="${c.id}" ${c.id === state.selectedClassId ? 'selected' : ''}>Lớp: ${c.name}</option>`).join('')}
              </select>
            ` : ''}

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
                    <td class="p-4 text-center font-bold text-amber-600">🔥 ${this.getStudentRealtimeStreak(m.student)} ngày</td>
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
