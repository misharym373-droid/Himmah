// طبقة "الإدخال الذكي" — نقطة دخول واحدة لتحويل النص إلى مهام.
// حاليًا: تحليل محلي بالكامل (nlp.js) — لا يوجد AI خارجي.
// للربط مع AI حقيقي لاحقًا: أضف محركًا بنفس الشكل { name, analyze(text) => Promise<Task[]> }
// ومرّره إلى setEngine() — الواجهة (الإدخال السريع، المايك، المساعد) لا تحتاج أي تعديل.
import { parseTasks } from './nlp.js';

const localEngine = {
  name: 'local',
  label: 'تحليل محلي',
  analyze: async (text) => parseTasks(text),
};

let engine = localEngine;
export const setEngine = (e) => (engine = e || localEngine);
export const engineInfo = () => ({ name: engine.name, label: engine.label });

// متزامن للمعاينة الفورية أثناء الكتابة (محلي دائمًا)
export const previewTasks = (text) => parseTasks(text);

// التحليل الرسمي قبل الحفظ — يرجع للمحلي إذا فشل المحرك الخارجي
export async function analyzeInput(text) {
  try {
    const tasks = await engine.analyze(text);
    if (Array.isArray(tasks)) return tasks;
  } catch (e) {
    // نرجع للتحليل المحلي
    console.warn('[himmah:analyze]', e?.message || e);
  }
  return parseTasks(text);
}
