// أجواء وضع التركيز: خلفيات حيّة (مطر، عاصفة، غابة، بحر، ليل، مدفأة) + أصوات مطابقة
// + خلفية/صوت من جهاز المستخدم أو رابط فيديو (يوتيوب أو mp4)
import { useEffect, useRef, useState } from 'react';
import { CloudRain, CloudLightning, Trees, Waves, Moon, Flame, Circle, Upload, Link2, Volume2, VolumeX, X, Music, Film } from 'lucide-react';
import { useStore } from '../store.js';
import { tr } from '../i18n/index.js';
import { playAmbient, stopAmbient, setAmbientVolume, audioBlocked } from '../lib/ambient.js';
import { saveMedia, loadMedia, removeMedia } from '../lib/mediaStore.js';

export const SCENES = [
  { key: 'rain', label: 'مطر', icon: CloudRain, sound: 'rain', bg: 'linear-gradient(180deg,#0f1a24,#22313d)' },
  { key: 'storm', label: 'عاصفة', icon: CloudLightning, sound: 'storm', bg: 'linear-gradient(180deg,#07090d,#1a2129)' },
  { key: 'forest', label: 'غابة', icon: Trees, sound: 'forest', bg: 'linear-gradient(180deg,#0c1f17,#2a4a37)' },
  { key: 'waves', label: 'بحر', icon: Waves, sound: 'waves', bg: 'linear-gradient(180deg,#f2a46e,#3a4b7a 55%,#16243f)' },
  { key: 'night', label: 'ليل', icon: Moon, sound: 'night', bg: 'linear-gradient(180deg,#050a1a,#16233f)' },
  { key: 'fire', label: 'مدفأة', icon: Flame, sound: 'fire', bg: 'radial-gradient(circle at 50% 100%,#7a2e0c,#120a06 60%)' },
  { key: 'minimal', label: 'هادئ', icon: Circle, sound: 'none', bg: '#0b0d0c' },
];
export const SOUNDS = [
  ['auto', 'مطابق للخلفية'],
  ['rain', 'مطر'],
  ['storm', 'عاصفة ورعد'],
  ['waves', 'أمواج'],
  ['forest', 'غابة وعصافير'],
  ['fire', 'نار المدفأة'],
  ['night', 'ليل وصراصير'],
  ['brown', 'ضوضاء هادئة'],
  ['none', 'بدون صوت'],
];
export const DEFAULT_SCENE = { scene: 'rain', sound: 'auto', volume: 0.5, link: '', custom: '' };

export const useSceneSettings = () => ({ ...DEFAULT_SCENE, ...(useStore((s) => s.settings.focusScene) || {}) });
const saveScene = (patch) => {
  const st = useStore.getState();
  st.setSetting('focusScene', { ...DEFAULT_SCENE, ...(st.settings.focusScene || {}), ...patch });
};

// رابط يوتيوب → معرف الفيديو
export function youtubeId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
const isDirectVideo = (url) => /^https?:\/\/.+\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(String(url || ''));

