// التغذية لخطط اللياقة: حساب السعرات بأمان + وجبات بسيطة ورخيصة تتعدّل كمياتها حسب سعراتك
// كل الحسابات تقريبية وتعمل على الجهاز (Mifflin-St Jeor + 7700 سعرة لكل كيلو دهون)
import { diffDays } from './date.js';
import { tr, isEn } from '../i18n/index.js';

const KCAL_PER_KG = 7700;
// النشاط حسب شدة الخطة (أيام التمرين في الأسبوع)
const ACTIVITY = { light: 1.375, medium: 1.465, strong: 1.55, max: 1.65 };
const STEPS = { light: 7000, medium: 8000, strong: 10000, max: 12000 };

/**
 * يحسب السعرات والمعدل الآمن
 * @param {{mode:'lose'|'gain'|'keep', sex:'m'|'f', weight:number, height:number, age:number, change:number}} body
 * @param {{days:number, intensity:string}} o
 */
export function calcBody(body, { days, intensity = 'medium' }) {
  const w = +body.weight;
  const h = +body.height;
  const a = +body.age;
  if (!(w >= 35 && w <= 300 && h >= 120 && h <= 230 && a >= 13 && a <= 90)) return null;
  const female = body.sex === 'f';
  const bmr = 10 * w + 6.25 * h - 5 * a + (female ? -161 : 5);
  const tdee = Math.round(bmr * (ACTIVITY[intensity] || ACTIVITY.medium));
  const weeks = Math.max(1, days / 7);
  const change = Math.max(0, +body.change || 0);
  const floor = female ? 1200 : 1500;
  let calories = tdee;
  let expected = 0;
  let requiredRate = 0;
  let safeRate = 0;
  let tooFast = false;
  if (body.mode === 'lose') {
    requiredRate = change / weeks;
    // الحد الآمن: 1% من وزنك أسبوعيًا (وبحد أقصى 1.2 كجم)، وعجز لا يتجاوز 30% من حرقك
    safeRate = Math.min(w * 0.01, 1.2);
    const maxDeficit = Math.min((safeRate * KCAL_PER_KG) / 7, tdee * 0.3, tdee - floor);
    const wanted = (requiredRate * KCAL_PER_KG) / 7;
    const deficit = Math.max(0, Math.min(wanted || maxDeficit, maxDeficit));
    calories = Math.round((tdee - deficit) / 10) * 10;
    expected = +((deficit * days) / KCAL_PER_KG).toFixed(1);
    tooFast = change > 0 && expected + 0.5 < change;
  } else if (body.mode === 'gain') {
    // زيادة عضل نظيفة: فائض بسيط (ربع إلى نص كيلو شهريًا تقريبًا)
    calories = Math.round((tdee + 300) / 10) * 10;
    expected = +((300 * days) / KCAL_PER_KG).toFixed(1);
  }
  const target = body.mode === 'lose' ? w - (change || expected) : body.mode === 'gain' ? w + (change || expected) : w;
  // أسابيع تحتاجها بالمعدل الآمن لو كان الهدف أسرع من اللازم
  const weeksNeeded = tooFast && safeRate ? Math.ceil(change / Math.min(safeRate, ((tdee - calories) * 7) / KCAL_PER_KG || safeRate)) : 0;
  return {
    bmr: Math.round(bmr),
    tdee,
    calories,
    protein: Math.round(Math.min(2, body.mode === 'gain' ? 2 : 1.8) * Math.max(target, w * 0.8)),
    water: +(w * 0.035).toFixed(1),
    steps: STEPS[intensity] || STEPS.medium,
    expected,
    requiredRate: +requiredRate.toFixed(2),
    safeRate: +safeRate.toFixed(2),
    tooFast,
    weeksNeeded,
  };
}

