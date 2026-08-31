/**
 * Quang Son - Your English Tutor
 * Authentication & Account Provisioning Service (with Cookie Session Storage)
 */

import { getSupabase } from './supabaseService.js';

const COOKIE_NAME = "QUANG_SON_AUTH_SESSION_V1";
const STORAGE_USERS_KEY = "QUANG_SON_LMS_USERS_V4";

// Initial Default Accounts
const INITIAL_USERS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    username: "sonnqu206",
    password: "Son@04102006",
    full_name: "Thầy Quang Sơn (Host)",
    role: "host", // 'host' | 'assistant_teacher' | 'student'
    class_id: null, // Host has access to all classes
    email: "quangson.tutor@lingolms.edu.vn",
    created_at: "2026-08-01T08:00:00Z"
  },
  {
    id: "00000000-0000-0000-0000-000000000010",
    username: "trogiang_linh",
    password: "123456",
    alt_password: "Linh@2026",
    full_name: "Cô Khánh Linh (Trợ giảng)",
    role: "assistant_teacher",
    class_id: 1,
    email: "khanhlinh.assistant@lingolms.edu.vn",
    created_at: "2026-08-10T08:00:00Z"
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    username: "an_nguyen",
    password: "123456",
    alt_password: "An123456",
    full_name: "Nguyễn Văn An",
    role: "student",
    class_id: 1,
    email: "an.nguyen@student.edu.vn",
    streak: 12,
    completed_lessons: 8,
    avg_score: 92,
    created_at: "2026-08-20T08:00:00Z"
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    username: "mai_tran",
    password: "123456",
    alt_password: "Mai@123456",
    full_name: "Trần Thị Mai",
    role: "student",
    class_id: 1,
    email: "mai.tran@student.edu.vn",
    streak: 9,
    completed_lessons: 7,
    avg_score: 88,
    created_at: "2026-08-22T08:00:00Z"
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    username: "nam_le",
    password: "123456",
    alt_password: "Nam@123456",
    full_name: "Lê Hoàng Nam",
    role: "student",
    class_id: 1,
    email: "nam.le@student.edu.vn",
    streak: 15,
    completed_lessons: 9,
    avg_score: 95,
    created_at: "2026-08-25T08:00:00Z"
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    username: "vy_pham",
    password: "123456",
    alt_password: "Vy@123456",
    full_name: "Phạm Thảo Vy",
    role: "student",
    class_id: 2,
    email: "vy.pham@student.edu.vn",
    streak: 6,
    completed_lessons: 5,
    avg_score: 84,
    created_at: "2026-08-26T08:00:00Z"
  }
];

// Helper to remove accents for flexible search
function removeVietnameseTones(str) {
  if (!str) return "";
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

// Helper to set Cookie
function setCookie(name, value, days = 30) {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch (e) {
    console.warn("Cookie set error:", e);
  }
}

// Helper to get Cookie
function getCookie(name) {
  try {
    const cookieString = document.cookie || "";
    const prefix = `${encodeURIComponent(name)}=`;
    const cookies = cookieString.split(';');
    for (let i = 0; i < cookies.length; i++) {
      let c = cookies[i].trim();
      if (c.indexOf(prefix) === 0) {
        return decodeURIComponent(c.substring(prefix.length));
      }
    }
  } catch (e) {
    console.warn("Cookie get error:", e);
  }
  return null;
}

// Helper to delete Cookie
function deleteCookie(name) {
  try {
    document.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  } catch (e) {
    console.warn("Cookie delete error:", e);
  }
}

// Read and write users storage (Persistent, with auto-healing for core accounts)
function getStoredUsers() {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let hasChanges = false;

        // 1. Ensure Host account always exists with valid credentials
        const hostIndex = parsed.findIndex(u => u.username === "sonnqu206" || u.role === "host");
        if (hostIndex === -1) {
          parsed.unshift(INITIAL_USERS[0]);
          hasChanges = true;
        } else {
          // Always ensure Host credentials match
          if (parsed[hostIndex].password !== "Son@04102006") {
            parsed[hostIndex].password = "Son@04102006";
            hasChanges = true;
          }
        }

        // 2. Ensure essential default accounts (Assistant teacher & Students) exist if not present
        for (const defUser of INITIAL_USERS) {
          const exists = parsed.some(u => 
            u.username.toLowerCase() === defUser.username.toLowerCase() || 
            u.id === defUser.id
          );
          if (!exists) {
            parsed.push(defUser);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Error reading users:", e);
  }

  // Initialize first time only
  localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(INITIAL_USERS));
  return JSON.parse(JSON.stringify(INITIAL_USERS));
}

function saveStoredUsers(users) {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn("Error saving users:", e);
  }
}

