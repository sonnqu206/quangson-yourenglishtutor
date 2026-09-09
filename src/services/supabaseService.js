/**
 * Quang Son - Your English Tutor
 * Supabase Database Service (Class-Isolated Multi-Tenant Architecture)
 */

import { CONFIG } from '../config.js';
import { SEEE_DATA } from '../data/seeeData.js';

let supabaseClient = null;

// Initial rich seed data with strict class_id assignments
const SEED_DATA = {
  classes: [
    { id: 1, name: "Lớp 9A - Luyện thi Chuyên & Vào 10", class_code: "QS9A2026", created_at: "2026-08-01T08:00:00Z" },
    { id: 2, name: "Lớp 9B - Ôn thi Vào 10 Trọng điểm", class_code: "QS9B2026", created_at: "2026-08-05T09:00:00Z" },
    { id: 3, name: "Lớp 10A1 - Luyện đề & Bứt phá Điểm số", class_code: "QS10A2026", created_at: "2026-08-10T10:00:00Z" }
  ],
  profiles: [
    { id: "00000000-0000-0000-0000-000000000001", role: "teacher", full_name: "Thầy Quang Sơn", class_id: 1, email: "quangson.tutor@lingolms.edu.vn", updated_at: "2026-08-01T08:00:00Z" },
    { id: "00000000-0000-0000-0000-000000000002", role: "student", full_name: "Nguyễn Văn An", class_id: 1, email: "an.nguyen@student.edu.vn", streak: 12, completed_lessons: 8, avg_score: 92, updated_at: "2026-08-20T08:00:00Z" },
    { id: "00000000-0000-0000-0000-000000000003", role: "student", full_name: "Trần Thị Mai", class_id: 1, email: "mai.tran@student.edu.vn", streak: 9, completed_lessons: 7, avg_score: 88, updated_at: "2026-08-22T08:00:00Z" },
    { id: "00000000-0000-0000-0000-000000000004", role: "student", full_name: "Lê Hoàng Nam", class_id: 1, email: "nam.le@student.edu.vn", streak: 15, completed_lessons: 9, avg_score: 95, updated_at: "2026-08-25T08:00:00Z" },
    { id: "00000000-0000-0000-0000-000000000005", role: "student", full_name: "Phạm Thảo Vy", class_id: 2, email: "vy.pham@student.edu.vn", streak: 6, completed_lessons: 5, avg_score: 84, updated_at: "2026-08-26T08:00:00Z" }
  ],
  lessons: [
    // Lớp 9A Lessons
    { id: 1, class_id: 1, title: "Unit 1: Local Environment & Traditional Crafts", created_at: "2026-08-10T08:00:00Z" },
    { id: 2, class_id: 1, title: "Unit 2: City Life & Modern Infrastructure", created_at: "2026-08-15T08:00:00Z" },
    { id: 3, class_id: 1, title: "Unit 3: Teen Stress & Cognitive Development", created_at: "2026-08-20T08:00:00Z" },
    // Lớp 9B Lessons
    { id: 4, class_id: 2, title: "Unit 4: Life in the Past & Cultural Heritage", created_at: "2026-08-25T08:00:00Z" },
    { id: 5, class_id: 2, title: "Unit 5: Wonders of Viet Nam & Eco-Tourism", created_at: "2026-08-28T08:00:00Z" },
    // Lớp 10A1 Lessons
    { id: 6, class_id: 3, title: "Unit 6: Global Warming & Environmental Actions", created_at: "2026-08-29T08:00:00Z" }
  ],
  vocabulary: [
    // --- LỚP 9A VOCABULARY (class_id: 1) ---
    {
      id: 1,
      class_id: 1,
      lesson_id: 1,
      word: "ubiquitous",
      meaning: "phổ biến, xuất hiện ở khắp mọi nơi",
      ipa: "/juːˈbɪk.wə.təs/",
      example: "Smartphones have become ubiquitous in modern teenage life.",
      is_grammar: false,
      created_at: "2026-08-10T08:30:00Z"
    },
    {
      id: 2,
      class_id: 1,
      lesson_id: 1,
      word: "authenticity",
      meaning: "tính xác thực, tính chân thật",
      ipa: "/ˌɔː.θenˈtɪs.ə.ti/",
      example: "The museum verified the authenticity of the ancient ceramic vase.",
      is_grammar: false,
      created_at: "2026-08-10T08:35:00Z"
    },
    {
      id: 3,
      class_id: 1,
      lesson_id: 1,
      word: "craftsman",
      meaning: "thợ thủ công, nghệ nhân lành nghề",
      ipa: "/ˈkrɑːfts.mən/",
      example: "The village craftsman spent weeks carving the intricate wooden sculpture.",
      is_grammar: false,
      created_at: "2026-08-10T08:40:00Z"
    },
    {
      id: 4,
      class_id: 1,
      lesson_id: 1,
      word: "preservation",
      meaning: "sự bảo tồn, sự gìn giữ di sản",
      ipa: "/ˌprez.əˈveɪ.ʃən/",
      example: "The preservation of historical monuments requires collective community effort.",
      is_grammar: false,
      created_at: "2026-08-10T08:45:00Z"
    },
    {
      id: 5,
      class_id: 1,
      lesson_id: 2,
      word: "metropolitan",
      meaning: "thuộc về đô thị lớn, thủ đô hiện đại",
      ipa: "/ˌmet.rəˈpɒl.ɪ.tən/",
      example: "Hanoi is a vibrant metropolitan area with rapid economic growth.",
      is_grammar: false,
      created_at: "2026-08-15T08:30:00Z"
    },
    {
      id: 6,
      class_id: 1,
      lesson_id: 2,
      word: "infrastructure",
      meaning: "cơ sở hạ tầng (đường xá, cầu cống, điện nước)",
      ipa: "/ˈɪn.frəˌstrʌk.tʃər/",
      example: "The city council is investing heavily in upgrading public transport infrastructure.",
      is_grammar: false,
      created_at: "2026-08-15T08:35:00Z"
    },
    {
      id: 7,
      class_id: 1,
      lesson_id: 3,
      word: "perseverance",
      meaning: "tính kiên trì, sự bền chí vượt khó",
      ipa: "/ˌpɜː.sɪˈvɪə.rəns/",
      example: "Her perseverance helped her pass the entrance examination with flying colors.",
      is_grammar: false,
      created_at: "2026-08-20T08:30:00Z"
    },
    {
      id: 8,
      class_id: 1,
      lesson_id: 3,
      word: "counselor",
      meaning: "người tư vấn, chuyên gia tâm lý học đường",
      ipa: "/ˈkaʊn.səl.ər/",
      example: "Students are encouraged to consult the school counselor whenever they feel stressed.",
      is_grammar: false,
      created_at: "2026-08-20T08:35:00Z"
    },
    {
      id: 9,
      class_id: 1,
      lesson_id: 1,
      word: "Used to + V (bare)",
      meaning: "Đã từng làm gì trong quá khứ nay không còn nữa",
      ipa: "/juːst tuː/",
      example: "My grandfather used to ride a bicycle to work every morning.",
      is_grammar: true,
      created_at: "2026-08-10T08:50:00Z"
    },

    // --- LỚP 9B VOCABULARY (class_id: 2) ---
    {
      id: 10,
      class_id: 2,
      lesson_id: 4,
      word: "nostalgia",
      meaning: "nỗi nhớ nhung quá khứ, hoài niệm",
      ipa: "/nɒsˈtæl.dʒə/",
      example: "Looking at old family photographs always brings a wave of gentle nostalgia.",
      is_grammar: false,
      created_at: "2026-08-25T08:35:00Z"
    },
    {
      id: 11,
      class_id: 2,
      lesson_id: 4,
      word: "illuminate",
      meaning: "chiếu sáng, soi sáng, làm sáng tỏ",
      ipa: "/ɪˈluː.mɪ.neɪt/",
      example: "Historical documents illuminate how people lived centuries ago.",
      is_grammar: false,
      created_at: "2026-08-25T08:30:00Z"
    },
    {
      id: 12,
      class_id: 2,
      lesson_id: 5,
      word: "breathtaking",
      meaning: "đẹp đến nghẹt thở, ngoạn mục",
      ipa: "/ˈbreθˌteɪ.kɪŋ/",
      example: "The breathtaking limestone karsts of Ha Long Bay attract millions of travelers.",
      is_grammar: false,
      created_at: "2026-08-28T08:30:00Z"
    },
    {
      id: 13,
      class_id: 2,
      lesson_id: 5,
      word: "picturesque",
      meaning: "đẹp như tranh vẽ, thanh bình",
      ipa: "/ˌpɪk.tʃərˈesk/",
      example: "The picturesque valley in Sapa is covered with golden terraced rice fields.",
      is_grammar: false,
      created_at: "2026-08-28T08:35:00Z"
    },

    // --- LỚP 10A1 VOCABULARY (class_id: 3) ---
    {
      id: 14,
      class_id: 3,
      lesson_id: 6,
      word: "catastrophic",
      meaning: "thảm khốc, tai hại nghiêm trọng",
      ipa: "/ˌkæt.əˈstrɒf.ɪk/",
      example: "Deforestation can have catastrophic effects on global biodiversity.",
      is_grammar: false,
      created_at: "2026-08-29T08:30:00Z"
    },
    {
      id: 15,
      class_id: 3,
      lesson_id: 6,
      word: "sustainable",
      meaning: "bền vững, thân thiện với môi trường lâu dài",
      ipa: "/səˈsteɪ.nə.bəl/",
      example: "Using renewable energy is essential for sustainable economic development.",
      is_grammar: false,
      created_at: "2026-08-29T08:35:00Z"
    }
  ],
  test_sessions: [
    {
      id: 1,
      user_id: "00000000-0000-0000-0000-000000000002",
      class_id: 1,
      session_type: "lesson_based",
      test_scope: { lesson_id: 1 },
      total_questions: 10,
      correct_count: 9,
      wrong_count: 1,
      skipped_count: 0,
      score_percentage: 90,
      duration_seconds: 245,
      created_at: "2026-08-28T14:30:00Z",
      details: [
        { question: "Nghĩa của từ 'ubiquitous' là gì?", user_answer: "Phổ biến, có mặt ở khắp nơi", correct_answer: "Phổ biến, có mặt ở khắp nơi", is_correct: true, explanation: "Ubiquitous: có mặt ở khắp mọi nơi." },
        { question: "Điền từ tiếng Anh: 'Sự kiên trì, bền bỉ'", user_answer: "perseverance", correct_answer: "perseverance", is_correct: true, explanation: "Perseverance: sự kiên trì vượt khó." },
        { question: "Chọn cấu trúc đúng: 'Used to + ...'", user_answer: "V (nguyên thể)", correct_answer: "V (nguyên thể)", is_correct: true, explanation: "Used to + V diễn tả thói quen trong quá khứ." }
      ]
    },
    {
      id: 2,
      user_id: "00000000-0000-0000-0000-000000000002",
      class_id: 1,
      session_type: "multi_format",
      test_scope: { is_random: true },
      total_questions: 10,
      correct_count: 10,
      wrong_count: 0,
      skipped_count: 0,
      score_percentage: 100,
      duration_seconds: 198,
      created_at: "2026-08-30T09:15:00Z",
      details: [
        { question: "Điền từ tiếng Anh: 'Bền vững, thân thiện môi trường'", user_answer: "sustainable", correct_answer: "sustainable", is_correct: true, explanation: "Sustainable: bền vững." },
        { question: "Nghĩa của 'meticulous'?", user_answer: "Tỉ mỉ, cẩn thận", correct_answer: "Tỉ mỉ, cẩn thận", is_correct: true, explanation: "Meticulous: cực kỳ tỉ mỉ." }
      ]
    },
    {
      id: 3,
      user_id: "00000000-0000-0000-0000-000000000003",
      class_id: 1,
      session_type: "multi_format",
      test_scope: { is_random: true },
      total_questions: 10,
      correct_count: 8,
      wrong_count: 2,
      skipped_count: 0,
      score_percentage: 80,
      duration_seconds: 310,
      created_at: "2026-08-29T16:20:00Z",
      details: [
        { question: "Nghĩa của từ 'ubiquitous'?", user_answer: "Hiếm gặp", correct_answer: "Phổ biến, có mặt ở khắp nơi", is_correct: false, explanation: "Ubiquitous nghĩa là có mặt khắp nơi." }
      ]
    }
  ],
  study_sessions: [
    {
      id: 1,
      user_id: "00000000-0000-0000-0000-000000000002",
      user_name: "Nguyễn Văn An",
      class_id: 1,
      lesson_id: 1,
      activity_type: "flashcard",
      duration_seconds: 360,
      cards_viewed: 18,
      cards_mastered: 15,
      score: null,
      created_at: "2026-08-28T09:30:00Z"
    },
    {
      id: 2,
      user_id: "00000000-0000-0000-0000-000000000003",
      user_name: "Trần Thị Mai",
      class_id: 1,
      lesson_id: 2,
      activity_type: "flashcard",
      duration_seconds: 420,
      cards_viewed: 22,
      cards_mastered: 19,
      score: null,
      created_at: "2026-08-29T10:15:00Z"
    }
  ]
};

