// نظام أيقونات موحّد (lucide-react)
// البيانات تخزن "مفتاح" الأيقونة (مثل 'book')، والبيانات القديمة التي تحوي Emoji
// تُحوّل تلقائيًا للمفتاح المناسب عبر EMOJI_TO_KEY — بدون أي ترحيل للبيانات.
import { memo } from 'react';
import {
  BookOpen, GraduationCap, PenLine, BookOpenText, Dumbbell, Footprints, Coffee, Moon, Salad, Droplets, HeartPulse, Stethoscope,
  Briefcase, Laptop, Wallet, ShoppingCart, Users, HandHeart, Gamepad2, Clapperboard, Plane, Sparkles, Target, Globe, Brain, Palette,
  Rocket, Heart, Flame, Trophy, Medal, Gift, Star, Sunrise, PhoneOff, Headphones, Cake, Smartphone, TreePalm, Folder, Presentation,
  PartyPopper, ChartColumn, House, Leaf, Crown, Zap, Bird, Gem, Handshake, Mic, Sprout, Siren, Flower2, Utensils, Mountain, Award,
} from 'lucide-react';
import { tr } from '../i18n/index.js';

export const ICON_MAP = {
  book: BookOpen, study: GraduationCap, pen: PenLine, read: BookOpenText, dumbbell: Dumbbell, walk: Footprints, coffee: Coffee,
  sleep: Moon, food: Salad, meal: Utensils, water: Droplets, health: HeartPulse, doctor: Stethoscope, work: Briefcase, laptop: Laptop,
  money: Wallet, cart: ShoppingCart, family: Users, pray: HandHeart, fun: Gamepad2, film: Clapperboard, travel: Plane, sparkles: Sparkles,
  target: Target, globe: Globe, brain: Brain, palette: Palette, rocket: Rocket, heart: Heart, flame: Flame, trophy: Trophy, medal: Medal,
  gift: Gift, star: Star, sunrise: Sunrise, phoneoff: PhoneOff, headphones: Headphones, cake: Cake, smartphone: Smartphone, beach: TreePalm,
  folder: Folder, presentation: Presentation, party: PartyPopper, chart: ChartColumn, home: House, leaf: Leaf, crown: Crown, zap: Zap,
  owl: Bird, gem: Gem, handshake: Handshake, mic: Mic, seedling: Sprout, siren: Siren, meditation: Flower2, mountain: Mountain, award: Award,
};

const EMOJI_TO_KEY = {
  '📚': 'book', '📝': 'pen', '🎓': 'study', '📖': 'read', '💪': 'dumbbell', '🚶': 'walk', '🏃': 'walk', '☕': 'coffee', '🥗': 'food',
  '🍔': 'meal', '💧': 'water', '😴': 'sleep', '🌙': 'sleep', '💼': 'work', '💻': 'laptop', '💰': 'money', '🛒': 'cart', '🛍️': 'cart',
  '👨‍👩‍👦': 'family', '🕌': 'pray', '🎮': 'fun', '🎬': 'film', '✈️': 'travel', '✨': 'sparkles', '🩺': 'doctor', '🎯': 'target',
  '🌍': 'globe', '🧠': 'brain', '🎨': 'palette', '🚀': 'rocket', '❤️': 'heart', '🔥': 'flame', '🏆': 'trophy', '🎁': 'gift', '⭐': 'star',
  '🌅': 'sunrise', '📵': 'phoneoff', '🎧': 'headphones', '🍰': 'cake', '📱': 'smartphone', '🏖️': 'beach', '📁': 'folder', '🧘': 'meditation',
  '🏋️': 'dumbbell', '🌱': 'seedling', '🥇': 'medal', '🎖️': 'medal', '🏅': 'medal', '💯': 'award', '🌋': 'flame', '⚡': 'zap', '👑': 'crown',
  '🌿': 'leaf', '🚨': 'siren', '🎙️': 'mic', '🦉': 'owl', '🤝': 'handshake', '💎': 'gem', '🏠': 'home', '🎉': 'party', '📊': 'chart',
};

export const resolveIcon = (name) => ICON_MAP[name] || ICON_MAP[EMOJI_TO_KEY[name]] || null;

// أيقونة واحدة: مفتاح، أو Emoji قديم، أو نص المستخدم كما هو
export const Glyph = memo(function Glyph({ name, size = 18, className = '', strokeWidth = 2, fallback = 'sparkles' }) {
  const I = resolveIcon(name);
  if (I) return <I size={size} className={className} strokeWidth={strokeWidth} aria-hidden />;
  if (name && typeof name === 'string') return <span className={className} style={{ fontSize: size * 0.95, lineHeight: 1 }} aria-hidden>{name}</span>;
  const F = ICON_MAP[fallback];
  return <F size={size} className={className} strokeWidth={strokeWidth} aria-hidden />;
});

// مربع أيقونة ملوّن بنبرة هادئة
export function IconTile({ name, color = 'var(--primary)', size = 38, iconSize, className = '', style }) {
  return (
    <span
      className={`icon-tile ${className}`}
      style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 26%, transparent)`, ...style }}
      aria-hidden
    >
      <Glyph name={name} size={iconSize || Math.round(size * 0.48)} />
    </span>
  );
}

// منتقي أيقونات بسيط
export function IconPicker({ value, onChange, options, label = tr('الأيقونة') }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={resolveIcon(value) === resolveIcon(k)} aria-label={k} className={`chip icon-chip ${resolveIcon(value) === resolveIcon(k) ? 'on' : ''}`} onClick={() => onChange(k)}>
          <Glyph name={k} size={17} />
        </button>
      ))}
    </div>
  );
}
