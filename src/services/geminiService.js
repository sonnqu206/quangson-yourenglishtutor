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
   * Sinh bài kiểm tra đa dạng với 3 format ngẫu nhiên (Điền Anh, Điền Việt, Trắc nghiệm)
   * ÁP DỤNG QUY TẮC BẮT BUỘC: Cấu trúc ngữ pháp (is_grammar: true) CHỈ xuất hiện dạng Trắc nghiệm!
   */
  async generateMultiFormatQuiz(vocabList, numQuestions = 10) {
    if (!vocabList || vocabList.length === 0) return [];
    
    // Pick random subset
    const shuffledVocab = [...vocabList].sort(() => 0.5 - Math.random());
    const selectedSubset = shuffledVocab.slice(0, Math.min(vocabList.length, numQuestions));

    const formats = ['type_en', 'type_vi', 'multiple_choice'];

    return selectedSubset.map((item, idx) => {
      const isGrammar = Boolean(item.is_grammar || item.word.includes('+') || item.word.toLowerCase().startsWith('used to'));
      
      // Mandatory rule: Grammar patterns MUST strictly be multiple_choice!
      let questionType = isGrammar ? 'multiple_choice' : formats[idx % formats.length];

      // Prepare 4 options for multiple choice or fallback
      const wrongOptions = vocabList
        .filter(v => v.id !== item.id)
        .map(v => v.meaning)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      
      const allOptions = [item.meaning, ...wrongOptions].sort(() => 0.5 - Math.random());
      const correctOptionIdx = allOptions.indexOf(item.meaning);

      let questionTitle = "";
      if (questionType === 'type_en') {
        questionTitle = `Hãy nhập từ tiếng Anh có nghĩa là: "${item.meaning}"`;
      } else if (questionType === 'type_vi') {
        questionTitle = `Hãy nhập nghĩa tiếng Việt của từ: "${item.word}" ${item.ipa ? `(${item.ipa})` : ''}`;
      } else {
        questionTitle = isGrammar 
          ? `Cấu trúc ngữ pháp "${item.word}" có ý nghĩa và cách dùng nào sau đây?`
          : `Nghĩa chính xác của từ vựng "${item.word}" ${item.ipa ? `(${item.ipa})` : ''} là gì?`;
      }

      return {
        id: idx + 1,
        word_id: item.id,
        word: item.word,
        meaning: item.meaning,
        ipa: item.ipa || "",
        example: item.example || "",
        is_grammar: isGrammar,
        type: questionType, // 'type_en' | 'type_vi' | 'multiple_choice'
        question: questionTitle,
        options: allOptions,
        correct_index: correctOptionIdx,
        correct_answer: questionType === 'type_en' ? item.word : (questionType === 'type_vi' ? item.meaning : allOptions[correctOptionIdx]),
        explanation: `"${item.word}" ${item.ipa ? `(${item.ipa})` : ''}: ${item.meaning}.${item.example ? ` Ví dụ: "${item.example}"` : ''}`
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
