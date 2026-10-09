// مولّد خطط الأهداف: يحوّل الهدف + المدة + أيام الإجازة إلى خطة كاملة
// (مراحل متدرجة → أسابيع بتواريخها → جلسة مفصلة لكل يوم عمل طوال المدة)
// يعمل محليًا بالكامل: يتعرف على نوع الهدف ويبني جدولًا أسبوعيًا وتدرجًا في الشدة/الكمية.
import { todayKey, addDays, fromKey, diffDays } from './date.js';

const norm = (s) => String(s || '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();

// ————— قوالب الأنواع —————
// كل قالب: الجدول الأسبوعي (تركيزات تتناوب على أيام العمل)، المراحل، وتفاصيل كل جلسة حسب المرحلة والأسبوع
const KINDS = {
  fitness: {
    match: /نادي|جيم|gym|وزن|عضل|لياق|تخسيس|رشاق|حرق|تنشيف|كمال|رياض|جري|بطن|ضخام|fitness|muscle|weight|workout/,
    icon: 'dumbbell',
    area: 'health',
    duration: 70,
    label: 'خطة تمارين',
    focuses: [
      { key: 'push', title: 'صدر وكتف وتراي', ex: ['ضغط بار مستوي', 'ضغط دمبل مائل', 'ضغط كتف بالدمبل', 'رفرفة جانبية', 'ترايسبس بالحبل'] },
      { key: 'legs', title: 'أرجل ومؤخرة', ex: ['سكوات', 'رفعة رومانية', 'اندفاع (لانجز)', 'ضغط أرجل', 'سمانة واقف'] },
      { key: 'cardio', title: 'كارديو وبطن', cardio: true, ex: ['بلانك', 'كرنش', 'رفع أرجل معلّق', 'روسيان تويست'] },
      { key: 'pull', title: 'ظهر وباي', ex: ['سحب علوي', 'تجديف بالبار', 'تجديف دمبل بيد واحدة', 'بايسبس بار', 'هامر كيرل'] },
      { key: 'full', title: 'تمرين كامل للجسم', ex: ['ديدلفت', 'ضغط دمبل مستوي', 'سكوات جوبليت', 'سحب أرضي', 'ضغط كتف'] },
      { key: 'hiit', title: 'كارديو متقطع HIIT + بطن', cardio: true, hiit: true, ex: ['بلانك جانبي', 'ماونتن كلايمبر', 'كرنش دراجة'] },
    ],
    phases: [
      { title: 'التأسيس وتعلّم الحركات', desc: 'أوزان متوسطة وتركيز على الأداء الصحيح وبناء العادة', sets: 3, reps: '12', rest: '60–75 ث', cardio: 20 },
      { title: 'بناء العضل وحرق الدهون', desc: 'زيادة الحجم التدريبي ورفع الأوزان تدريجيًا كل أسبوع', sets: 4, reps: '10', rest: '60 ث', cardio: 25 },
      { title: 'القوة والتنشيف', desc: 'أوزان أثقل مع مجموعات مركّبة وكارديو متقطع', sets: 4, reps: '8', rest: '90 ث', cardio: 25 },
      { title: 'التثبيت والتحدي', desc: 'حافظ على الأوزان العالية وقِس نتائجك (وزن، محيط، صور)', sets: 4, reps: '6–8', rest: '90–120 ث', cardio: 30 },
    ],
    session(f, ph, week, inPhaseWeek) {
      const deload = inPhaseWeek === 4;
      if (f.cardio) {
        const mins = ph.cardio + Math.min(10, (inPhaseWeek - 1) * 2) - (deload ? 5 : 0);
        const head = f.hiit ? `HIIT: 30 ث سرعة عالية / 60 ث مشي × ${Math.round(mins / 1.5)} جولة` : `كارديو ${mins} دقيقة (مشي مائل أو دراجة) بنبض متوسط`;
        return `${head}\nبطن: ${f.ex.map((e) => `${e} ${ph.sets}×${e.includes('بلانك') ? '40 ث' : '15'}`).join(' · ')}${deload ? '\nأسبوع تخفيف: شدة أقل للتعافي' : ''}`;
      }
      const lines = f.ex.map((e) => `• ${e}: ${deload ? ph.sets - 1 : ph.sets}×${ph.reps}`);
      const prog = deload ? 'أسبوع تخفيف: نفس التمارين بوزن أخف 20% للتعافي' : inPhaseWeek > 1 ? `زِد 2.5 كجم أو تكرارًا واحدًا عن الأسبوع الماضي` : 'سجّل الأوزان التي تبدأ بها';
      return `${lines.join('\n')}\nالراحة بين المجموعات: ${ph.rest}\n${prog}\nختام: كارديو ${Math.round(ph.cardio / 2)} دقيقة`;
    },
    rest: 'راحة واستشفاء: مشي خفيف 20 دقيقة + إطالات + نوم كافٍ',
    tips: ['اشرب 8 أكواب ماء يوميًا', 'بروتين في كل وجبة', 'نم 7–8 ساعات'],
  },
  language: {
    match: /انجليز|إنجليز|english|لغه|لغة|انقلش|فرنس|اسبان|الماني|ياباني|كوري|صيني|محادث/,
    icon: 'globe',
    area: 'study',
    duration: 40,
    label: 'خطة لغة',
    focuses: [
      { key: 'vocab', title: 'مفردات' },
      { key: 'grammar', title: 'قواعد' },
      { key: 'listen', title: 'استماع' },
      { key: 'speak', title: 'محادثة' },
      { key: 'read', title: 'قراءة' },
      { key: 'write', title: 'كتابة' },
    ],
    phases: [
      { title: 'الأساسيات', desc: 'الحروف والنطق وأهم 500 كلمة والجمل البسيطة', words: 10, minutes: 15 },
      { title: 'بناء الحصيلة', desc: 'مفردات الحياة اليومية والأزمنة الأساسية', words: 15, minutes: 20 },
      { title: 'الطلاقة', desc: 'محادثات أطول ومحتوى حقيقي بدون ترجمة', words: 20, minutes: 25 },
      { title: 'الإتقان والاختبار', desc: 'نصوص متقدمة وتجربة اختبار مستوى', words: 20, minutes: 30 },
    ],
    session(f, ph, week) {
      const m = {
        vocab: `تعلّم ${ph.words} كلمة جديدة + راجع كلمات الأسبوع الماضي (تكرار متباعد)`,
        grammar: `قاعدة جديدة (${ph.minutes} د) + 10 جمل تطبيقية عليها`,
        listen: `استماع ${ph.minutes} دقيقة (بودكاست/مقطع) ودوّن 5 عبارات جديدة`,
        speak: `تحدّث ${Math.round(ph.minutes / 2)} دقيقة مع نفسك أو شريك عن موضوع يومك وسجّل صوتك`,
        read: `اقرأ نصًا قصيرًا (${ph.minutes} د) ولخّصه في 3 جمل`,
        write: `اكتب فقرة من ${60 + week * 5} كلمة عن يومك أو رأيك في موضوع`,
      };
      return m[f.key];
    },
    rest: 'يوم خفيف: راجع المفردات 10 دقائق فقط',
    tips: ['غيّر لغة جوالك', 'شاهد بترجمة اللغة نفسها'],
  },
  quran: {
    match: /قران|قرآن|حفظ|سوره|سورة|جزء|تلاوه|تلاوة|مراجعه الحفظ/,
    icon: 'pray',
    area: 'family',
    duration: 30,
    label: 'خطة حفظ',
    focuses: [
      { key: 'new', title: 'حفظ جديد' },
      { key: 'new2', title: 'حفظ جديد' },
      { key: 'review', title: 'مراجعة' },
    ],
    phases: [
      { title: 'البداية بثبات', desc: 'مقدار صغير يوميًا مع مراجعة قوية', amount: 'نصف وجه' },
      { title: 'زيادة المقدار', desc: 'رفع الحفظ اليومي مع ربط المحفوظ', amount: 'وجه' },
      { title: 'التثبيت', desc: 'تكثيف المراجعة وتسميع على شخص آخر', amount: 'وجه' },
      { title: 'الإتقان', desc: 'مراجعة كل المحفوظ وتسميع كامل', amount: 'وجه ونصف' },
    ],
    session(f, ph, week) {
      if (f.key === 'review') return `مراجعة محفوظ الأسبوع ${week} كاملًا + تسميع الأسبوع السابق`;
      return `حفظ ${ph.amount} جديد بعد الفجر + تكراره 10 مرات + ربطه بما قبله`;
    },
    rest: 'مراجعة خفيفة لما حُفظ هذا الأسبوع',
    tips: ['احفظ في وقت ثابت', 'سمّع على شخص آخر أسبوعيًا'],
  },
  reading: {
    match: /قراء|كتاب|كتب|روايه|رواية|read|book/,
    icon: 'read',
    area: 'study',
    duration: 30,
    label: 'خطة قراءة',
    focuses: [{ key: 'read', title: 'قراءة' }],
    phases: [
      { title: 'بناء العادة', desc: 'قراءة يومية قصيرة في وقت ثابت', pages: 10 },
      { title: 'رفع الكمية', desc: 'صفحات أكثر وتدوين الأفكار', pages: 20 },
      { title: 'التعمّق', desc: 'كتب أعمق مع تلخيص أسبوعي', pages: 25 },
      { title: 'التنويع والمراجعة', desc: 'مجالات جديدة ومراجعة ما قرأته', pages: 30 },
    ],
    session(f, ph, week, inPhaseWeek, dayInWeek) {
      if (dayInWeek === 0 && week > 1) return `اكتب ملخص أسبوع ${week - 1}: أهم 3 أفكار وكيف تطبقها\nثم اقرأ ${ph.pages} صفحة`;
      return `اقرأ ${ph.pages + (inPhaseWeek - 1) * 2} صفحة ودوّن فكرة واحدة استفدت منها`;
    },
    rest: 'راحة — أو قراءة حرة بدون التزام',
    tips: ['احمل كتابك معك', 'اقرأ قبل النوم بدل الجوال'],
  },
  exam: {
    match: /اختبار|امتحان|مذاكره|مذاكرة|دراسه|دراسة|قدرات|تحصيلي|ايلتس|توفل|stem|exam|study/,
    icon: 'study',
    area: 'study',
    duration: 90,
    label: 'خطة مذاكرة',
    focuses: [
      { key: 'learn', title: 'شرح ومذاكرة' },
      { key: 'practice', title: 'حل تمارين' },
      { key: 'learn2', title: 'شرح ومذاكرة' },
      { key: 'review', title: 'مراجعة وأخطاء' },
      { key: 'mock', title: 'اختبار تجريبي' },
    ],
    phases: [
      { title: 'فهم الأساسيات', desc: 'تغطية المنهج أول مرة بفهم', q: 15 },
      { title: 'التدريب المكثف', desc: 'حل أسئلة كثيرة وتصنيف الأخطاء', q: 30 },
      { title: 'المراجعة الذكية', desc: 'التركيز على نقاط الضعف', q: 40 },
      { title: 'محاكاة الاختبار', desc: 'اختبارات كاملة بوقت حقيقي', q: 50 },
    ],
    session(f, ph, week) {
      const m = {
        learn: `ذاكر درسًا/فصلًا جديدًا (جلستان × 40 د) واكتب ملخصًا في صفحة`,
        learn2: `أكمل الفصل التالي + 10 أسئلة على ما ذاكرته`,
        practice: `حل ${ph.q} سؤالًا مع تصحيحها وتسجيل كل خطأ في دفتر الأخطاء`,
        review: `راجع دفتر الأخطاء وأعد حل الأسئلة التي أخطأت فيها هذا الأسبوع`,
        mock: week > 2 ? `اختبار تجريبي كامل بوقت حقيقي ثم حلّل نتيجتك` : `اختبار قصير (${ph.q} سؤال) على ما ذاكرته هذا الأسبوع`,
      };
      return m[f.key];
    },
    rest: 'راحة — خروج أو رياضة خفيفة لتجديد الذهن',
    tips: ['ذاكر بتقنية بومودورو', 'نم جيدًا قبل الاختبار'],
  },
  skill: {
    match: /برمج|كود|code|تطوير|تصميم|مهار|فوتوشوب|بايثون|python|جافا|موقع|تطبيق|رسم|تصوير|كورس|دوره|دورة/,
    icon: 'laptop',
    area: 'work',
    duration: 60,
    label: 'خطة مهارة',
    focuses: [
      { key: 'learn', title: 'تعلّم مفهوم' },
      { key: 'practice', title: 'تطبيق عملي' },
      { key: 'project', title: 'العمل على المشروع' },
      { key: 'review', title: 'مراجعة وتوثيق' },
    ],
    phases: [
      { title: 'الأساسيات', desc: 'المفاهيم الأساسية وتمارين صغيرة' },
      { title: 'مشروع صغير', desc: 'تطبيق ما تعلمته في مشروع كامل صغير' },
      { title: 'مفاهيم متقدمة', desc: 'التوسع والتعمق وأفضل الممارسات' },
      { title: 'المشروع النهائي', desc: 'مشروع تعرضه في ملفك (Portfolio)' },
    ],
    session(f, ph, week) {
      const m = {
        learn: `درس جديد (40 د) ضمن مرحلة «${ph.title}» ودوّن أهم 3 نقاط`,
        practice: `طبّق درس الأمس بتمرين عملي من صنعك`,
        project: `اعمل على مشروع المرحلة: أنجز جزءًا واحدًا واضحًا (أسبوع ${week})`,
        review: `راجع ما تعلمته هذا الأسبوع واكتب ملاحظاتك أو انشر ما أنجزته`,
      };
      return m[f.key];
    },
    rest: 'راحة — تصفح أعمال الآخرين للإلهام',
    tips: ['تعلّم بالتطبيق', 'وثّق تقدمك أسبوعيًا'],
  },
  money: {
    match: /مال|ادخار|توفير|فلوس|ميزانيه|ميزانية|ديون|استثمار|saving|money/,
    icon: 'money',
    area: 'money',
    duration: 15,
    label: 'خطة مالية',
    focuses: [
      { key: 'track', title: 'تسجيل المصاريف' },
      { key: 'track2', title: 'تسجيل المصاريف' },
      { key: 'review', title: 'مراجعة الميزانية' },
    ],
    phases: [
      { title: 'تتبع المصاريف', desc: 'اعرف أين يذهب مالك' },
      { title: 'وضع ميزانية', desc: 'حدود لكل بند وتقليل غير الضروري' },
      { title: 'الادخار المنتظم', desc: 'تحويل ثابت للادخار وصندوق طوارئ' },
      { title: 'النمو والمراجعة', desc: 'مراجعة شاملة والتخطيط لما بعده' },
    ],
    session(f, ph, week) {
      if (f.key === 'review') return `راجع مصاريف الأسبوع ${week} مقابل الميزانية وحوّل مبلغ الادخار الأسبوعي`;
      return `سجّل كل مصاريف اليوم وصنّفها (أساسي / كمالي)`;
    },
    rest: 'يوم بدون شراء غير ضروري',
    tips: ['ادخر أولًا ثم اصرف', 'ألغِ الاشتراكات غير المستخدمة'],
  },
};

const GENERIC = {
  icon: 'target',
  area: 'work',
  duration: 45,
  label: 'خطة عامة',
  focuses: [
    { key: 'learn', title: 'تعلّم وتخطيط' },
    { key: 'do', title: 'تنفيذ' },
    { key: 'do2', title: 'تنفيذ' },
    { key: 'review', title: 'مراجعة' },
  ],
  phases: [
    { title: 'التخطيط والبداية', desc: 'وضوح الهدف وتقسيمه وبدء العادة' },
    { title: 'بناء الأساس', desc: 'تنفيذ منتظم وخطوات صغيرة يومية' },
    { title: 'التقدم والتحدي', desc: 'رفع المستوى ومواجهة الأصعب' },
    { title: 'الإنجاز والمراجعة', desc: 'إكمال الهدف وتقييم النتائج' },
  ],
  session(f, ph, week, inPhaseWeek, dayInWeek, title) {
    const m = {
      learn: `خطط لخطوات هذا الأسبوع نحو «${title}» وتعلّم شيئًا يساعدك`,
      do: `نفّذ خطوة عملية واحدة واضحة نحو «${title}»`,
      do2: `أكمل خطوة الأمس أو ابدأ الخطوة التالية`,
      review: `راجع تقدم الأسبوع ${week}: ماذا أنجزت؟ وما الذي سيتغير؟`,
    };
    return m[f.key];
  },
  rest: 'راحة',
  tips: ['خطوة صغيرة كل يوم أفضل من خطوة كبيرة نادرة'],
};

export function detectKind(title) {
  const n = norm(title);
  for (const [k, v] of Object.entries(KINDS)) if (v.match.test(n)) return k;
  return 'generic';
}
const kindDef = (kind) => KINDS[kind] || GENERIC;

// أيام الإجازة الافتراضية: الجمعة للتمارين، ولا شيء لغيرها
export function defaultRestDays(kind) {
  return kind === 'fitness' ? [5] : kind === 'exam' ? [5] : [];
}

// توزيع المراحل على الأسابيع (4 مراحل كحد أقصى، كل مرحلة 4 أسابيع على الأقل إن أمكن)
function phaseRanges(totalWeeks, count) {
  const n = Math.max(1, Math.min(count, Math.ceil(totalWeeks / 3)));
  const base = Math.floor(totalWeeks / n);
  let extra = totalWeeks - base * n;
  const out = [];
  let w = 1;
  for (let i = 0; i < n; i++) {
    const len = base + (extra-- > 0 ? 1 : 0);
    out.push({ fromWeek: w, toWeek: w + len - 1 });
    w += len;
  }
  return out;
}

/**
 * يبني خطة الهدف كاملة
 * @param {{title:string, months:number, restDays:number[], time?:string|null, startDate?:string, weekly?:Array}} o
 */
export function buildGoalPlan({ title, months = 3, restDays, time = null, startDate = todayKey(), weekly }) {
  const kind = detectKind(title);
  const def = kindDef(kind);
  const days = Math.max(7, Math.round(months * 30.4));
  const endDate = addDays(startDate, days - 1);
  const totalWeeks = Math.ceil(days / 7);
  const rest = restDays ?? defaultRestDays(kind);
  const ranges = phaseRanges(totalWeeks, def.phases.length);
  const phases = ranges.map((r, i) => ({
    ...r,
    title: def.phases[i].title,
    desc: def.phases[i].desc,
    from: addDays(startDate, (r.fromWeek - 1) * 7),
    to: i === ranges.length - 1 ? endDate : addDays(startDate, r.toWeek * 7 - 1),
  }));
  // الجدول الأسبوعي: يبدأ من يوم البداية، والتركيزات تتناوب على أيام العمل فقط
  const startDow = fromKey(startDate).getDay();
  let k = 0;
  const schedule =
    weekly ||
    Array.from({ length: 7 }, (_, i) => {
      const dow = (startDow + i) % 7;
      if (rest.includes(dow)) return { dow, rest: true, focus: def.rest };
      const f = def.focuses[k++ % def.focuses.length];
      return { dow, rest: false, key: f.key, focus: f.title };
    });
  return { kind, label: def.label, icon: def.icon, area: def.area, duration: def.duration, startDate, endDate, totalWeeks, restDays: schedule.filter((d) => d.rest).map((d) => d.dow), time, weekly: schedule, phases, tips: def.tips };
}

// معلومات الأسبوع والمرحلة لتاريخ معيّن داخل الخطة
export function weekOf(plan, date) {
  const week = Math.floor(diffDays(date, plan.startDate) / 7) + 1;
  const pIdx = Math.max(0, plan.phases.findIndex((p) => week >= p.fromWeek && week <= p.toWeek));
  return { week, phaseIndex: pIdx, phase: plan.phases[pIdx], inPhaseWeek: week - plan.phases[pIdx].fromWeek + 1 };
}

// المهام المفصلة لكل يوم عمل من تاريخ معيّن حتى نهاية الخطة
export function planSessions(plan, title, from = plan.startDate) {
  const def = kindDef(plan.kind);
  const byDow = Object.fromEntries(plan.weekly.map((d) => [d.dow, d]));
  const out = [];
  for (let date = from < plan.startDate ? plan.startDate : from; date <= plan.endDate; date = addDays(date, 1)) {
    const slot = byDow[fromKey(date).getDay()];
    if (!slot || slot.rest) continue;
    const { week, phaseIndex, inPhaseWeek } = weekOf(plan, date);
    const phDef = def.phases[Math.min(phaseIndex, def.phases.length - 1)];
    const focusDef = def.focuses.find((f) => f.key === slot.key) || { key: slot.key || 'do', title: slot.focus, ex: [] };
    const dayInWeek = diffDays(date, plan.startDate) % 7;
    let desc = '';
    try {
      desc = def.session(focusDef, phDef, week, inPhaseWeek, dayInWeek, title) || '';
    } catch (e) {
      console.warn('[himmah:plan]', e?.message || e);
    }
    out.push({
      title: `${slot.focus} — الأسبوع ${week}`,
      desc: `المرحلة ${phaseIndex + 1}: ${plan.phases[phaseIndex].title}\n${desc}`.trim(),
      date,
      time: plan.time || null,
      duration: plan.duration,
    });
  }
  return out;
}