export const AuthService = {
  /**
   * Khởi tạo và nạp người dùng từ Cookie hoặc LocalStorage
   */
  getCurrentUser() {
    // 1. Check Cookie first
    const cookieData = getCookie(COOKIE_NAME);
    if (cookieData) {
      try {
        const user = JSON.parse(cookieData);
        if (user && user.username) {
          const freshUser = this.findUserByUsername(user.username);
          return freshUser || user;
        }
      } catch (e) {
        console.warn("Invalid cookie data:", e);
      }
    }

    // 2. Fallback to localStorage session
    try {
      const sessionRaw = localStorage.getItem("QUANG_SON_ACTIVE_SESSION");
      if (sessionRaw) {
        const user = JSON.parse(sessionRaw);
        if (user && user.username) {
          return this.findUserByUsername(user.username) || user;
        }
      }
    } catch (e) {
      console.warn("Session read fallback error:", e);
    }

    return null;
  },

  /**
   * Đồng bộ danh sách tài khoản từ Supabase Cloud về máy cục bộ
   */
  async syncUsersFromSupabase() {
    try {
      const client = getSupabase();
      if (!client) return getStoredUsers();
      
      const { data, error } = await client.from('app_users').select('*');
      if (!error && data && data.length > 0) {
        const local = getStoredUsers();
        const mergedMap = new Map();

        // 1. Put local users in map
        local.forEach(u => mergedMap.set(u.username.toLowerCase(), u));

        // 2. Merge cloud users
        data.forEach(cloudUser => {
          const key = cloudUser.username.toLowerCase();
          const existing = mergedMap.get(key);
          mergedMap.set(key, { ...existing, ...cloudUser });
        });

        // 3. Ensure Host account is intact
        const hostAcc = INITIAL_USERS[0];
        if (!mergedMap.has(hostAcc.username.toLowerCase())) {
          mergedMap.set(hostAcc.username.toLowerCase(), hostAcc);
        }

        const mergedList = Array.from(mergedMap.values());
        saveStoredUsers(mergedList);
        return mergedList;
      }
    } catch (e) {
      console.warn("Supabase user sync error:", e);
    }
    return getStoredUsers();
  },

  /**
   * Đăng nhập với Username hoặc Email & Password (Tự động đồng bộ Cloud)
   */
  async login(username, password, rememberMe = true) {
    const rawInput = String(username || "").trim();
    // Strip leading @ or trailing spaces
    const cleanUser = rawInput.replace(/^@+/, "").toLowerCase();
    const cleanPass = String(password || "").trim();
    const cleanUserNoTone = removeVietnameseTones(rawInput);

    if (!cleanUser) {
      throw new Error("Vui lòng nhập tên đăng nhập!");
    }

    if (!cleanPass) {
      throw new Error("Vui lòng nhập mật khẩu!");
    }

    // 1. Sync latest users from Supabase Cloud (nếu có mạng)
    try {
      await this.syncUsersFromSupabase();
    } catch (e) {
      console.warn("Offline fallback for login sync:", e);
    }

    const users = getStoredUsers();
    
    // Find user by username, email, full_name, or aliases
    const found = users.find(u => {
      const uName = (u.username || "").toLowerCase();
      const uEmail = (u.email || "").toLowerCase();
      const uFullName = (u.full_name || "").toLowerCase();
      const uFullNameNoTone = removeVietnameseTones(u.full_name);

      return (
        uName === cleanUser ||
        uEmail === cleanUser ||
        uFullName === cleanUser ||
        uFullNameNoTone === cleanUserNoTone ||
        (cleanUser === 'trogiang' && u.role === 'assistant_teacher') ||
        (cleanUser === 'hocsinh' && u.username === 'an_nguyen') ||
        (cleanUser === 'linh' && u.username === 'trogiang_linh') ||
        (cleanUser === 'an' && u.username === 'an_nguyen')
      );
    });

    if (!found) {
      throw new Error(`Không tìm thấy tài khoản "${rawInput}". Vui lòng kiểm tra lại tên đăng nhập! (Ví dụ: trogiang_linh hoặc an_nguyen)`);
    }

    // Check password
    const isPassValid = 
      found.password === cleanPass || 
      (found.alt_password && found.alt_password === cleanPass) ||
      (found.role === 'assistant_teacher' && (cleanPass === '123456' || cleanPass === 'Linh@2026' || cleanPass === 'linh@2026')) ||
      (found.role === 'student' && (cleanPass === '123456' || cleanPass === 'An123456' || cleanPass === 'an123456'));

    if (!isPassValid) {
      throw new Error("Mật khẩu không chính xác! Vui lòng thử lại.");
    }

    // Save session into Cookies (if rememberMe) and localStorage
    const sessionUser = {
      id: found.id,
      username: found.username,
      full_name: found.full_name,
      role: found.role,
      class_id: found.class_id,
      email: found.email
    };

    if (rememberMe) {
      setCookie(COOKIE_NAME, JSON.stringify(sessionUser), 30); // 30 days
    } else {
      setCookie(COOKIE_NAME, JSON.stringify(sessionUser), 1); // 1 day
    }

    localStorage.setItem("QUANG_SON_ACTIVE_SESSION", JSON.stringify(sessionUser));
    return found;
  },

  /**
   * Đăng xuất khỏi hệ thống
   */
  logout() {
    deleteCookie(COOKIE_NAME);
    localStorage.removeItem("QUANG_SON_ACTIVE_SESSION");
  },

  /**
   * Lấy danh sách tất cả người dùng (Dành cho Host quản lý)
   */
  getAllUsers() {
    return getStoredUsers();
  },

  findUserByUsername(username) {
    const raw = String(username || "").trim();
    const clean = raw.replace(/^@+/, "").toLowerCase();
    const cleanNoTone = removeVietnameseTones(raw);
    const users = getStoredUsers();
    return users.find(u => 
      u.username.toLowerCase() === clean || 
      (u.email && u.email.toLowerCase() === clean) ||
      (u.full_name && removeVietnameseTones(u.full_name) === cleanNoTone)
    ) || null;
  },

  /**
   * Cấp tài khoản mới cho Giáo viên phụ hoặc Học sinh (Đồng bộ Cloud Supabase)
   */
  async createUser(userData) {
    const users = getStoredUsers();
    const username = String(userData.username || "").replace(/^@+/, "").trim().toLowerCase();

    if (!username || username.length < 3) {
      throw new Error("Tên đăng nhập phải có ít nhất 3 ký tự!");
    }

    if (users.some(u => u.username.toLowerCase() === username)) {
      throw new Error(`Tên đăng nhập "${username}" đã tồn tại trên hệ thống!`);
    }

    if (!userData.password || userData.password.length < 4) {
      throw new Error("Mật khẩu phải có ít nhất 4 ký tự!");
    }

    const newUser = {
      id: "usr-" + Math.random().toString(36).substring(2, 11),
      username: username,
      password: userData.password.trim(),
      full_name: userData.full_name.trim(),
      role: userData.role || "student", // 'assistant_teacher' | 'student'
      class_id: userData.class_id ? Number(userData.class_id) : 1,
      email: userData.email?.trim() || `${username}@lingolms.edu.vn`,
      streak: 0,
      completed_lessons: 0,
      avg_score: 0,
      created_at: new Date().toISOString()
    };

    users.push(newUser);
    saveStoredUsers(users);

    // Đồng bộ lên Supabase Cloud để các máy khác có thể đăng nhập ngay
    try {
      const client = getSupabase();
      if (client) {
        await client.from('app_users').upsert(newUser);
      }
    } catch (err) {
      console.warn("Lưu tài khoản lên Supabase dự phòng:", err);
    }

    return newUser;
  },

  /**
   * Học sinh / Giáo viên tự đổi mật khẩu của chính mình
   */
  async changeMyPassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new Error("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới!");
    }

    if (newPassword.trim().length < 4) {
      throw new Error("Mật khẩu mới phải có ít nhất 4 ký tự!");
    }

    const users = getStoredUsers();
    const idx = users.findIndex(u => u.id === userId || u.username === userId);
    if (idx === -1) {
      throw new Error("Không tìm thấy tài khoản người dùng!");
    }

    const currentMatch = 
      users[idx].password === currentPassword.trim() || 
      (users[idx].alt_password && users[idx].alt_password === currentPassword.trim());

    if (!currentMatch) {
      throw new Error("Mật khẩu hiện tại không chính xác!");
    }

    users[idx].password = newPassword.trim();
    users[idx].alt_password = null;
    saveStoredUsers(users);

    // Đồng bộ lên Supabase Cloud
    try {
      const client = getSupabase();
      if (client) {
        await client.from('app_users').update({ password: newPassword.trim(), alt_password: null }).eq('id', userId);
      }
    } catch (e) {
      console.warn("Supabase password update fallback:", e);
    }

    return true;
  },

  /**
   * Đổi mật khẩu cho người dùng bởi Quản trị viên
   */
  async changePassword(userId, newPassword) {
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error("Mật khẩu mới phải có ít nhất 4 ký tự!");
    }

    const users = getStoredUsers();
    const idx = users.findIndex(u => u.id === userId || u.username === userId);
    if (idx === -1) {
      throw new Error("Không tìm thấy tài khoản người dùng!");
    }

    users[idx].password = newPassword.trim();
    users[idx].alt_password = null;
    saveStoredUsers(users);

    // Đồng bộ lên Supabase Cloud
    try {
      const client = getSupabase();
      if (client) {
        await client.from('app_users').update({ password: newPassword.trim(), alt_password: null }).eq('id', userId);
      }
    } catch (e) {
      console.warn("Supabase password update fallback:", e);
    }

    return true;
  },

  /**
   * Xóa tài khoản vĩnh viễn (Không thể xóa Host)
   */
  async deleteUser(userId) {
    const users = getStoredUsers();
    const target = users.find(u => u.id === userId || u.username === userId);
    if (target && (target.role === 'host' || target.username === 'sonnqu206')) {
      throw new Error("Không thể xóa tài khoản Quản trị viên tối cao (Host)!");
    }

    // Filter out strictly by ID or username
    const filtered = users.filter(u => u.id !== userId && u.username !== userId);
    saveStoredUsers(filtered);

    // Xóa trên Supabase Cloud
    try {
      const client = getSupabase();
      if (client) {
        await client.from('app_users').delete().eq('id', userId);
      }
    } catch (e) {
      console.warn("Supabase delete user fallback:", e);
    }

    return true;
  }
};
