/**
 * Quang Son - Your English Tutor
 * Application Configuration & Environment Credentials
 */

// Load values from environment or use configured values from .env.local
export const CONFIG = {
  BRAND: {
    NAME: "Quang Son - Your English Tutor",
    SHORT_NAME: "Quang Son",
    TAGLINE: "Your English Tutor",
    SUBTITLE: "Nền tảng Quản lý Học tập & Luyện thi Tiếng Anh Chuyên sâu",
    FOOTER_COPYRIGHT: "© 2026 Quang Son - Your English Tutor. All rights reserved.",
    YEAR: 2026,
    TEACHER_NAME: "Thầy Quang Sơn",
    TEACHER_TITLE: "Chuyên gia Luyện thi Tiếng Anh",
  },
  SUPABASE: {
    URL: (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL) || "https://ahiwhbegduujcoljjexy.supabase.co",
    ANON_KEY: (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) || "sb_publishable_RyOThI_fL4q5XO3qX8Pegg_INF7HwDD",
  },
  GEMINI: {
    API_KEY: (typeof process !== "undefined" && (process.env?.GEMINI_API_KEY || process.env?.NEXT_PUBLIC_GEMINI_API_KEY)) || (typeof localStorage !== "undefined" && localStorage.getItem("GEMINI_API_KEY")) || "",
    MODEL: "gemini-1.5-flash",
  },
  AUDIO: {
    DEFAULT_RATE: 0.9,
    DEFAULT_PITCH: 1.0,
    LANG: "en-US",
  }
};