// ————— مكوّنات الوجبات (سعرات وبروتين لكل وحدة) —————
// كل مكوّن: نص الكمية بالعربي والإنجليزي، والحد الأدنى/الأقصى، و role: p (بروتين) / c (نشويات) / f (ثابت)
const plural = (n, one, two, few, many = few) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const halves = (n, word) => (n === 1 ? `نص ${word}` : n === 2 ? word : n === 3 ? `${word} ونص` : n === 4 ? `${word}ين` : `${n / 2} ${word}`);
const C = {
  egg: { k: 72, p: 6.3, role: 'p', min: 2, max: 4, ar: (n) => plural(n, 'بيضة', 'بيضتين', 'بيضات'), en: (n) => `${n} egg${n > 1 ? 's' : ''}` },
  bread: { k: 80, p: 3, role: 'c', min: 1, max: 4, ar: (n) => (n === 1 ? 'نص رغيف خبز بر' : n === 2 ? 'رغيف خبز بر' : n === 3 ? 'رغيف ونص خبز بر' : 'رغيفين خبز بر'), en: (n) => `${n / 2} whole-wheat pita` },
  foul: { k: 220, p: 15, role: 'p', min: 1, max: 2, ar: (n) => (n === 1 ? 'نص علبة فول' : 'علبة فول'), en: (n) => (n === 1 ? 'half a can of fava beans' : 'a can of fava beans') },
  oil: { k: 40, p: 0, role: 'f', min: 1, max: 1, ar: () => 'ملعقة صغيرة زيت زيتون', en: () => '1 tsp olive oil' },
  oats: { k: 75, p: 2.6, role: 'c', min: 2, max: 5, ar: (n) => `${n * 20} جم شوفان`, en: (n) => `${n * 20} g oats` },
  milk: { k: 100, p: 8, role: 'f', min: 1, max: 1, ar: () => 'كوب حليب قليل الدسم', en: () => '1 cup low-fat milk' },
  banana: { k: 100, p: 1, role: 'f', min: 1, max: 1, ar: () => 'موزة', en: () => '1 banana' },
  labneh: { k: 45, p: 2, role: 'f', min: 2, max: 2, ar: () => 'ملعقتين لبنة قليلة الدسم', en: () => '2 tbsp light labneh' },
  yogurt: { k: 100, p: 9, role: 'p', min: 1, max: 2, ar: (n) => (n === 1 ? 'علبة زبادي قليل الدسم' : 'علبتين زبادي قليل الدسم'), en: (n) => `${n} low-fat yogurt${n > 1 ? 's' : ''}` },
  dates: { k: 25, p: 0.2, role: 'f', min: 3, max: 3, ar: () => '3 تمرات', en: () => '3 dates' },
  tuna: { k: 120, p: 26, role: 'p', min: 1, max: 2, ar: (n) => (n === 1 ? 'علبة تونة بالماء' : 'علبتين تونة بالماء'), en: (n) => `${n} can${n > 1 ? 's' : ''} of tuna in water` },
  chicken: { k: 83, p: 15.5, role: 'p', min: 2, max: 6, ar: (n) => `${n * 50} جم صدر دجاج مشوي`, en: (n) => `${n * 50} g grilled chicken breast` },
  quarter: { k: 220, p: 32, role: 'p', min: 1, max: 2, ar: (n) => (n === 1 ? 'ربع دجاج شواية بدون جلد' : 'نص دجاج شواية بدون جلد'), en: (n) => (n === 1 ? 'a quarter rotisserie chicken (no skin)' : 'half a rotisserie chicken (no skin)') },
  rice: { k: 105, p: 2, role: 'c', min: 1, max: 5, ar: (n) => halves(n, 'كوب رز').replace('كوب رزين', 'كوبين رز'), en: (n) => `${n / 2} cup cooked rice` },
  potato: { k: 160, p: 4, role: 'c', min: 1, max: 2, ar: (n) => (n === 1 ? 'حبة بطاطس مسلوقة أو مشوية' : 'حبتين بطاطس مسلوقة أو مشوية'), en: (n) => `${n} boiled/baked potato${n > 1 ? 'es' : ''}` },
  pasta: { k: 90, p: 3.5, role: 'c', min: 1, max: 5, ar: (n) => halves(n, 'كوب مكرونة').replace('كوب مكرونةين', 'كوبين مكرونة'), en: (n) => `${n / 2} cup cooked pasta` },
  lentil: { k: 230, p: 13, role: 'p', min: 1, max: 2, ar: (n) => (n === 1 ? 'صحن شوربة عدس' : 'صحنين شوربة عدس'), en: (n) => `${n} bowl${n > 1 ? 's' : ''} of lentil soup` },
  liver: { k: 60, p: 8.5, role: 'p', min: 2, max: 5, ar: (n) => `${n * 50} جم كبدة دجاج بالبصل`, en: (n) => `${n * 50} g chicken liver with onion` },
  fish: { k: 130, p: 26, role: 'p', min: 1, max: 3, ar: (n) => `${n * 100} جم سمك بلطي مشوي`, en: (n) => `${n * 100} g grilled tilapia` },
  salad: { k: 40, p: 1, role: 'f', min: 1, max: 1, ar: () => 'سلطة خضار بليمون', en: () => 'a lemon salad' },
  veg: { k: 25, p: 1, role: 'f', min: 1, max: 1, ar: () => 'خيار وطماطم', en: () => 'cucumber and tomato' },
  apple: { k: 95, p: 0.5, role: 'f', min: 1, max: 1, ar: () => 'تفاحة', en: () => '1 apple' },
  nuts: { k: 120, p: 4, role: 'f', min: 1, max: 1, ar: () => 'حفنة مكسرات صغيرة (20 جم)', en: () => 'a small handful of nuts (20 g)' },
};

