// أصوات أجواء التركيز — تُولَّد داخل المتصفح (Web Audio) بدون ملفات: مطر، عاصفة، أمواج، غابة، نار، ليل، ضوضاء بنية
// + تشغيل ملف صوتي يختاره المستخدم من جهازه (loop)
let ctx = null;
let master = null;
let current = null; // { stop() }
let fileAudio = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  return ctx;
}

// مخزن ضوضاء (أبيض / وردي / بني) لمدة ثانيتين يُعاد تشغيله بلا انقطاع
const buffers = {};
function noise(type) {
  if (buffers[type]) return buffers[type];
  const c = ctx;
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (type === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else if (type === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    } else d[i] = w;
  }
  return (buffers[type] = buf);
}
function loopNoise(type, out, gain = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noise(type);
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(out);
  src.start();
  return { src, g };
}
function filter(type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}
// أحداث عشوائية متكررة (قطرات، طقطقة، عصافير، رعد)
function every(minMs, maxMs, fn) {
  let t;
  const tick = () => {
    fn();
    t = setTimeout(tick, minMs + Math.random() * (maxMs - minMs));
  };
  t = setTimeout(tick, minMs * Math.random());
  return () => clearTimeout(t);
}
function burst(out, { freq = 3000, q = 1, dur = 0.05, vol = 0.3, type = 'bandpass', decay = dur }) {
  const src = ctx.createBufferSource();
  src.buffer = noise('white');
  const f = filter(type, freq, q);
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random());
  src.stop(t + decay + 0.05);
}
function chirp(out) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime;
  const base = 2500 + Math.random() * 2500;
  o.type = 'sine';
  o.frequency.setValueAtTime(base, t);
  const notes = 2 + Math.floor(Math.random() * 4);
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < notes; i++) {
    const s = t + i * 0.12;
    o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), s);
    o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), s + 0.08);
    g.gain.exponentialRampToValueAtTime(0.06, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.1);
  }
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + notes * 0.12 + 0.1);
}
function lfo(param, rate, depth, base) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = rate;
  g.gain.value = depth;
  param.value = base;
  o.connect(g).connect(param);
  o.start();
  return o;
}

const SOUNDS = {
  rain(out) {
    const hp = filter('highpass', 500);
    const lp = filter('lowpass', 7000);
    hp.connect(lp).connect(out);
    const n = loopNoise('pink', hp, 0.9);
    const stopDrops = every(30, 140, () => burst(out, { freq: 2000 + Math.random() * 4000, q: 2, dur: 0.03, vol: 0.12 + Math.random() * 0.15 }));
    return () => (stopDrops(), n.src.stop());
  },
  storm(out) {
    const stopRain = SOUNDS.rain(out);
    const lp = filter('lowpass', 900);
    lp.connect(out);
    const rumble = loopNoise('brown', lp, 0.5);
    const stopThunder = every(9000, 22000, () => burst(out, { type: 'lowpass', freq: 160, q: 0.5, vol: 1.4, decay: 3.5 + Math.random() * 2 }));
    return () => (stopRain(), stopThunder(), rumble.src.stop());
  },
  waves(out) {
    const lp = filter('lowpass', 900);
    const g = ctx.createGain();
    lp.connect(g).connect(out);
    const n = loopNoise('brown', lp, 1.4);
    const o1 = lfo(g.gain, 0.09, 0.55, 0.6);
    const o2 = lfo(lp.frequency, 0.09, 500, 900);
    return () => (n.src.stop(), o1.stop(), o2.stop());
  },
  forest(out) {
    const bp = filter('bandpass', 600, 0.4);
    const g = ctx.createGain();
    bp.connect(g).connect(out);
    const wind = loopNoise('pink', bp, 0.6);
    const o = lfo(g.gain, 0.05, 0.25, 0.45);
    const stopBirds = every(1500, 6000, () => chirp(out));
    return () => (wind.src.stop(), o.stop(), stopBirds());
  },
  fire(out) {
    const lp = filter('lowpass', 500);
    lp.connect(out);
    const base = loopNoise('brown', lp, 1.2);
    const stopCrackle = every(40, 400, () => burst(out, { type: 'highpass', freq: 1500 + Math.random() * 3000, dur: 0.02, vol: 0.2 + Math.random() * 0.4 }));
    return () => (base.src.stop(), stopCrackle());
  },
  night(out) {
    const bp = filter('bandpass', 400, 0.5);
    bp.connect(out);
    const wind = loopNoise('pink', bp, 0.25);
    const stopCrickets = every(600, 1600, () => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime;
      o.frequency.value = 4200 + Math.random() * 600;
      g.gain.setValueAtTime(0.0001, t);
      for (let i = 0; i < 3; i++) {
        g.gain.exponentialRampToValueAtTime(0.03, t + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.07);
      }
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.35);
    });
    return () => (wind.src.stop(), stopCrickets());
  },
  brown(out) {
    const lp = filter('lowpass', 1200);
    lp.connect(out);
    const n = loopNoise('brown', lp, 1.2);
    return () => n.src.stop();
  },
};
export const SOUND_KEYS = ['rain', 'storm', 'waves', 'forest', 'fire', 'night', 'brown'];

export function stopAmbient() {
  current?.();
  current = null;
  if (fileAudio) {
    fileAudio.pause();
    fileAudio = null;
  }
}

// تشغيل صوت: مفتاح مدمج، أو 'file' مع رابط ملف، أو 'none'
export async function playAmbient(kind, { volume = 0.5, fileUrl } = {}) {
  stopAmbient();
  if (!kind || kind === 'none') return true;
  if (kind === 'file') {
    if (!fileUrl) return false;
    fileAudio = new Audio(fileUrl);
    fileAudio.loop = true;
    fileAudio.volume = Math.min(1, volume);
    try {
      await fileAudio.play();
      return true;
    } catch (e) {
      console.warn('[himmah:ambient]', e?.message || e);
      return false;
    }
  }
  if (!ac() || !SOUNDS[kind]) return false;
  try {
    if (ctx.state === 'suspended') await ctx.resume();
  } catch (e) {
    console.warn('[himmah:ambient]', e?.message || e);
  }
  master.gain.value = volume;
  // تلاشٍ ناعم عند البدء
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
  out.connect(master);
  const stop = SOUNDS[kind](out);
  current = () => {
    try {
      out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
      setTimeout(() => (stop(), out.disconnect()), 600);
    } catch (e) {
      console.warn('[himmah:ambient]', e?.message || e);
    }
  };
  return ctx.state === 'running';
}

export function setAmbientVolume(v) {
  if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
  if (fileAudio) fileAudio.volume = Math.min(1, v);
}

// هل الصوت محجوب حتى يضغط المستخدم (سياسة المتصفح بعد تحديث الصفحة)؟
export const audioBlocked = () => !!ctx && ctx.state === 'suspended';