// ————— رسم الخلفيات الحية —————
const rnd = (a, b) => a + Math.random() * (b - a);
function makeScene(key, w, h) {
  if (key === 'rain' || key === 'storm') {
    const heavy = key === 'storm';
    const drops = Array.from({ length: heavy ? 420 : 260 }, () => ({ x: rnd(0, w), y: rnd(-h, h), z: rnd(0.3, 1), len: rnd(10, 26) }));
    const lights = Array.from({ length: 26 }, () => ({ x: rnd(0, w), y: rnd(h * 0.45, h), r: rnd(18, 70), c: ['#f6c177', '#9ccfd8', '#eb6f92', '#f6c177', '#c4a7e7'][Math.floor(rnd(0, 5))] }));
    const glass = Array.from({ length: 40 }, () => ({ x: rnd(0, w), y: rnd(0, h), r: rnd(2, 6), v: rnd(0.05, 0.6) }));
    let flash = 0;
    return (c, dt) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, heavy ? '#07090d' : '#0f1a24');
      g.addColorStop(1, heavy ? '#1a2129' : '#22313d');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      for (const l of lights) {
        const rg = c.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        rg.addColorStop(0, l.c + (heavy ? '22' : '38'));
        rg.addColorStop(1, l.c + '00');
        c.fillStyle = rg;
        c.beginPath();
        c.arc(l.x, l.y, l.r, 0, 6.3);
        c.fill();
      }
      c.globalCompositeOperation = 'source-over';
      c.lineCap = 'round';
      for (const d of drops) {
        d.y += (heavy ? 1500 : 1050) * d.z * dt;
        d.x -= 160 * d.z * dt;
        if (d.y > h) (d.y = rnd(-60, 0)), (d.x = rnd(0, w + 100));
        c.strokeStyle = `rgba(190,215,235,${0.12 + d.z * 0.35})`;
        c.lineWidth = d.z * 1.3;
        c.beginPath();
        c.moveTo(d.x, d.y);
        c.lineTo(d.x + d.len * 0.18, d.y - d.len * d.z);
        c.stroke();
      }
      for (const q of glass) {
        q.y += q.v * 18 * dt;
        if (q.y > h + 10) (q.y = -10), (q.x = rnd(0, w));
        c.fillStyle = 'rgba(220,235,245,0.10)';
        c.beginPath();
        c.arc(q.x, q.y, q.r, 0, 6.3);
        c.fill();
      }
      if (heavy) {
        if (flash <= 0 && Math.random() < dt * 0.08) flash = 1;
        if (flash > 0) {
          c.fillStyle = `rgba(220,230,255,${flash * 0.35})`;
          c.fillRect(0, 0, w, h);
          flash -= dt * 2.5;
        }
      }
    };
  }
  if (key === 'forest') {
    const layers = [0.55, 0.68, 0.82].map((base, i) =>
      Array.from({ length: 18 + i * 6 }, () => ({ x: rnd(-40, w + 40), b: h * base + rnd(0, h * 0.08), tw: rnd(30, 70) * (1 + i * 0.3), th: rnd(h * 0.25, h * 0.45) * (1 + i * 0.25) }))
    );
    const flies = Array.from({ length: 45 }, () => ({ x: rnd(0, w), y: rnd(h * 0.35, h), a: rnd(0, 6.3), s: rnd(10, 30), p: rnd(0, 6.3) }));
    let t = 0;
    return (c, dt) => {
      t += dt;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#16302a');
      g.addColorStop(0.5, '#0f2219');
      g.addColorStop(1, '#07120c');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      const colors = ['#163024', '#10251b', '#0a1811'];
      layers.forEach((trees, i) => {
        c.fillStyle = colors[i];
        for (const tr0 of trees) {
          c.beginPath();
          c.moveTo(tr0.x, tr0.b - tr0.th);
          c.lineTo(tr0.x - tr0.tw, tr0.b);
          c.lineTo(tr0.x + tr0.tw, tr0.b);
          c.fill();
        }
        c.fillRect(0, layers[i][0].b + h * 0.06, w, h);
        if (i === 0) {
          const fog = c.createLinearGradient(0, h * 0.5, 0, h * 0.75);
          fog.addColorStop(0, 'rgba(160,190,170,0)');
          fog.addColorStop(0.5, 'rgba(160,190,170,0.10)');
          fog.addColorStop(1, 'rgba(160,190,170,0)');
          c.fillStyle = fog;
          c.fillRect(0, h * 0.5, w, h * 0.25);
        }
      });
      for (const f of flies) {
        f.a += rnd(-1, 1) * dt * 2;
        f.x += Math.cos(f.a) * f.s * dt;
        f.y += Math.sin(f.a) * f.s * dt;
        if (f.x < 0 || f.x > w || f.y < h * 0.3 || f.y > h) (f.x = rnd(0, w)), (f.y = rnd(h * 0.4, h));
        const glow = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + f.p));
        const rg = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, 9);
        rg.addColorStop(0, `rgba(240,230,140,${glow})`);
        rg.addColorStop(1, 'rgba(240,230,140,0)');
        c.fillStyle = rg;
        c.beginPath();
        c.arc(f.x, f.y, 9, 0, 6.3);
        c.fill();
      }
    };
  }
  if (key === 'waves') {
    let t = 0;
    const sparkles = Array.from({ length: 70 }, () => ({ x: rnd(0, w), y: rnd(h * 0.55, h * 0.75), p: rnd(0, 6.3) }));
    return (c, dt) => {
      t += dt;
      const g = c.createLinearGradient(0, 0, 0, h * 0.55);
      g.addColorStop(0, '#2b3561');
      g.addColorStop(0.6, '#c86f5b');
      g.addColorStop(1, '#f5b07a');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      const sx = w * 0.5;
      const sy = h * 0.52;
      const sun = c.createRadialGradient(sx, sy, 0, sx, sy, h * 0.18);
      sun.addColorStop(0, 'rgba(255,224,170,1)');
      sun.addColorStop(0.35, 'rgba(255,200,140,0.6)');
      sun.addColorStop(1, 'rgba(255,200,140,0)');
      c.fillStyle = sun;
      c.fillRect(0, 0, w, h);
      const seas = ['#3c4f7e', '#2e3f68', '#22325a', '#18264a', '#101b38'];
      seas.forEach((col, i) => {
        const y0 = h * (0.55 + i * 0.09);
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(0, h);
        for (let x = 0; x <= w; x += 12) c.lineTo(x, y0 + Math.sin(x / (120 + i * 40) + t * (0.5 + i * 0.15)) * (5 + i * 4) + Math.sin(x / 47 + t * 1.3) * 2);
        c.lineTo(w, h);
        c.fill();
      });
      for (const s of sparkles) {
        const a = Math.max(0, Math.sin(t * 2 + s.p)) * 0.6;
        c.fillStyle = `rgba(255,220,170,${a})`;
        c.fillRect(s.x + Math.sin(t + s.p) * 6, s.y, 3, 1.2);
      }
    };
  }
  if (key === 'night') {
    const stars = Array.from({ length: 260 }, () => ({ x: rnd(0, w), y: rnd(0, h * 0.75), r: rnd(0.3, 1.6), p: rnd(0, 6.3) }));
    let t = 0;
    let shoot = null;
    return (c, dt) => {
      t += dt;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#040814');
      g.addColorStop(1, '#1b2a4a');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      for (const s of stars) {
        c.fillStyle = `rgba(255,255,255,${0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + s.p))})`;
        c.beginPath();
        c.arc(s.x, s.y, s.r, 0, 6.3);
        c.fill();
      }
      const mx = w * 0.78;
      const my = h * 0.2;
      const mg = c.createRadialGradient(mx, my, 0, mx, my, 110);
      mg.addColorStop(0, 'rgba(255,250,230,0.45)');
      mg.addColorStop(1, 'rgba(255,250,230,0)');
      c.fillStyle = mg;
      c.fillRect(mx - 110, my - 110, 220, 220);
      c.fillStyle = '#f4efdc';
      c.beginPath();
      c.arc(mx, my, 34, 0, 6.3);
      c.fill();
      if (!shoot && Math.random() < dt * 0.12) shoot = { x: rnd(0, w * 0.6), y: rnd(0, h * 0.3), life: 1 };
      if (shoot) {
        c.strokeStyle = `rgba(255,255,255,${shoot.life})`;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(shoot.x, shoot.y);
        c.lineTo(shoot.x - 90, shoot.y - 30);
        c.stroke();
        shoot.x += 600 * dt;
        shoot.y += 200 * dt;
        shoot.life -= dt * 1.6;
        if (shoot.life <= 0) shoot = null;
      }
      c.fillStyle = '#070b16';
      c.beginPath();
      c.moveTo(0, h);
      for (let x = 0; x <= w; x += 20) c.lineTo(x, h * 0.82 + Math.sin(x / 180) * 30 + Math.sin(x / 63) * 8);
      c.lineTo(w, h);
      c.fill();
    };
  }
  if (key === 'fire') {
    const embers = Array.from({ length: 110 }, () => ({ x: w / 2 + rnd(-140, 140), y: rnd(h * 0.4, h), v: rnd(30, 110), s: rnd(1, 3), p: rnd(0, 6.3) }));
    let t = 0;
    return (c, dt) => {
      t += dt;
      c.fillStyle = '#0d0704';
      c.fillRect(0, 0, w, h);
      const flick = 0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 5.3);
      const glow = c.createRadialGradient(w / 2, h * 0.92, 0, w / 2, h * 0.92, h * 0.75 * flick);
      glow.addColorStop(0, 'rgba(255,150,60,0.75)');
      glow.addColorStop(0.3, 'rgba(200,80,25,0.35)');
      glow.addColorStop(1, 'rgba(60,20,8,0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) {
        const fx = w / 2 + (i - 3) * 26;
        const fh = h * (0.16 + 0.05 * Math.sin(t * 6 + i * 1.7));
        const fg = c.createLinearGradient(0, h * 0.92 - fh, 0, h * 0.92);
        fg.addColorStop(0, 'rgba(255,220,120,0)');
        fg.addColorStop(0.5, 'rgba(255,170,60,0.55)');
        fg.addColorStop(1, 'rgba(255,90,20,0.9)');
        c.fillStyle = fg;
        c.beginPath();
        c.moveTo(fx - 28, h * 0.92);
        c.quadraticCurveTo(fx + Math.sin(t * 7 + i) * 18, h * 0.92 - fh * 0.6, fx + Math.sin(t * 4 + i) * 10, h * 0.92 - fh);
        c.quadraticCurveTo(fx + 20, h * 0.92 - fh * 0.4, fx + 28, h * 0.92);
        c.fill();
      }
      c.fillStyle = '#2a160c';
      c.save();
      c.translate(w / 2, h * 0.93);
      c.rotate(-0.12);
      c.fillRect(-170, -12, 340, 24);
      c.rotate(0.24);
      c.fillRect(-170, -12, 340, 24);
      c.restore();
      for (const e of embers) {
        e.y -= e.v * dt;
        e.x += Math.sin(t * 2 + e.p) * 20 * dt;
        if (e.y < h * 0.2) (e.y = h * 0.9), (e.x = w / 2 + rnd(-120, 120));
        const a = Math.max(0, (e.y - h * 0.2) / (h * 0.7));
        c.fillStyle = `rgba(255,${140 + Math.floor(a * 80)},60,${a})`;
        c.fillRect(e.x, e.y, e.s, e.s);
      }
    };
  }
  return (c) => {
    c.fillStyle = '#0b0d0c';
    c.fillRect(0, 0, w, h);
  };
}

