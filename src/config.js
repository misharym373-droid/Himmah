// إعدادات عامة للموقع — عدّلها من هنا
export const BRAND = 'مسار';
export const TAGLINE = 'خطّط · نظّم · أنجز';

// رابط موقع صُرّة لإدارة الأموال (يفتح في تبويب جديد)
// ضع الرابط هنا — ويمكن للمستخدم أيضًا تعديله من الإعدادات
export const SURRA_URL = 'https://misharym373-droid.github.io/sorra/';

// مجالات الحياة
// ألوان النظام (مستوحاة من ألوان Apple الهادئة + أخضر مسار)
export const COLORS = { primary: '#2E6B57', primarySoft: '#5FBF9C', success: '#30A46C', warning: '#E8940C', danger: '#E5484D', info: '#2F7CF6', muted: '#8B9590' };

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
  pine: { label: 'أخضر مسار', color: '#2E6B57', soft: '#5FBF9C' },
  blue: { label: 'أزرق', color: '#0A6CFF', soft: '#4C9BFF' },
  purple: { label: 'نيلي', color: '#5856D6', soft: '#8E8CF0' },
  green: { label: 'أخضر', color: '#248A3D', soft: '#34C759' },
  gold: { label: 'برتقالي', color: '#C25E00', soft: '#FF9F0A' },
  pink: { label: 'وردي', color: '#D7264F', soft: '#FF5A7A' },
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
