/**
 * Quang Son - Your English Tutor
 * Gemini AI Service (@google/generative-ai integration)
 */

import { CONFIG } from '../config.js';

export const GeminiService = {
  /**
   * Helper to call Gemini API via REST endpoint or SDK
   */
  async generateContent(prompt, systemInstruction = "") {
    const apiKey = CONFIG.GEMINI.API_KEY;
    if (!apiKey || apiKey.length < 5) {
      throw new Error("Chưa cấu hình GEMINI_API_KEY trong .env.local");
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        console.warn("Gemini API HTTP Error:", response.status, errorDetails);
        throw new Error(`Gemini API returned status ${response.status}: ${errorDetails}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Không nhận được phản hồi văn bản từ Gemini API");
      }
      return text;
    } catch (err) {
      console.error("Gemini API Call Failed:", err);
      throw err;
    }
  },

  /**
   * Tự động tra cứu và bổ sung thông tin từ vựng tiếng Anh (IPA, Nghĩa tiếng Việt, Ví dụ, Ngữ pháp)
   */
  async enrichVocabulary(word, customContext = "") {
    const cleanWord = word.trim();
    const systemPrompt = `Bạn là một gia sư Tiếng Anh nhiệt tình, chuyên giảng giải ngữ pháp và từ vựng một cách chi tiết, dễ hiểu, có ví dụ minh họa sinh động. Luôn dùng tiếng Việt chuẩn sư phạm để giải thích.
Nhiệm vụ: Phân tích từ hoặc cụm từ/cấu trúc ngữ pháp tiếng Anh và trả về ĐÚNG 1 ĐỐI TƯỢNG JSON thuần túy (không kèm markdown hay chữ thừa).

Cấu trúc JSON:
{
  "word": "từ hoặc cụm từ gốc",
  "ipa": "phiên âm quốc tế IPA chuẩn Anh-Mỹ hoặc Anh-Anh, kẹp giữa dấu //",
  "meaning": "định nghĩa tiếng Việt súc tích, chuẩn học thuật ôn thi vào 10",
  "example": "1 câu ví dụ tiếng Anh tự nhiên chứa từ này",
  "example_vi": "bản dịch tiếng Việt của câu ví dụ",
  "part_of_speech": "Loại từ (n, v, adj, adv, phr v, grammar)",
  "is_grammar": boolean (true nếu là cấu trúc ngữ pháp/mẫu câu có dấu +, false nếu là từ vựng đơn)
}`;

    const userPrompt = `Hãy phân tích chi tiết cho từ/cụm từ tiếng Anh sau: "${cleanWord}"${customContext ? ` (Nghĩa gợi ý: ${customContext})` : ''}. Chỉ trả về JSON duy nhất.`;

    try {
      const responseText = await this.generateContent(userPrompt, systemPrompt);
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsed = JSON.parse(cleanJson);
      return {
        word: parsed.word || cleanWord,
        ipa: parsed.ipa || "",
        meaning: parsed.meaning || customContext || "",
        example: parsed.example || "",
        example_vi: parsed.example_vi || "",
        part_of_speech: parsed.part_of_speech || "Từ vựng",
        is_grammar: Boolean(parsed.is_grammar || cleanWord.includes('+') || cleanWord.toLowerCase().startsWith('used to'))
      };
    } catch (e) {
      console.warn("AI enrich parsing fallback for:", cleanWord, e);
      return {
        word: cleanWord,
        ipa: cleanWord.includes(" ") ? "/—/" : `/${cleanWord.toLowerCase()}/`,
        meaning: customContext || "Từ vựng ôn thi vào 10",
        example: `Students should practice using '${cleanWord}' in their daily English exercises.`,
        example_vi: `Học sinh nên luyện tập sử dụng từ '${cleanWord}' trong các bài tập tiếng Anh hàng ngày.`,
        part_of_speech: "Từ vựng",
        is_grammar: cleanWord.includes("+") || cleanWord.toLowerCase().startsWith("used to")
      };
    }
  },

  /**
   * Tự động tạo IPA và Ví dụ cho toàn bộ danh sách trong Bảng Nhập Liệu
   */
  async enrichTableVocabularyBatch(rowsList, onProgress = null) {
    if (!rowsList || rowsList.length === 0) return [];
    
    const validRows = rowsList.filter(r => r.word && r.word.trim() !== "");
    const systemPrompt = `Bạn là một gia sư Tiếng Anh nhiệt tình, chuyên giảng giải ngữ pháp và từ vựng một cách chi tiết, dễ hiểu, có ví dụ minh họa sinh động. Luôn dùng tiếng Việt chuẩn sư phạm để giải thích.
Nhiệm vụ: Điền phiên âm IPA chuẩn quốc tế và 1 câu ví dụ tiếng Anh tự nhiên cho danh sách từ vựng/nghĩa được cung cấp.
Trả về DUY NHẤT 1 mảng JSON các object theo đúng thứ tự (không kèm markdown):
[
  {
    "word": "từ gốc",
    "meaning": "nghĩa tiếng Việt đã cung cấp hoặc dịch chuẩn",
    "ipa": "/phiên_âm_IPA/",
    "example": "Câu ví dụ tiếng Anh chuẩn ngữ pháp có chứa từ này",
    "is_grammar": boolean
  }
]`;

    const userPrompt = `Danh sách từ vựng:\n${JSON.stringify(validRows.map(r => ({ word: r.word.trim(), meaning: r.meaning.trim() })))}`;

    try {
      if (onProgress) onProgress("Đang phân tích và tạo phiên âm IPA cùng câu ví dụ qua Gemini AI...");
      const responseText = await this.generateContent(userPrompt, systemPrompt);
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length === validRows.length) {
        return parsed.map((item, idx) => ({
          word: validRows[idx].word.trim(),
          meaning: validRows[idx].meaning.trim() || item.meaning,
          ipa: item.ipa || `/${validRows[idx].word.toLowerCase()}/`,
          example: item.example || `Example sentence for ${validRows[idx].word}.`,
          is_grammar: Boolean(item.is_grammar || validRows[idx].word.includes('+') || validRows[idx].word.toLowerCase().startsWith('used to'))
        }));
      }
    } catch (err) {
      console.warn("Fast batch enrich fallback to sequential:", err);
    }

    // Fallback sequential
    const enrichedResults = [];
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      if (onProgress) onProgress(`Đang xử lý từ ${i + 1}/${validRows.length}: ${r.word}`);
      const res = await this.enrichVocabulary(r.word, r.meaning);
      enrichedResults.push({
        word: r.word.trim(),
        meaning: r.meaning.trim() || res.meaning,
        ipa: res.ipa,
        example: res.example,
        is_grammar: res.is_grammar
      });
    }
    return enrichedResults;
  },

  /**
   * Sinh bài kiểm tra đa dạng và NGẪU NHIÊN 100% về cả thứ tự từ vựng lẫn dạng bài
   * Các dạng bài hỗ trợ:
   * 1. 'multiple_choice_meaning': Trắc nghiệm - Cho từ tiếng Anh, chọn nghĩa tiếng Việt đúng (A, B, C, D)
   * 2. 'multiple_choice_word': Trắc nghiệm - Cho nghĩa tiếng Việt, chọn từ tiếng Anh đúng (A, B, C, D)
   * 3. 'type_en': Tự luận - Nhập từ tiếng Anh theo nghĩa tiếng Việt
   * 4. 'type_vi': Tự luận - Nhập nghĩa tiếng Việt theo từ tiếng Anh
   * Cấu trúc ngữ pháp (is_grammar: true) xuất hiện linh hoạt dưới các dạng Trắc nghiệm chuẩn cấu trúc.
   */
  async generateMultiFormatQuiz(vocabList, numQuestions = 10) {
    if (!vocabList || vocabList.length === 0) return [];
    
    // 1. Trộn ngẫu nhiên danh sách từ vựng theo thuật toán Fisher-Yates
    const shuffledVocab = [...vocabList];
    for (let i = shuffledVocab.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledVocab[i], shuffledVocab[j]] = [shuffledVocab[j], shuffledVocab[i]];
    }

    const selectedSubset = shuffledVocab.slice(0, Math.min(vocabList.length, numQuestions));
    const availableFormats = ['multiple_choice_meaning', 'multiple_choice_word', 'type_en', 'type_vi'];

    return selectedSubset.map((item, idx) => {
      const isGrammar = Boolean(item.is_grammar || item.word.includes('+') || item.word.toLowerCase().startsWith('used to'));
      
      // Bốc ngẫu nhiên dạng bài cho từng câu hỏi
      let questionType;
      if (isGrammar) {
        questionType = Math.random() < 0.5 ? 'multiple_choice_meaning' : 'multiple_choice_word';
      } else {
        // Trộn ngẫu nhiên hoàn toàn 1 trong 4 dạng bài
        questionType = availableFormats[Math.floor(Math.random() * availableFormats.length)];
      }

      let questionTitle = "";
      let allOptions = [];
      let correctOptionIdx = -1;
      let correctAnswer = "";

      if (questionType === 'multiple_choice_meaning') {
        questionTitle = isGrammar 
          ? `Cấu trúc ngữ pháp "${item.word}" có ý nghĩa và cách dùng nào sau đây?`
          : `Từ vựng "${item.word}" ${item.ipa ? `(${item.ipa})` : ''} có nghĩa tiếng Việt chính xác là gì?`;

        const otherMeanings = vocabList
          .filter(v => v.id !== item.id && v.meaning !== item.meaning)
          .map(v => v.meaning);
        
        // Trộn và lấy 3 đáp án nhiễu
        for (let i = otherMeanings.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [otherMeanings[i], otherMeanings[j]] = [otherMeanings[j], otherMeanings[i]];
        }
        const distractors = otherMeanings.slice(0, 3);
        
        allOptions = [item.meaning, ...distractors];
        // Trộn 4 đáp án A, B, C, D
        for (let i = allOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
        }
        correctOptionIdx = allOptions.indexOf(item.meaning);
        correctAnswer = item.meaning;

      } else if (questionType === 'multiple_choice_word') {
        questionTitle = `Từ tiếng Anh nào sau đây mang ý nghĩa: "${item.meaning}"?`;

        const otherWords = vocabList
          .filter(v => v.id !== item.id && v.word !== item.word)
          .map(v => v.word);
        
        for (let i = otherWords.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [otherWords[i], otherWords[j]] = [otherWords[j], otherWords[i]];
        }
        const distractors = otherWords.slice(0, 3);

        allOptions = [item.word, ...distractors];
        for (let i = allOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
        }
        correctOptionIdx = allOptions.indexOf(item.word);
        correctAnswer = item.word;

      } else if (questionType === 'type_en') {
        questionTitle = `Hãy viết từ tiếng Anh có nghĩa là: "${item.meaning}"`;
        correctAnswer = item.word;

      } else if (questionType === 'type_vi') {
        questionTitle = `Hãy nhập nghĩa tiếng Việt của từ: "${item.word}" ${item.ipa ? `(${item.ipa})` : ''}`;
        correctAnswer = item.meaning;
      }

      return {
        id: idx + 1,
        word_id: item.id,
        word: item.word,
        meaning: item.meaning,
        ipa: item.ipa || "",
        is_grammar: isGrammar,
        type: questionType,
        question: questionTitle,
        options: allOptions,
        correct_index: correctOptionIdx,
        correct_answer: correctAnswer,
        explanation: `"${item.word}" ${item.ipa ? `(${item.ipa})` : ''}: ${item.meaning}.`
      };
    });
  },

  /**
   * Gia sư AI Quang Son (Gemini API Integration với System Prompt chuẩn sư phạm)
   */
  async askTutor(userQuestion, chatHistory = []) {
    const systemPrompt = `Bạn là một gia sư Tiếng Anh nhiệt tình, chuyên giảng giải ngữ pháp và từ vựng một cách chi tiết, dễ hiểu, có ví dụ minh họa sinh động. Luôn dùng tiếng Việt chuẩn sư phạm để giải thích.`;

    const formattedHistory = chatHistory.slice(-6).map(m => 
      `${m.sender === 'user' ? 'Học sinh' : 'Thầy Quang Sơn (Gia sư AI)'}: ${m.text}`
    ).join('\n\n');

    const prompt = `${formattedHistory ? `Lịch sử trao đổi trước đó:\n${formattedHistory}\n\n` : ''}Câu hỏi hiện tại của học sinh: "${userQuestion}"

Hãy giải thích chi tiết, ân cần, chỉ rõ bản chất ngữ pháp/từ vựng, đưa ra các câu ví dụ minh họa sinh động kèm bản dịch tiếng Việt và dặn dò mẹo tránh bẫy trong đề thi vào lớp 10.`;

    return await this.generateContent(prompt, systemPrompt);
  }
};