// الوجبات: [اسم، المكونات {مكوّن: الكمية الافتراضية}]
const MEALS = {
  breakfast: [
    ['بيض وخبز بر', { egg: 3, bread: 1, veg: 1 }],
    ['فول بزيت الزيتون', { foul: 1, oil: 1, bread: 1, veg: 1 }],
    ['شوفان بالحليب والموز', { oats: 2, milk: 1, banana: 1 }],
    ['لبنة وبيض', { labneh: 2, egg: 2, bread: 1, veg: 1 }],
    ['ساندوتش تونة', { tuna: 1, bread: 2, veg: 1 }],
    ['زبادي بالشوفان والتمر', { yogurt: 1, oats: 2, dates: 3 }],
  ],
  main: [
    ['دجاج مشوي مع رز', { chicken: 3, rice: 2, salad: 1 }],
    ['دجاج شواية', { quarter: 1, rice: 2, salad: 1 }],
    ['شوربة عدس وخبز', { lentil: 1, bread: 2, salad: 1 }],
    ['سمك مشوي مع رز', { fish: 2, rice: 2, salad: 1 }],
    ['دجاج مع بطاطس', { chicken: 3, potato: 1, salad: 1 }],
    ['كبدة دجاج وخبز', { liver: 3, bread: 2, salad: 1 }],
    ['مكرونة بالدجاج', { pasta: 2, chicken: 2, salad: 1 }],
    ['تونة مع رز', { tuna: 1, rice: 2, salad: 1 }],
  ],
  light: [
    ['بيض وفول', { egg: 2, foul: 1, veg: 1 }],
    ['زبادي وتونة', { yogurt: 1, tuna: 1, veg: 1 }],
    ['شوربة عدس', { lentil: 1, salad: 1 }],
    ['بيض مسلوق وخبز', { egg: 3, bread: 1, veg: 1 }],
  ],
  snack: [
    ['تفاحة', { apple: 1 }],
    ['زبادي', { yogurt: 1 }],
    ['تمر وحليب', { dates: 3, milk: 1 }],
    ['مكسرات', { nuts: 1 }],
    ['بيض مسلوق', { egg: 2 }],
  ],
};

export const MEAL_MODES = [
  ['2', 'وجبتين'],
  ['2s', 'وجبتين + سناك'],
  ['3', '3 وجبات'],
];
// توزيع السعرات على الوجبات
const SLOTS = {
  2: [['breakfast', 'الفطور', 'breakfast', 0.45], ['main', 'الغداء أو العشاء', 'main', 0.55]],
  '2s': [['breakfast', 'الفطور', 'breakfast', 0.4], ['main', 'الغداء أو العشاء', 'main', 0.47], ['snack', 'سناك', 'snack', 0.13]],
  3: [['breakfast', 'الفطور', 'breakfast', 0.3], ['lunch', 'الغداء', 'main', 0.42], ['dinner', 'وجبة العشاء', 'light', 0.28]],
};

const sum = (q, f) => Object.entries(q).reduce((a, [c, n]) => a + C[c][f] * n, 0);
// يكبّر/يصغّر كميات الوجبة لتقترب من السعرات المطلوبة (البروتين يُحافَظ عليه عند التقليل)
function fit(base, target) {
  const q = { ...base };
  const order = (role) => Object.keys(q).filter((c) => C[c].role === role);
  for (let i = 0; i < 20; i++) {
    const k = sum(q, 'k');
    if (Math.abs(k - target) <= 60) break;
    let changed = false;
    if (k < target) {
      for (const role of i % 2 ? ['p', 'c'] : ['c', 'p']) {
        const c = order(role).find((x) => q[x] < C[x].max && sum({ ...q, [x]: q[x] + 1 }, 'k') <= target + 80);
        if (c) {
          q[c]++;
          changed = true;
          break;
        }
      }
    } else {
      for (const role of ['c', 'p']) {
        const c = order(role).find((x) => q[x] > C[x].min);
        if (c) {
          q[c]--;
          changed = true;
          break;
        }
      }
    }
    if (!changed) break;
  }
  return q;
}

/** وجبات يوم معيّن من الخطة — ثابتة لكل تاريخ (تتغير يوميًا للتنويع) وقابلة للتبديل */
export function mealsForDay(plan, date) {
  const n = plan?.nutrition;
  if (!n?.calories || !n.meals) return null;
  const slots = SLOTS[n.meals] || SLOTS[2];
  const day = Math.max(0, diffDays(date, plan.startDate));
  const picks = plan.mealPick?.[date] || {};
  const out = slots.map(([key, label, pool, share], si) => {
    const list = MEALS[pool];
    const idx = (day + si * 3 + (picks[key] || 0)) % list.length;
    const [name, base] = list[idx];
    const q = fit(base, n.calories * share);
    const en = isEn();
    return {
      key,
      label: tr(label),
      name: tr(name),
      items: Object.entries(q).map(([c, k]) => (en ? C[c].en(k) : C[c].ar(k))),
      kcal: Math.round(sum(q, 'k') / 10) * 10,
      protein: Math.round(sum(q, 'p')),
    };
  });
  const kcal = out.reduce((a, m) => a + m.kcal, 0);
  // إذا الوجبات ما تغطي سعراتك: نقترح سناك بدل ما تنزل تحت الحد الآمن
  const gap = n.calories - kcal;
  return { meals: out, kcal, protein: out.reduce((a, m) => a + m.protein, 0), target: n.calories, gap: gap > 200 ? Math.round(gap / 50) * 50 : 0 };
}