const LOCAL_STORAGE_KEY = "QUANG_SON_LMS_ISOLATED_DATA_V3";

function ensureSEEEData(parsed) {
  if (!parsed.classes) parsed.classes = [];
  if (!parsed.lessons) parsed.lessons = [];
  if (!parsed.vocabulary) parsed.vocabulary = [];
  if (!parsed.study_sessions) parsed.study_sessions = [];

  // Check if HUST class exists
  let hustClass = parsed.classes.find(c => c.id === 11 || (c.class_code && c.class_code.toUpperCase() === 'HUST20261'));
  if (!hustClass) {
    hustClass = {
      id: 11,
      name: "HUST20261-SƠN",
      class_code: "HUST20261",
      category: "HUST",
      is_hub: true,
      created_at: "2026-09-09T13:32:23.454Z"
    };
    parsed.classes.push(hustClass);
  } else {
    hustClass.category = "HUST";
    hustClass.is_hub = true;
  }

  // Check if SEEE lessons exist
  const unitTitles = Object.keys(SEEE_DATA);
  const lessonMap = {
    "Unit 1: Electrons": 15,
    "Unit 2: Electric Current": 16,
    "Unit 3: Cells & Batteries": 17,
    "Unit 4: Sources of Power": 18,
    "Unit 5: Mains Electricity, Plugs & Fuses": 19,
    "Unit 6: Electricity & Magnetism": 20,
    "Unit 7: Resistors": 21,
    "Unit 8: Capacitors": 22,
    "Unit 9: Inductors": 23,
    "Unit 10: Semiconductor & Diodes": 24
  };

  unitTitles.forEach(title => {
    const lId = lessonMap[title];
    if (!parsed.lessons.some(l => l.id === lId)) {
      parsed.lessons.push({
        id: lId,
        class_id: 11,
        title: title,
        created_at: "2026-09-09T13:33:00.000Z"
      });
    }
  });

  // Check vocabulary
  const existingWords = new Set(parsed.vocabulary.filter(v => v.class_id === 11).map(v => v.word.toLowerCase()));
  let vocabIdBase = 1000;
  unitTitles.forEach(title => {
    const lId = lessonMap[title];
    const terms = SEEE_DATA[title] || [];
    terms.forEach(t => {
      if (!existingWords.has(t.term.toLowerCase())) {
        existingWords.add(t.term.toLowerCase());
        parsed.vocabulary.push({
          id: vocabIdBase + (t.id || 0),
          class_id: 11,
          lesson_id: lId,
          word: t.term,
          meaning: t.meaning,
          meaning_vi_long: t.vi || "",
          vi: t.vi || "",
          ipa: t.phonetics || "",
          example: t.en || "",
          definition: t.en || "",
          en: t.en || "",
          is_grammar: false,
          created_at: "2026-09-09T13:33:00.000Z"
        });
      }
    });
  });

  return parsed;
}

