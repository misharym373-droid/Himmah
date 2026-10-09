// استخراج النص من الصور (OCR) — يتم تحميل Tesseract.js عند الحاجة فقط (Lazy Loading)
import { tr } from '../i18n/index.js';

let loading;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.async = true;
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => {
      loading = null;
      reject(new Error(tr('تعذر تحميل محرك قراءة الصور. تأكد من اتصالك بالإنترنت.')));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export async function extractText(file, onProgress) {
  const T = await loadTesseract();
  const { data } = await T.recognize(file, 'ara+eng', {
    logger: (m) => m.status === 'recognizing text' && onProgress?.(Math.round(m.progress * 100)),
  });
  // نرجع الأسطر مع أحجامها ودرجة الثقة لتصفية النص الصغير والإشعارات
  return { text: data.text || '', lines: data.lines || [] };
}
