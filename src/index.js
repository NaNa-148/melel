const url = 'https://api.openai.com/v1/audio/transcriptions';

// בונה prompt אוטומטי לפי ההקשר שהמשתמש נתן
function buildPromptFromContext(contextStr) {
  if (!contextStr || !contextStr.trim()) return '';
  const ctx = contextStr.trim();

  return `
טקסט תורני/שיעור בעברית. אנא העדף כתיב תקין של שמות ומונחים תורניים.
ההקשר: ${ctx}.
מונחים נפוצים לשימור כתיב נכון: ליקוטי מוהר"ן; רבי נחמן מברסלב; רבי שמעון בר יוחאי; ספר הזוהר; פנימיות התורה; חיצוניות התורה; האר"י; הבעל שם טוב; בעל התניא; השגחה פרטית; "לית אתר פנוי מיניה"; ספירות; מלכות; חסידות; קבלה; תורה א; תורה ב; כרם ביבנה; גאולה; ברחמים.
אם יש ספקי שמות – השאר בעברית תקנית וציין כפי שנשמע.
`.trim();
}

// שליחת בקשה ל-API
const transcribe = async (apiKey, file, language, response_format, contextStr) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', 'whisper-1');

  // קיבוע עברית כברירת מחדל אם לא נבחרה שפה
  const lang = language && language.length ? language : 'he';
  formData.append('language', lang);

  // טמפרטורה נמוכה = תוצאה יותר שמרנית
  formData.append('temperature', '0');

  // Prompt מההקשר
  const prompt = buildPromptFromContext(contextStr);
  if (prompt) formData.append('prompt', prompt);

  // פורמט פלט
  const fmt = response_format || 'verbose_json';
  formData.append('response_format', fmt);

  const headers = new Headers();
  headers.append('Authorization', `Bearer ${apiKey}`);

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    headers
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`שגיאת API ${res.status}:\n${txt}`);
  }

  if (fmt === 'json' || fmt === 'verbose_json') {
    return res.json();
  } else {
    return res.text();
  }
};

// עוזרים לסטטוס/פלט
let outputElement;

const setStatus = (msg) => {
  const div = document.getElementById('status');
  if (div) div.textContent = msg;
};

const setTranscribedPlainText = (text) => {
  text = text.replaceAll('&', '&amp;')
             .replaceAll('<', '&lt;')
             .replaceAll('>', '&gt;');
  outputElement.innerHTML = `<pre>${text}</pre>`;
};

const setTranscribedSegments = (segments) => {
  outputElement.innerHTML = '';
  for (const segment of segments) {
    const element = document.createElement('div');
    element.classList.add('segment');
    element.innerText = segment.text;
    outputElement.appendChild(element);
  }
};

// API key handling
const hideStartView = () => {
  document.querySelector('#start-view').classList.add('hidden');
};

const showStartView = () => {
  document.querySelector('#start-view').classList.remove('hidden');
};

const setupAPIKeyInput = () => {
  const element = document.querySelector('#api-key');
  const savedAPIKey = localStorage.getItem('api-key') || '';
  element.value = savedAPIKey;
  element.addEventListener('input', () => {
    const key = element.value;
    localStorage.setItem('api-key', key);
    if (key) {
      hideStartView();
    } else {
      showStartView();
    }
  });

  if (savedAPIKey) {
    hideStartView();
  }
};

// Event listeners
window.addEventListener('load', () => {
  setupAPIKeyInput();
  outputElement = document.querySelector('#output');

  const fileInput = document.querySelector('#audio-file');
  fileInput.addEventListener('change', async () => {
    setStatus('⏳ מתמלל... (העלאה + עיבוד)');

    const apiKey = localStorage.getItem('api-key');
    const file = fileInput.files[0];
    const language = document.querySelector('#language').value;
    const response_format = document.querySelector('#response_format').value;
    const contextStr = (document.querySelector('#context')?.value || '').trim();

    try {
      const transcription = await transcribe(apiKey, file, language, response_format, contextStr);

      if (response_format === 'verbose_json') {
        if (transcription.segments && transcription.segments.length) {
          setTranscribedSegments(transcription.segments);
        } else if (transcription.text) {
          setTranscribedPlainText(transcription.text);
        } else {
          setTranscribedPlainText(JSON.stringify(transcription, null, 2));
        }
      } else {
        setTranscribedPlainText(transcription);
      }

      setStatus('✅ הסתיים');
    } catch (err) {
      console.error(err);
      setStatus('❌ שגיאה');
      setTranscribedPlainText(err.message || String(err));
    } finally {
      fileInput.value = null; // מאפשר העלאה נוספת בלי ריענון
    }
  });
});