let inMemoryFallback = null;

function getLocalData() {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        ensureSEEEData(parsed);
        return parsed;
      }
    } catch (e) {
      console.warn("Could not read local data:", e);
    }
  } else if (inMemoryFallback) {
    return inMemoryFallback;
  }
  const fresh = JSON.parse(JSON.stringify(SEED_DATA));
  ensureSEEEData(fresh);
  saveLocalData(fresh);
  return fresh;
}

function saveLocalData(data) {
  inMemoryFallback = data;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Could not write local data:", e);
    }
  }
}

export function getSupabase() {
  if (!supabaseClient) {
    const url = CONFIG.SUPABASE.URL;
    const key = CONFIG.SUPABASE.ANON_KEY;
    if (typeof window !== "undefined" && window.supabase?.createClient) {
      supabaseClient = window.supabase.createClient(url, key);
    }
  }
  return supabaseClient;
}

export const SupabaseService = {
  /**
   * Lấy danh sách lớp học
   */
  async getClasses() {
    let supabaseData = [];
    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('classes').select('*').order('id', { ascending: true });
        if (!error && data) supabaseData = data;
      } catch (err) {
        console.warn("Supabase classes query fallback:", err);
      }
    }
    const local = getLocalData();
    const supabaseIds = new Set(supabaseData.map(c => c.id));
    const supabaseCodes = new Set(supabaseData.map(c => (c.class_code || '').toUpperCase()));

    // Merge metadata like creator_id or parent_id or category from local into supabaseData
    supabaseData = supabaseData.map(sc => {
      const matchedLocal = local.classes.find(lc => lc.id === sc.id || lc.class_code === sc.class_code);
      return matchedLocal ? { ...matchedLocal, ...sc } : sc;
    });

    const mergedLocal = local.classes.filter(c => !supabaseIds.has(c.id) && !supabaseCodes.has((c.class_code || '').toUpperCase()));
    return [...supabaseData, ...mergedLocal].sort((a,b) => a.id - b.id);
  },

  /**
   * Tìm lớp học theo Mã Lớp (Class Code)
   */
  async findClassByCode(classCode) {
    const code = classCode.trim().toUpperCase();
    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('classes').select('*').ilike('class_code', code).maybeSingle();
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase findClassByCode fallback:", err);
      }
    }
    const local = getLocalData();
    return local.classes.find(c => c.class_code.toUpperCase() === code) || null;
  },

  /**
   * Thêm lớp học mới (Hỗ trợ creator_id, parent_id, category và tạo lớp không giới hạn)
   */
  async createClass(name, customCode = null, creatorId = null, extraMeta = {}) {
    const code = customCode ? customCode.trim().toUpperCase() : "QS" + Math.random().toString(36).substring(2, 7).toUpperCase();
    const supabasePayload = {
      name: name.trim(),
      class_code: code,
      created_at: new Date().toISOString()
    };

    let created = null;
    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('classes').insert([supabasePayload]).select();
        if (!error && data && data[0]) {
          created = data[0];
        } else if (error) {
          console.warn("Supabase createClass error:", error);
        }
      } catch (err) {
        console.warn("Supabase createClass fallback:", err);
      }
    }

    const local = getLocalData();
    if (created) {
      const fullItem = { ...created, creator_id: creatorId || null, ...extraMeta };
      const existingIdx = local.classes.findIndex(c => c.id === fullItem.id || c.class_code.toUpperCase() === fullItem.class_code.toUpperCase());
      if (existingIdx !== -1) {
        local.classes[existingIdx] = { ...local.classes[existingIdx], ...fullItem };
      } else {
        local.classes.push(fullItem);
      }
      saveLocalData(local);
      return fullItem;
    }

    const newId = local.classes.length ? Math.max(...local.classes.map(c => c.id)) + 1 : 1;
    const item = { id: newId, ...supabasePayload, creator_id: creatorId || null, ...extraMeta };
    local.classes.push(item);
    saveLocalData(local);
    return item;
  },

  /**
   * Xóa lớp học
   */
  async deleteClass(id) {
    const client = getSupabase();
    if (client) {
      try {
        await client.from('classes').delete().eq('id', id);
      } catch (e) {
        console.warn(e);
      }
    }
    const local = getLocalData();
    local.classes = local.classes.filter(c => c.id !== Number(id));
    local.lessons = local.lessons.filter(l => l.class_id !== Number(id));
    local.vocabulary = local.vocabulary.filter(v => v.class_id !== Number(id));
    saveLocalData(local);
    return true;
  },

  /**
   * Lấy danh sách bài học (Đã lọc chính xác theo class_id)
   */
  async getLessons(classId = null) {
    let supabaseData = [];
    const client = getSupabase();
    if (client) {
      try {
        let query = client.from('lessons').select('*').order('id', { ascending: true });
        if (classId) {
          query = query.eq('class_id', Number(classId));
        }
        const { data, error } = await query;
        if (!error && data) supabaseData = data;
      } catch (err) {
        console.warn("Supabase lessons query fallback:", err);
      }
    }

    const local = getLocalData();
    let localLessons = local.lessons;
    if (classId) {
      localLessons = localLessons.filter(l => l.class_id === Number(classId));
    }
    const supabaseIds = new Set(supabaseData.map(l => l.id));
    const mergedLocal = localLessons.filter(l => !supabaseIds.has(l.id));
    return [...supabaseData, ...mergedLocal].sort((a,b) => a.id - b.id);
  },

  /**
   * Thêm bài học mới gắn liền với class_id
   */
  async createLesson(classId, title) {
    const newLesson = {
      class_id: Number(classId),
      title: title.trim(),
      created_at: new Date().toISOString()
    };

    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('lessons').insert([newLesson]).select();
        if (!error && data && data[0]) {
          const local = getLocalData();
          if (!local.lessons) local.lessons = [];
          if (!local.lessons.some(l => l.id === data[0].id)) {
            local.lessons.push(data[0]);
            saveLocalData(local);
          }
          return data[0];
        }
        if (error) {
          console.warn("Supabase createLesson error:", error);
        }
      } catch (err) {
        console.warn("Supabase createLesson fallback:", err);
      }
    }

    const local = getLocalData();
    if (!local.lessons) local.lessons = [];
    const newId = local.lessons.length ? Math.max(...local.lessons.map(l => l.id)) + 1 : 1;
    const item = { id: newId, ...newLesson };
    local.lessons.push(item);
    saveLocalData(local);
    return item;
  },

  /**
   * Xóa bài học
   */
  async deleteLesson(id) {
    const client = getSupabase();
    if (client) {
      try {
        await client.from('lessons').delete().eq('id', id);
      } catch (e) {
        console.warn(e);
      }
    }
    const local = getLocalData();
    local.lessons = local.lessons.filter(l => l.id !== Number(id));
    local.vocabulary = local.vocabulary.filter(v => v.lesson_id !== Number(id));
    saveLocalData(local);
    return true;
  },

  /**
   * Lấy danh sách từ vựng (Đã cách ly chặt chẽ theo class_id và/hoặc lesson_id)
   */
  async getVocabulary(filters = {}) {
    const { classId, lessonId, searchQuery, isGrammar } = filters;
    let supabaseData = [];
    const client = getSupabase();
    if (client) {
      try {
        let query = client.from('vocabulary').select('*').order('id', { ascending: false });
        if (classId) {
          query = query.eq('class_id', Number(classId));
        }
        if (lessonId) {
          query = query.eq('lesson_id', Number(lessonId));
        }
        if (typeof isGrammar === "boolean") {
          query = query.eq('is_grammar', isGrammar);
        }
        if (searchQuery) {
          query = query.or(`word.ilike.%${searchQuery}%,meaning.ilike.%${searchQuery}%`);
        }
        const { data, error } = await query;
        if (!error && data) supabaseData = data;
      } catch (err) {
        console.warn("Supabase vocabulary query fallback:", err);
      }
    }

    const local = getLocalData();
    let result = [...local.vocabulary];
    if (classId) {
      result = result.filter(v => v.class_id === Number(classId));
    }
    if (lessonId) {
      result = result.filter(v => v.lesson_id === Number(lessonId));
    }
    if (typeof isGrammar === "boolean") {
      result = result.filter(v => Boolean(v.is_grammar) === isGrammar);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(v => 
        (v.word && v.word.toLowerCase().includes(q)) || 
        (v.meaning && v.meaning.toLowerCase().includes(q)) ||
        (v.example && v.example.toLowerCase().includes(q))
      );
    }
    
    const supabaseIds = new Set(supabaseData.map(v => v.id));
    const mergedLocal = result.filter(v => !supabaseIds.has(v.id));
    return [...supabaseData, ...mergedLocal].map(v => ({
      ...v,
      definition: v.definition || v.example || "",
      en: v.en || v.definition || v.example || ""
    })).sort((a,b) => b.id - a.id);
  },

  /**
   * Đảm bảo lớp học luôn có ít nhất 1 bài học (Unit) để chứa từ vựng
   */
  async ensureClassLesson(classId) {
    const targetClassId = Number(classId) || 1;
    const client = getSupabase();
    if (client) {
      try {
        const { data: sbLessons } = await client.from('lessons').select('*').eq('class_id', targetClassId).order('id', { ascending: true });
        if (sbLessons && sbLessons.length > 0) {
          const local = getLocalData();
          if (!local.lessons) local.lessons = [];
          sbLessons.forEach(sl => {
            if (!local.lessons.some(l => l.id === sl.id)) local.lessons.push(sl);
          });
          saveLocalData(local);
          return sbLessons[0].id;
        }
      } catch (err) {
        console.warn("Supabase check lessons in ensureClassLesson:", err);
      }
    }
    const lessons = await this.getLessons(targetClassId);
    if (lessons && lessons.length > 0) {
      return lessons[0].id;
    }
    const allCls = await this.getClasses();
    const targetClass = allCls.find(c => c.id === targetClassId);
    const className = targetClass ? targetClass.name : `Lớp #${targetClassId}`;
    const newLesson = await this.createLesson(targetClassId, `Unit 1: Chuyên đề Từ vựng 1 - ${className}`);
    return newLesson.id;
  },

  /**
   * Thêm từ vựng mới (Tự động gắn class_id và lesson_id)
   */
  async addVocabulary(vocabData) {
    const class_id = Number(vocabData.class_id) || 1;
    let lesson_id = Number(vocabData.lesson_id);
    
    if (!lesson_id || isNaN(lesson_id)) {
      lesson_id = await this.ensureClassLesson(class_id);
    } else {
      const currentLessons = await this.getLessons(class_id);
      if (!currentLessons.some(l => l.id === lesson_id)) {
        lesson_id = await this.ensureClassLesson(class_id);
      }
    }

    const exampleVal = String(vocabData.example || vocabData.definition || "").trim();
    const item = {
      class_id: class_id,
      lesson_id: lesson_id,
      word: vocabData.word.trim(),
      meaning: vocabData.meaning.trim(),
      ipa: vocabData.ipa?.trim() || "",
      example: exampleVal,
      is_grammar: Boolean(vocabData.is_grammar),
      created_at: new Date().toISOString()
    };

    const client = getSupabase();
    if (client) {
      try {
        // Đảm bảo lesson_id tồn tại trên Supabase để không dính lỗi foreign key constraint
        const { data: checkL } = await client.from('lessons').select('id').eq('id', lesson_id).single();
        if (!checkL) {
          lesson_id = await this.ensureClassLesson(class_id);
          item.lesson_id = lesson_id;
        }
        const { data, error } = await client.from('vocabulary').insert([item]).select();
        if (!error && data && data[0]) {
          const local = getLocalData();
          const enhanced = { ...data[0], definition: exampleVal, en: exampleVal };
          if (!local.vocabulary.some(v => v.id === data[0].id)) {
            local.vocabulary.unshift(enhanced);
            saveLocalData(local);
          }
          return enhanced;
        }
        if (error) {
          console.warn("Supabase addVocabulary error:", error);
        }
      } catch (err) {
        console.warn("Supabase addVocabulary fallback:", err);
      }
    }

    const local = getLocalData();
    const newId = local.vocabulary.length ? Math.max(...local.vocabulary.map(v => v.id)) + 1 : 1;
    const saved = { id: newId, ...item, definition: exampleVal, en: exampleVal };
    local.vocabulary.unshift(saved);
    saveLocalData(local);
    return saved;
  },

  /**
   * Lưu hàng loạt từ vựng từ Bảng Nhập Liệu (Batch Insert with Class & Lesson Isolation)
   */
  async bulkInsertVocabulary(vocabList, classId = 1, lessonId = null) {
    const targetClassId = Number(classId) || 1;
    let targetLessonId = Number(lessonId);

    if (!targetLessonId || isNaN(targetLessonId)) {
      targetLessonId = await this.ensureClassLesson(targetClassId);
    } else {
      const currentLessons = await this.getLessons(targetClassId);
      if (!currentLessons.some(l => l.id === targetLessonId)) {
        targetLessonId = await this.ensureClassLesson(targetClassId);
      }
    }

    const client = getSupabase();
    if (client) {
      try {
        const { data: checkL } = await client.from('lessons').select('id').eq('id', targetLessonId).single();
        if (!checkL) {
          targetLessonId = await this.ensureClassLesson(targetClassId);
        }
      } catch (e) {
        console.warn("Verify lesson in bulkInsertVocabulary:", e);
      }
    }

    const records = vocabList.map(v => ({
      class_id: targetClassId,
      lesson_id: targetLessonId,
      word: String(v.word || "").trim(),
      meaning: String(v.meaning || "").trim(),
      ipa: String(v.ipa || "").trim(),
      example: String(v.example || v.definition || "").trim(),
      is_grammar: Boolean(v.is_grammar),
      created_at: new Date().toISOString()
    })).filter(v => v.word && v.meaning);

    if (records.length === 0) return [];

    if (client) {
      try {
        const { data, error } = await client.from('vocabulary').insert(records).select();
        if (!error && data && data.length > 0) {
          const local = getLocalData();
          const existingIds = new Set(local.vocabulary.map(v => v.id));
          const newItems = data.filter(d => !existingIds.has(d.id)).map(d => ({
            ...d,
            definition: d.example || "",
            en: d.example || ""
          }));
          local.vocabulary = [...newItems, ...local.vocabulary];
          saveLocalData(local);
          return data;
        }
        if (error) {
          console.warn("Supabase bulkInsert error:", error);
        }
      } catch (err) {
        console.warn("Supabase bulkInsert fallback:", err);
      }
    }

    const local = getLocalData();
    let currentId = local.vocabulary.length ? Math.max(...local.vocabulary.map(v => v.id)) : 0;
    const inserted = records.map(r => {
      currentId += 1;
      return { id: currentId, ...r, definition: r.example, en: r.example };
    });
    local.vocabulary = [...inserted, ...local.vocabulary];
    saveLocalData(local);
    return inserted;
  },

  /**
   * Cập nhật từ vựng
   */
  async updateVocabulary(id, vocabData) {
    const payload = {};
    if (vocabData.lesson_id) payload.lesson_id = Number(vocabData.lesson_id);
    if (vocabData.word !== undefined) payload.word = String(vocabData.word || "").trim();
    if (vocabData.meaning !== undefined) payload.meaning = String(vocabData.meaning || "").trim();
    if (vocabData.ipa !== undefined) payload.ipa = String(vocabData.ipa || "").trim();
    if (vocabData.example !== undefined || vocabData.definition !== undefined) {
      payload.example = String(vocabData.example || vocabData.definition || "").trim();
    }
    if (vocabData.is_grammar !== undefined) payload.is_grammar = Boolean(vocabData.is_grammar);

    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('vocabulary').update(payload).eq('id', id).select();
        if (!error && data && data[0]) {
          const local = getLocalData();
          const idx = local.vocabulary.findIndex(v => v.id === Number(id));
          if (idx !== -1) {
            local.vocabulary[idx] = { 
              ...local.vocabulary[idx], 
              ...payload, 
              definition: payload.example, 
              en: payload.example 
            };
            saveLocalData(local);
          }
          return { ...data[0], definition: payload.example, en: payload.example };
        }
      } catch (err) {
        console.warn("Supabase updateVocabulary fallback:", err);
      }
    }

    const local = getLocalData();
    const idx = local.vocabulary.findIndex(v => v.id === Number(id));
    if (idx !== -1) {
      local.vocabulary[idx] = { 
        ...local.vocabulary[idx], 
        ...payload, 
        definition: payload.example, 
        en: payload.example 
      };
      saveLocalData(local);
      return local.vocabulary[idx];
    }
    return { id: Number(id), ...payload, definition: payload.example || "", en: payload.example || "" };
  },

  /**
   * Xóa từ vựng
   */
  async deleteVocabulary(id) {
    const client = getSupabase();
    if (client) {
      try {
        await client.from('vocabulary').delete().eq('id', id);
      } catch (e) {
        console.warn(e);
      }
    }
    const local = getLocalData();
    local.vocabulary = local.vocabulary.filter(v => v.id !== Number(id));
    saveLocalData(local);
    return true;
  },

  /**
   * Lấy danh sách profiles
   */
  async getProfiles(classId = null) {
    let supabaseData = [];
    const client = getSupabase();
    if (client) {
      try {
        let query = client.from('profiles').select('*');
        if (classId) query = query.eq('class_id', classId);
        const { data, error } = await query;
        if (!error && data) supabaseData = data;
      } catch (err) {
        console.warn("Supabase profiles query fallback:", err);
      }
    }

    const local = getLocalData();
    let localProfiles = local.profiles || [];
    if (classId) {
      localProfiles = localProfiles.filter(p => p.class_id === Number(classId));
    }
    const supabaseIds = new Set(supabaseData.map(p => p.id));
    const mergedLocal = localProfiles.filter(p => !supabaseIds.has(p.id));
    return [...supabaseData, ...mergedLocal];
  },

  /**
   * Lưu kết quả làm bài kiểm tra (Tự động gắn đúng class_id, hỗ trợ cả UUID và Custom ID)
   */
  async saveTestSession(sessionData, detailsList = []) {
    const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validUserId = isUuid(sessionData.user_id) ? sessionData.user_id : null;

    const record = {
      user_id: validUserId,
      class_id: Number(sessionData.class_id) || 1,
      session_type: sessionData.session_type || 'lesson_based',
      test_scope: {
        ...(sessionData.test_scope || {}),
        student_id: sessionData.user_id || null,
        student_name: sessionData.student_name || sessionData.user_name || ''
      },
      total_questions: sessionData.total_questions || 0,
      correct_count: sessionData.correct_count || 0,
      wrong_count: sessionData.wrong_count || 0,
      skipped_count: sessionData.skipped_count || 0,
      score_percentage: sessionData.score_percentage || 0,
      duration_seconds: Number(sessionData.duration_seconds) || 0,
      created_at: new Date().toISOString()
    };

    const client = getSupabase();
    if (client) {
      try {
        const { data: sessionRes, error } = await client.from('test_sessions').insert([record]).select();
        if (!error && sessionRes && sessionRes[0]) {
          const sessionId = sessionRes[0].id;
          if (detailsList.length > 0) {
            try {
              const details = detailsList.map(d => ({
                session_id: sessionId,
                word_id: d.word_id,
                user_answer: d.user_answer,
                correct_answer: d.correct_answer,
                is_correct: d.is_correct,
                is_skipped: Boolean(d.is_skipped)
              }));
              await client.from('session_details').insert(details);
            } catch (e) {
              console.warn("Supabase session_details insert fallback:", e);
            }
          }
          const local = getLocalData();
          const localRecord = { ...sessionRes[0], user_id: sessionData.user_id };
          local.test_sessions.unshift(localRecord);
          saveLocalData(local);
          return localRecord;
        }
        if (error) {
          console.warn("Supabase saveTestSession error:", error);
        }
      } catch (err) {
        console.warn("Supabase saveTestSession fallback:", err);
      }
    }

    const local = getLocalData();
    const newId = local.test_sessions.length ? Math.max(...local.test_sessions.map(s => s.id)) + 1 : 1;
    const saved = { id: newId, ...record, user_id: sessionData.user_id };
    local.test_sessions.unshift(saved);
    
    if (detailsList.length > 0) {
      if (!local.session_details) local.session_details = [];
      const newDetailId = local.session_details.length ? Math.max(...local.session_details.map(d => d.id)) + 1 : 1;
      const detailsToSave = detailsList.map((d, index) => ({
        id: newDetailId + index,
        session_id: newId,
        word_id: d.word_id,
        user_answer: d.user_answer,
        correct_answer: d.correct_answer,
        is_correct: d.is_correct,
        is_skipped: Boolean(d.is_skipped)
      }));
      local.session_details.push(...detailsToSave);
    }
    
    saveLocalData(local);
    return saved;
  },

  /**
   * Lấy chi tiết câu trả lời của một bài kiểm tra
   */
  async getTestSessionDetails(sessionId) {
    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client
          .from('session_details')
          .select(`*, vocabulary(word, meaning)`)
          .eq('session_id', Number(sessionId));
        if (!error && data) return data;
      } catch (err) {
        console.warn("Supabase getTestSessionDetails fallback:", err);
      }
    }
    const local = getLocalData();
    if (!local.session_details) return [];
    
    return local.session_details
      .filter(d => d.session_id === Number(sessionId))
      .map(d => {
        const vocab = local.vocabulary.find(v => v.id === d.word_id);
        return {
          ...d,
          vocabulary: vocab ? { word: vocab.word, meaning: vocab.meaning } : null
        };
      });
  },

  /**
   * Lấy lịch sử làm bài kiểm tra theo lớp
   */
  async getTestSessions(classId = null) {
    let supabaseData = [];
    const client = getSupabase();
    if (client) {
      try {
        let query = client.from('test_sessions').select('*').order('id', { ascending: false });
        if (classId) query = query.eq('class_id', Number(classId));
        const { data, error } = await query;
        if (!error && data) supabaseData = data;
      } catch (err) {
        console.warn("Supabase test_sessions query fallback:", err);
      }
    }
    const local = getLocalData();
    let localSessions = local.test_sessions || [];
    if (classId) {
      localSessions = localSessions.filter(s => s.class_id === Number(classId));
    }
    const supabaseIds = new Set(supabaseData.map(s => s.id));
    const mergedLocal = localSessions.filter(s => !supabaseIds.has(s.id));
    return [...supabaseData, ...mergedLocal].sort((a,b) => b.id - a.id);
  },

  /**
   * Lưu phiên học tập (Flashcard, Quiz, v.v.) ghi nhận toàn bộ thời gian học sinh vào học
   */
  async saveStudySession(sessionData) {
    const record = {
      user_id: sessionData.user_id ? String(sessionData.user_id) : 'guest',
      user_name: sessionData.user_name || 'Học sinh',
      class_id: Number(sessionData.class_id) || 1,
      lesson_id: sessionData.lesson_id ? Number(sessionData.lesson_id) : null,
      activity_type: sessionData.activity_type || 'flashcard', // 'flashcard' | 'quiz' | 'vocabulary'
      duration_seconds: Math.max(0, Number(sessionData.duration_seconds) || 0),
      cards_viewed: Number(sessionData.cards_viewed) || 0,
      cards_mastered: Number(sessionData.cards_mastered) || 0,
      score: sessionData.score !== undefined && sessionData.score !== null ? Number(sessionData.score) : null,
      created_at: new Date().toISOString()
    };

    const client = getSupabase();
    if (client) {
      try {
        const { data, error } = await client.from('study_sessions').insert([record]).select();
        if (!error && data && data[0]) {
          return data[0];
        }
      } catch (err) {
        console.warn("Supabase saveStudySession fallback:", err);
      }
    }

    const local = getLocalData();
    if (!local.study_sessions) local.study_sessions = [];
    const newId = local.study_sessions.length ? Math.max(...local.study_sessions.map(s => s.id)) + 1 : 1;
    const saved = { id: newId, ...record };
    local.study_sessions.unshift(saved);
    saveLocalData(local);
    return saved;
  },

  /**
   * Lấy danh sách nhật ký học tập theo lớp
   */
  async getStudySessions(classId = null) {
    let supabaseData = [];
    const client = getSupabase();
    if (client) {
      try {
        let query = client.from('study_sessions').select('*').order('id', { ascending: false });
        if (classId) query = query.eq('class_id', Number(classId));
        const { data, error } = await query;
        if (!error && data) supabaseData = data;
      } catch (err) {
        console.warn("Supabase study_sessions query fallback:", err);
      }
    }

    const local = getLocalData();
    let list = local.study_sessions || [];
    if (classId) {
      list = list.filter(s => s.class_id === Number(classId));
    }
    const supabaseIds = new Set(supabaseData.map(s => s.id));
    const mergedLocal = list.filter(s => !supabaseIds.has(s.id));
    return [...supabaseData, ...mergedLocal].sort((a,b) => b.id - a.id);
  },

  /**
   * Đăng ký nhận sự kiện realtime từ Supabase và LocalStorage
   */
  subscribeToRealtimeData(callback) {
    const client = getSupabase();
    if (client) {
      try {
        client.channel('public:sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'study_sessions' }, payload => {
            callback('study_sessions', payload);
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'test_sessions' }, payload => {
            callback('test_sessions', payload);
          })
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription failed:', err);
      }
    }
    
    // Cross-tab sync if using LocalStorage fallback
    window.addEventListener('storage', (e) => {
      if (e.key === "QUANG_SON_LMS_ISOLATED_DATA_V3" && e.newValue) {
        try {
          const newData = JSON.parse(e.newValue);
          const oldData = e.oldValue ? JSON.parse(e.oldValue) : { study_sessions: [], test_sessions: [] };
          
          if (newData.study_sessions?.length !== oldData.study_sessions?.length) {
            callback('study_sessions_local', newData.study_sessions);
          }
          if (newData.test_sessions?.length !== oldData.test_sessions?.length) {
            callback('test_sessions_local', newData.test_sessions);
          }
        } catch (err) {
          console.warn("Storage sync parse error:", err);
        }
      }
    });
  },

  /**
   * Xoá nhật ký học tập
   */
  async deleteStudySession(id) {
    const client = getSupabase();
    if (client) {
      try {
        await client.from('study_sessions').delete().eq('id', id);
      } catch (err) {
        console.warn("Supabase deleteStudySession fallback:", err);
      }
    }
    const local = getLocalData();
    if (local.study_sessions) {
      local.study_sessions = local.study_sessions.filter(s => s.id !== id);
      saveLocalData(local);
    }
    return true;
  },

  /**
   * Xoá lịch sử bài kiểm tra
   */
  async deleteTestSession(id) {
    const client = getSupabase();
    if (client) {
      try {
        await client.from('test_sessions').delete().eq('id', id);
        await client.from('session_details').delete().eq('session_id', id);
      } catch (err) {
        console.warn("Supabase deleteTestSession fallback:", err);
      }
    }
    const local = getLocalData();
    if (local.test_sessions) {
      local.test_sessions = local.test_sessions.filter(s => s.id !== id);
    }
    if (local.session_details) {
      local.session_details = local.session_details.filter(d => d.session_id !== id);
    }
    saveLocalData(local);
    return true;
  }
};
