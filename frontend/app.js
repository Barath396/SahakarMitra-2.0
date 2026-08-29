// SahakarMitra Frontend Logic
document.addEventListener('DOMContentLoaded', () => {
  const chatWindow = document.getElementById('chat-window');
  const chatForm = document.getElementById('chat-form');
  const questionInput = document.getElementById('question-input');
  const sendBtn = document.getElementById('send-btn');
  const micBtn = document.getElementById('mic-btn');
  const voiceLangSelect = document.getElementById('voice-lang-select');
  const typingIndicator = document.getElementById('typing-indicator');
  const promptChips = document.querySelectorAll('.prompt-chip');

  // MediaRecorder state
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  // Determine API base path: default to relative /ask or port 8000/3000
  const API_BASE = '';

  // Scroll chat window to bottom
  function scrollToBottom() {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  // Show / hide typing indicator
  function showTyping(show = true, message = 'Consulting TNSC Act sections...') {
    if (show) {
      typingIndicator.querySelector('.typing-text').textContent = message;
      typingIndicator.classList.remove('hidden');
    } else {
      typingIndicator.classList.add('hidden');
    }
    scrollToBottom();
  }

  // Append user message
  function appendUserMessage(text) {
    const row = document.createElement('div');
    row.className = 'message-row user-row';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble user-bubble';
    bubble.textContent = text;

    row.appendChild(bubble);
    chatWindow.appendChild(row);
    scrollToBottom();
  }

  // Append AI response
  function appendAiMessage({ answer, cited_section, translated_answer, question_text, error = false }) {
    const row = document.createElement('div');
    row.className = 'message-row ai-row';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4Z"/>
        <path d="M18 10a6 6 0 0 1-12 0"/>
        <path d="M12 16v6"/>
        <path d="M8 22h8"/>
      </svg>
    `;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ai-bubble ${error ? 'error-bubble' : ''}`;

    if (error) {
      bubble.innerHTML = `<p><strong>Service Notice:</strong> ${escapeHtml(answer)}</p>`;
    } else {
      // Main answer
      let html = `<p>${escapeHtml(answer)}</p>`;

      // If translated answer available and different from english answer
      if (translated_answer && translated_answer.trim() !== answer.trim()) {
        html += `
          <div class="translation-box">
            <span class="translation-label">Tamil Translation (தமிழ் மொழியாக்கம்):</span>
            <p>${escapeHtml(translated_answer)}</p>
          </div>
        `;
      }

      // Tag section
      html += `<div class="tag-row">`;
      if (cited_section) {
        html += `<span class="citation-tag cited">✓ Cited: ${escapeHtml(cited_section)}</span>`;
      } else {
        html += `<span class="citation-tag not-covered">Not covered in TNSC Act</span>`;
      }
      html += `</div>`;

      bubble.innerHTML = html;
    }

    row.appendChild(avatar);
    row.appendChild(bubble);
    chatWindow.appendChild(row);
    scrollToBottom();
  }

  // Basic HTML escaping helper
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br/>');
  }

  // Handle question submission
  async function handleSendQuestion(queryText) {
    const question = (queryText || questionInput.value).trim();
    if (!question) return;

    // Reset input
    questionInput.value = '';
    appendUserMessage(question);
    showTyping(true, 'Consulting TNSC Act sections...');

    // Try endpoints in order: /api/ask, /ask, or direct
    const endpoints = [`${API_BASE}/api/ask`, `${API_BASE}/ask`, 'http://localhost:8000/ask'];

    let succeeded = false;
    let lastErrorMsg = '';

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ question }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || `Server returned ${response.status}`);
        }

        const data = await response.json();
        showTyping(false);
        appendAiMessage({
          answer: data.answer,
          cited_section: data.cited_section,
          retrieved_sections: data.retrieved_sections,
        });
        succeeded = true;
        break;
      } catch (err) {
        lastErrorMsg = err.message;
      }
    }

    if (!succeeded) {
      showTyping(false);
      appendAiMessage({
        answer: `Couldn't reach the server, please try again. (${lastErrorMsg || 'Connection error'})`,
        cited_section: null,
        error: true,
      });
    }
  }

  // Handle audio record and submit to /voice
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        // Stop audio tracks
        stream.getTracks().forEach((track) => track.stop());
        await submitVoiceAudio(audioBlob);
      };

      mediaRecorder.start();
      isRecording = true;
      micBtn.classList.add('recording');
      micBtn.setAttribute('title', 'Click to stop recording');
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access was denied or not supported in this browser. You can still type your questions!');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      isRecording = false;
      micBtn.classList.remove('recording');
      micBtn.setAttribute('title', 'Record browser voice question');
    }
  }

  async function submitVoiceAudio(blob) {
    appendUserMessage('🎙️ [Voice Question Recorded]');
    showTyping(true, 'Transcribing audio & analyzing TNSC Act...');

    const targetLang = voiceLangSelect.value || 'ta';
    const formData = new FormData();
    formData.append('file', blob, 'recording.wav');

    const voiceEndpoints = [
      `${API_BASE}/api/voice?lang=${targetLang}`,
      `${API_BASE}/voice?lang=${targetLang}`,
      `http://localhost:8000/voice?lang=${targetLang}`,
    ];

    let succeeded = false;
    let lastErrorMsg = '';

    for (const url of voiceEndpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || `Server returned ${response.status}`);
        }

        const data = await response.json();
        showTyping(false);
        appendAiMessage({
          answer: data.answer,
          cited_section: data.cited_section,
          translated_answer: data.translated_answer,
          question_text: data.question_text,
        });
        succeeded = true;
        break;
      } catch (err) {
        lastErrorMsg = err.message;
      }
    }

    if (!succeeded) {
      showTyping(false);
      appendAiMessage({
        answer: `Couldn't process voice audio from server. (${lastErrorMsg || 'Connection error'})`,
        cited_section: null,
        error: true,
      });
    }
  }

  // Event Listeners
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendQuestion();
  });

  micBtn.addEventListener('click', () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });

  // Prompt chip click handlers
  promptChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const query = chip.getAttribute('data-query');
      if (query) {
        handleSendQuestion(query);
      }
    });
  });
});
