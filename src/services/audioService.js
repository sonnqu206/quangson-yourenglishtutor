/**
 * Quang Son - Your English Tutor
 * Audio Pronunciation Service (Web Speech API)
 */

import { CONFIG } from '../config.js';

class AudioService {
  constructor() {
    this.synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    this.voices = [];
    if (this.synth) {
      this.loadVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  /**
   * Phát âm từ vựng hoặc câu tiếng Anh
   */
  speak(text, options = {}) {
    if (!this.synth) {
      console.warn("Trình duyệt không hỗ trợ Web Speech API.");
      return;
    }

    // Cancel ongoing speech
    this.synth.cancel();

    const cleanText = text.replace(/\/[^/]+\//g, '').trim(); // Remove IPA slashes if passed
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = options.lang || CONFIG.AUDIO.LANG;
    utterance.rate = options.rate || CONFIG.AUDIO.DEFAULT_RATE;
    utterance.pitch = options.pitch || CONFIG.AUDIO.DEFAULT_PITCH;

    // Pick best English voice (US / UK native voice)
    if (this.voices.length === 0) {
      this.loadVoices();
    }
    const englishVoice = this.voices.find(v => (v.lang === 'en-US' || v.lang === 'en-GB') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel')));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    if (options.onStart) utterance.onstart = options.onStart;
    if (options.onEnd) utterance.onend = options.onEnd;
    if (options.onError) utterance.onerror = options.onError;

    this.synth.speak(utterance);
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const audioService = new AudioService();
