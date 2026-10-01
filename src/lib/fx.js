// أصوات الإنجاز (WebAudio بدون ملفات) + الاهتزاز
let ctx;
function tone(freq, start, dur, gain = 0.06, type = 'sine') {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.05);
}
export function playSound(kind = 'done') {
  try {
    if (kind === 'done') {
      tone(880, 0, 0.18);
      tone(1320, 0.08, 0.25);
    } else if (kind === 'level') {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.35, 0.05, 'triangle'));
    } else if (kind === 'achievement') {
      [784, 988, 1175].forEach((f, i) => tone(f, i * 0.1, 0.4, 0.05, 'triangle'));
    } else if (kind === 'timer') {
      [660, 660, 880].forEach((f, i) => tone(f, i * 0.25, 0.2, 0.07));
    }
  } catch (e) {
    // الصوت غير مدعوم
    console.warn('[himmah:sound]', e?.message || e);
  }
}
export function vibrate(pattern = 30) {
  try {
    navigator.vibrate?.(pattern);
  } catch (e) {
    // ميزة ثانوية غير متاحة في هذا المتصفح — لا توقف التطبيق
    console.warn('[himmah:vibrate]', e?.message || e);
  }
}