function SceneCanvas({ scene }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const c = cv.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
    let raf = 0;
    let draw;
    let last = performance.now();
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw = makeScene(scene, w, h);
      draw(c, 0.016);
    };
    size();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) draw(c, dt);
      raf = requestAnimationFrame(loop);
    };
    if (!reduce) raf = requestAnimationFrame(loop);
    window.addEventListener('resize', size);
    return () => (cancelAnimationFrame(raf), window.removeEventListener('resize', size));
  }, [scene]);
  return <canvas ref={ref} className="scene-canvas" aria-hidden />;
}

// ————— الخلفية حسب الاختيار —————
export function SceneBackground({ cfg, customBg }) {
  const yt = cfg.custom === 'link' ? youtubeId(cfg.link) : null;
  if (cfg.custom === 'link' && yt) {
    const mute = cfg.sound === 'video' ? 0 : 1;
    return (
      <div className="scene-media" aria-hidden>
        <iframe
          title="background"
          src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=${mute}&loop=1&playlist=${yt}&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3`}
          allow="autoplay; encrypted-media"
        />
      </div>
    );
  }
  if (cfg.custom === 'link' && isDirectVideo(cfg.link)) return <video className="scene-media" src={cfg.link} autoPlay loop playsInline muted={cfg.sound !== 'video'} aria-hidden />;
  if (cfg.custom === 'file' && customBg) {
    return customBg.type?.startsWith('video/') ? <video className="scene-media" src={customBg.url} autoPlay loop playsInline muted={cfg.sound !== 'video'} aria-hidden /> : <img className="scene-media" src={customBg.url} alt="" aria-hidden />;
  }
  return <SceneCanvas scene={cfg.scene} />;
}

// تشغيل/إيقاف الصوت حسب حالة الجلسة والاختيار
export function useAmbient(active, cfg, customAudio) {
  const [blocked, setBlocked] = useState(false);
  const kind = cfg.sound === 'auto' ? SCENES.find((s) => s.key === cfg.scene)?.sound || 'none' : cfg.sound === 'video' ? 'none' : cfg.sound;
  const fileUrl = cfg.sound === 'file' ? customAudio?.url : null;
  useEffect(() => {
    if (!active) return stopAmbient();
    let off = false;
    playAmbient(cfg.sound === 'file' ? 'file' : kind, { volume: cfg.volume, fileUrl }).then((ok) => !off && setBlocked(!ok && kind !== 'none'));
    return () => ((off = true), stopAmbient());
  }, [active, kind, fileUrl]); // eslint-disable-line
  useEffect(() => setAmbientVolume(cfg.volume), [cfg.volume]);
  const unblock = () => playAmbient(cfg.sound === 'file' ? 'file' : kind, { volume: cfg.volume, fileUrl }).then((ok) => setBlocked(!ok || audioBlocked()));
  return { blocked, unblock };
}

// ملفات المستخدم المحفوظة على الجهاز
export function useCustomMedia() {
  const [bg, setBg] = useState(null);
  const [audio, setAudio] = useState(null);
  useEffect(() => {
    let alive = true;
    loadMedia('focus-bg').then((m) => alive && setBg(m));
    loadMedia('focus-audio').then((m) => alive && setAudio(m));
    return () => {
      alive = false;
    };
  }, []);
  return { bg, audio, setBg, setAudio };
}

// ————— لوحة اختيار الأجواء —————
export function ScenePicker({ cfg, media, onClose, compact }) {
  const [link, setLink] = useState(cfg.link || '');
  const bgInput = useRef(null);
  const audioInput = useRef(null);
  const toast = useStore((s) => s.toast);
  async function pickBg(file) {
    if (!file) return;
    if (!/^(video|image)\//.test(file.type)) return toast(tr('اختر فيديو أو صورة'));
    try {
      await saveMedia('focus-bg', file);
    } catch (e) {
      console.warn('[himmah:media]', e?.message || e);
      return toast(tr('تعذر حفظ الملف على هذا الجهاز'));
    }
    media.setBg({ url: URL.createObjectURL(file), type: file.type, name: file.name });
    saveScene({ custom: 'file' });
  }
  async function pickAudio(file) {
    if (!file) return;
    if (!file.type.startsWith('audio/')) return toast(tr('اختر ملف صوتي'));
    try {
      await saveMedia('focus-audio', file);
    } catch (e) {
      console.warn('[himmah:media]', e?.message || e);
      return toast(tr('تعذر حفظ الملف على هذا الجهاز'));
    }
    media.setAudio({ url: URL.createObjectURL(file), type: file.type, name: file.name });
    saveScene({ sound: 'file' });
  }
  function applyLink() {
    const v = link.trim();
    if (!youtubeId(v) && !isDirectVideo(v)) return toast(tr('الصق رابط يوتيوب أو رابط فيديو مباشر (mp4)'));
    saveScene({ custom: 'link', link: v });
  }
  const hasVideo = (cfg.custom === 'link' && (youtubeId(cfg.link) || isDirectVideo(cfg.link))) || (cfg.custom === 'file' && media.bg?.type?.startsWith('video/'));
  return (
    <div className={`scene-picker ${compact ? 'compact' : ''}`} role="dialog" aria-label={tr('أجواء التركيز')}>
      {!compact && (
        <div className="row between mb">
          <b>{tr('أجواء التركيز')}</b>
          <button className="icon-btn sm" onClick={onClose} aria-label={tr('إغلاق')}>
            <X />
          </button>
        </div>
      )}
      <div className="sp-label">{tr('الخلفية')}</div>
      <div className="scene-grid">
        {SCENES.map((s) => (
          <button key={s.key} className={`scene-card ${!cfg.custom && cfg.scene === s.key ? 'on' : ''}`} style={{ background: s.bg }} onClick={() => saveScene({ scene: s.key, custom: '' })} aria-pressed={!cfg.custom && cfg.scene === s.key}>
            <s.icon size={18} />
            <span>{tr(s.label)}</span>
          </button>
        ))}
        <button className={`scene-card own ${cfg.custom === 'file' ? 'on' : ''}`} onClick={() => (media.bg && cfg.custom !== 'file' ? saveScene({ custom: 'file' }) : bgInput.current.click())}>
          <Film size={18} />
          <span>{media.bg ? tr('فيديو/صورتي') : tr('من جهازك')}</span>
        </button>
      </div>
      <input ref={bgInput} type="file" accept="video/*,image/*" hidden onChange={(e) => (pickBg(e.target.files[0]), (e.target.value = ''))} />
      {!compact && (
        <>
          <div className="row mt-s" style={{ gap: 6 }}>
            <div className="input-icon grow">
              <Link2 />
              <input className="input" dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} placeholder={tr('رابط فيديو يوتيوب أو mp4 (مثل: مطر 10 ساعات)')} onKeyDown={(e) => e.key === 'Enter' && applyLink()} aria-label={tr('رابط فيديو')} />
            </div>
            <button className="btn btn-sm" onClick={applyLink}>
              {tr('استخدام')}
            </button>
          </div>
          {media.bg && (
            <div className="row tiny muted mt-s" style={{ gap: 8 }}>
              <span className="ellipsis grow">{media.bg.name}</span>
              <button className="purple bold" onClick={() => bgInput.current.click()}>
                {tr('تغيير')}
              </button>
              <button className="red bold" onClick={() => (removeMedia('focus-bg'), media.setBg(null), cfg.custom === 'file' && saveScene({ custom: '' }))}>
                {tr('حذف')}
              </button>
            </div>
          )}
        </>
      )}
      <div className="sp-label mt">{tr('الصوت')}</div>
      <div className="chips">
        {SOUNDS.map(([k, l]) => (
          <button key={k} className={`chip ${cfg.sound === k ? 'on' : ''}`} onClick={() => saveScene({ sound: k })}>
            {tr(l)}
          </button>
        ))}
        {hasVideo && (
          <button className={`chip ${cfg.sound === 'video' ? 'on' : ''}`} onClick={() => saveScene({ sound: 'video' })}>
            <Film size={14} /> {tr('صوت الفيديو')}
          </button>
        )}
        <button className={`chip ${cfg.sound === 'file' ? 'on' : ''}`} onClick={() => (media.audio && cfg.sound !== 'file' ? saveScene({ sound: 'file' }) : audioInput.current.click())}>
          <Music size={14} /> {media.audio ? tr('صوتي') : tr('صوت من جهازك')}
        </button>
      </div>
      <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => (pickAudio(e.target.files[0]), (e.target.value = ''))} />
      <div className="row mt-s" style={{ gap: 10 }}>
        {cfg.volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
        <input className="range grow" type="range" min="0" max="1" step="0.05" value={cfg.volume} onChange={(e) => saveScene({ volume: +e.target.value })} aria-label={tr('مستوى الصوت')} />
      </div>
      {!compact && <p className="tiny dim mt-s">{tr('ملفاتك تُحفظ على هذا الجهاز فقط.')}</p>}
      {compact && (
        <button className="btn btn-xs btn-ghost mt-s" onClick={() => bgInput.current.click()}>
          <Upload size={13} /> {tr('خلفية من جهازك')}
        </button>
      )}
    </div>
  );
}
