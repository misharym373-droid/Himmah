// إعدادات عامة للموقع — عدّلها من هنا
export const BRAND = 'هّمة';
export const TAGLINE = 'نحو يوم أفضل';

// رابط موقع صُرّة لإدارة الأموال (يفتح في تبويب جديد)
// ضع الرابط هنا — ويمكن للمستخدم أيضًا تعديله من الإعدادات
export const SURRA_URL = 'https://misharym373-droid.github.io/sorra/';

// مجالات الحياة
// ألوان النظام: Primary بنفسجي · Success أخضر · Warning ذهبي · Danger أحمر · Info أزرق
export const COLORS = { primary: '#7C5CFF', primarySoft: '#A78BFA', success: '#34D399', warning: '#FBBF24', danger: '#F87171', info: '#3B82F6', muted: '#94A3B8' };

// مجالات الحياة (icon = مفتاح أيقونة lucide في Glyph.jsx)
export const AREAS = {
  study: { label: 'الدراسة', icon: 'study', color: COLORS.primary },
  health: { label: 'الصحة', icon: 'health', color: COLORS.success },
  work: { label: 'العمل', icon: 'work', color: COLORS.info },
  money: { label: 'المال', icon: 'money', color: COLORS.warning },
  family: { label: 'العائلة', icon: 'family', color: COLORS.primarySoft },
  fun: { label: 'الترفيه', icon: 'fun', color: COLORS.muted },
};

export const PRIORITIES = {
  low: { label: 'منخفضة', color: COLORS.muted, weight: 1 },
  med: { label: 'متوسطة', color: COLORS.info, weight: 2 },
  high: { label: 'عالية', color: COLORS.warning, weight: 3 },
  urgent: { label: 'عاجلة', color: COLORS.danger, weight: 4 },
};

export const ACCENTS = {
  purple: { label: 'بنفسجي', color: '#7C5CFF', soft: '#A78BFA' },
  blue: { label: 'أزرق', color: '#3B82F6', soft: '#60A5FA' },
  green: { label: 'أخضر', color: '#10B981', soft: '#34D399' },
  gold: { label: 'ذهبي', color: '#F59E0B', soft: '#FBBF24' },
  pink: { label: 'وردي', color: '#EC4899', soft: '#F472B6' },
};

export const PERSONAS = {
  friend: { label: 'صديق', icon: 'handshake', desc: 'قريب وودود' },
  coach: { label: 'مدرب', icon: 'target', desc: 'واضح ومنظم' },
  hype: { label: 'محفز', icon: 'zap', desc: 'حماس وطاقة' },
  calm: { label: 'هادئ', icon: 'meditation', desc: 'لطيف ومطمئن' },
};

// مستويات الطاقة اليومية
export const ENERGY = {
  low: { label: 'منخفضة', hint: 'مهام قصيرة' },
  mid: { label: 'متوسطة', hint: 'مزيج متوازن' },
  high: { label: 'عالية', hint: 'المهام الكبيرة' },
};

// اقتراحات أيقونات للمنتقيات
export const TASK_ICONS = ['book', 'pen', 'study', 'read', 'dumbbell', 'walk', 'coffee', 'food', 'water', 'sleep', 'work', 'laptop', 'money', 'cart', 'family', 'pray', 'fun', 'film', 'travel', 'sparkles'];
export const GOAL_ICONS = ['target', 'globe', 'dumbbell', 'book', 'work', 'money', 'brain', 'palette', 'walk', 'read', 'rocket', 'heart'];
