// الطبقات العائمة: التنبيهات المنبثقة، الاحتفالات، وضع التركيز، قائمة الأوامر، الإشعارات، المساعد
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Trash2, Clock, Sparkles, Pause, Play, Square, Minimize2, Maximize2, CircleCheck, Search, Bell, Send, Bot, CheckCheck, X, Plus, Mic, ImagePlus, Siren, Hourglass, Keyboard, Undo2, RotateCw, Timer, TriangleAlert, Flame, Target, Trophy, Sunset, Info } from 'lucide-react';
import { Glyph, IconTile } from './Glyph.jsx';
import { useStore } from '../store.js';
import { navigate } from '../router.js';
import { Drawer, Modal, ConfirmModal } from './ui.jsx';
import { NAV } from './Layout.jsx';
import TaskModal from './TaskModal.jsx';
import { VoiceModal, CreatedModal, ImageModal, RescheduleModal, RescueModal, OneHourModal, WhatNowModal, InteractiveModal, ShortcutsModal, FocusStartModal } from './Modals.jsx';
import { formatClock, timeAgo, relativeDay } from '../lib/date.js';
import { chat, say } from '../lib/assistant.js';
import { PERSONAS } from '../config.js';

const TOAST_ICONS = { check: Check, trash: Trash2, clock: Clock, sparkles: Sparkles };

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => {
        const I = TOAST_ICONS[t.icon] || Sparkles;
        return (
          <div className={`toast ${t.tone || ''}`} key={t.id}>
            <I aria-hidden />
            <span className="grow">{t.text}</span>
            {t.action && (
              <button
                className="btn btn-xs"
                onClick={() => {
                  t.action.run();
                  dismiss(t.id);
                }}
              >
                <Undo2 /> {t.action.label}
              </button>
            )}
            <button className="icon-btn sm plain toast-x" aria-label="إغلاق التنبيه" onClick={() => dismiss(t.id)}>
              <X />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ————— لحظات الإنجاز: بطاقة صغيرة أعلى الشاشة بدل النوافذ الكبيرة —————
export function FxLayer() {
  const fx = useStore((s) => s.fx);
  const shift = useStore((s) => s.shiftFx);
  const cur = fx[0];
  useEffect(() => {
    if (!cur) return;
    const t = setTimeout(() => shift(cur.id), cur.type === 'xp' ? 1200 : 2600);
    return () => clearTimeout(t);
  }, [cur, shift]);
  if (!cur) return null;
  if (cur.type === 'xp')
    return (
      <div className="xp-float num" key={cur.id} aria-live="polite">
        +{cur.amount} XP
      </div>
    );
  const map = {
    level: { tone: 'var(--primary)', icon: 'star', kicker: 'Level Up', title: `وصلت إلى المستوى ${cur.level}`, ring: cur.level },
    achievement: { tone: 'var(--gold)', icon: cur.ach?.icon, kicker: 'إنجاز جديد', title: cur.ach?.title, sub: cur.ach?.desc },
    streak: { tone: 'var(--gold)', icon: 'flame', kicker: 'أكملت يومك', title: `${cur.count} يوم متتالي` },
    reward: { tone: 'var(--green)', icon: cur.reward?.icon || 'gift', kicker: 'استمتع بمكافأتك', title: cur.reward?.title },
  }[cur.type];
  if (!map) return null;
  return (
    <div className="fx-card-wrap" aria-live="assertive">
      <button className="fx-card" key={cur.id} onClick={() => shift(cur.id)} style={{ '--tone': map.tone }} aria-label={`${map.kicker}: ${map.title} — إغلاق`}>
        {map.ring ? <span className="lvl-ring sm num">{map.ring}</span> : <IconTile name={map.icon} color={map.tone} size={44} />}
        <span className="grow" style={{ textAlign: 'start' }}>
          <span className="tiny bold" style={{ color: map.tone, display: 'block' }}>{map.kicker}</span>
          <span className="bold" style={{ display: 'block' }}>{map.title}</span>
          {map.sub && <span className="tiny muted" style={{ display: 'block' }}>{map.sub}</span>}
        </span>
      </button>
    </div>
  );
}

// ————— وضع التركيز —————
export function FocusMode() {
  const focus = useStore((s) => s.focus);
  const task = useStore((s) => (s.focus ? s.tasks.find((t) => t.id === s.focus.taskId) : null));
  const { pauseFocus, resumeFocus, endFocus, minimizeFocus, openModal, finishFocus, startFocus } = useStore.getState();
  const [, force] = useState(0);
  useEffect(() => {
    if (!focus?.running) return;
    const t = setInterval(() => {
      const f = useStore.getState().focus;
      if (f?.running && f.endAt <= Date.now()) finishFocus();
      force((x) => x + 1);
    }, 250);
    return () => clearInterval(t);
  }, [focus?.running, focus?.endAt, finishFocus]);
  if (!focus) return null;
  const finished = !!focus.finished;
  const remaining = finished ? 0 : focus.running ? Math.max(0, (focus.endAt - Date.now()) / 1000) : focus.remainingSec;
  const pct = 100 - (remaining / focus.totalSec) * 100;
  const minutes = Math.round(focus.totalSec / 60);
  const completeTask = () => endFocus(true);
  const another = () => startFocus(focus.taskId, minutes);

  if (focus.minimized && !finished)
    return (
      <div className="focus-mini" role="status" aria-label="جلسة تركيز جارية">
        <span className="pulse-dot" />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="tiny muted">تركيز</div>
          <div className="bold ellipsis small">{task?.title || 'جلسة تركيز'}</div>
        </div>
        <span className="xbold num" style={{ fontSize: '1.2rem' }}>{formatClock(remaining)}</span>
        <button className="icon-btn sm" onClick={() => (focus.running ? pauseFocus() : resumeFocus())} aria-label={focus.running ? 'إيقاف مؤقت' : 'استئناف'}>
          {focus.running ? <Pause /> : <Play />}
        </button>
        <button className="icon-btn sm" onClick={() => minimizeFocus(false)} aria-label="فتح وضع التركيز">
          <Maximize2 />
        </button>
      </div>
    );

  return (
    <div className="focus-mode" role="dialog" aria-modal="true" aria-label="وضع التركيز">
      <div className="breath" />
      {!finished && (
        <button className="icon-btn" style={{ position: 'absolute', top: 20, insetInlineEnd: 20 }} onClick={() => minimizeFocus(true)} aria-label="تصغير وضع التركيز">
          <Minimize2 />
        </button>
      )}
      <div className="badge purple" style={{ fontSize: '.85rem', padding: '4px 14px' }}>
        {finished ? (
          <>
            <CircleCheck size={14} /> انتهت الجلسة
          </>
        ) : focus.running ? (
          <>
            <span className="pulse-dot" /> جلسة تركيز {focus.session > 1 ? <span className="num">#{focus.session}</span> : ''}
          </>
        ) : (
          'متوقف مؤقتًا'
        )}
      </div>
      <div>
        <h2 style={{ fontSize: 'clamp(1.4rem,4vw,2.1rem)', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          {task && <Glyph name={task.icon} size={26} />} {task?.title || 'جلسة تركيز'}
        </h2>
        <div className="muted small mt-s">{finished ? `سجلنا ${minutes} دقيقة تركيز` : `جلسة ${minutes} دقيقة`}</div>
      </div>
      <div className="timer" aria-live="off">{formatClock(remaining)}</div>
      <div style={{ width: 'min(420px, 80vw)' }}>
        <div className="bar thick green">
          <i style={{ width: `${pct}%`, transition: 'width .3s linear' }} />
        </div>
      </div>
      {task?.subtasks?.length > 0 && !finished && (
        <div className="col" style={{ minWidth: 'min(360px, 85vw)', textAlign: 'start' }}>
          {task.subtasks.map((s) => (
            <button key={s.id} className="row" onClick={() => useStore.getState().toggleSubtask(task.id, s.id)} style={{ color: s.done ? 'var(--dim)' : '' }} aria-pressed={s.done}>
              <span className={`check ${s.done ? 'on' : ''}`} style={{ width: 22, height: 22 }}>
                <Check />
              </span>
              <span style={{ textDecoration: s.done ? 'line-through' : '' }}>{s.title}</span>
            </button>
          ))}
        </div>
      )}
      <div className="row wrap" style={{ justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        {finished ? (
          <>
            {task && !task.done && (
              <button className="btn btn-lg btn-green" onClick={completeTask}>
                <CircleCheck /> إكمال المهمة
              </button>
            )}
            <button className="btn btn-lg btn-glass" onClick={another}>
              <RotateCw /> جلسة أخرى
            </button>
            <button className="btn btn-lg btn-ghost" style={{ color: '#94a3b8' }} onClick={() => endFocus(false)}>
              إنهاء
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-lg btn-glass" onClick={() => (focus.running ? pauseFocus() : resumeFocus())}>
              {focus.running ? (
                <>
                  <Pause /> إيقاف مؤقت
                </>
              ) : (
                <>
                  <Play /> استئناف
                </>
              )}
            </button>
            {task && !task.done && (
              <button className="btn btn-lg btn-green" onClick={completeTask}>
                <CircleCheck /> إنهاء المهمة
              </button>
            )}
            <button
              className="btn btn-lg btn-glass"
              onClick={() => {
                const m = endFocus(false);
                useStore.getState().toast(m ? `سجلنا ${m} دقيقة تركيز` : 'أُنهيت الجلسة', { icon: 'clock' });
              }}
            >
              <Square /> إنهاء مبكرًا
            </button>
            {task && !task.done && (
              <button className="btn btn-lg btn-ghost" style={{ color: '#94a3b8' }} onClick={() => (endFocus(false), openModal('reschedule', { id: task.id }))}>
                <Clock /> تأجيل
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ————— قائمة الأوامر (Ctrl+K) —————
export function CommandMenu() {
  const setDrawer = useStore((s) => s.setDrawer);
  const tasks = useStore((s) => s.tasks);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const open = useStore((s) => s.openModal);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const close = () => setDrawer(null);
  const actions = [
    { g: 'إجراءات', label: 'مهمة جديدة', icon: Plus, run: () => open('task'), k: 'N' },
    { g: 'إجراءات', label: 'إضافة بالصوت', icon: Mic, run: () => open('voice'), k: 'V' },
    { g: 'إجراءات', label: 'أضف مهمة من صورة', icon: ImagePlus, run: () => open('image') },
    { g: 'إجراءات', label: 'وش أسوي الآن؟', icon: Sparkles, run: () => open('whatNow'), k: 'W' },
    { g: 'إجراءات', label: 'أنقذ يومي', icon: Siren, run: () => open('rescue') },
    { g: 'إجراءات', label: 'عندي ساعة فقط', icon: Hourglass, run: () => open('oneHour') },
    { g: 'إجراءات', label: 'اسأل هّمة', icon: Bot, run: () => setTimeout(() => setDrawer('assistant')), k: 'A' },
    { g: 'إجراءات', label: 'اختصارات لوحة المفاتيح', icon: Keyboard, run: () => open('shortcuts'), k: '?' },
    ...NAV.map((n) => ({ g: 'الصفحات', label: n.label, icon: n.icon, run: () => navigate(n.id) })),
  ];
  const ql = q.trim();
  const results = useMemo(() => {
    const a = actions.filter((x) => !ql || x.label.includes(ql));
    if (!ql) return a;
    const t = tasks
      .filter((x) => !x.deletedAt && !x.template && x.title.includes(ql))
      .slice(0, 8)
      .map((x) => ({ g: 'المهام', label: x.title, sub: `${relativeDay(x.date)}${x.time ? ' · ' + x.time : ''}`, icon: CheckCheck, run: () => open('task', { task: x }) }));
    const gs = goals.filter((x) => x.title.includes(ql)).map((x) => ({ g: 'الأهداف', label: x.title, icon: Target, run: () => navigate('goals') }));
    const hs = habits.filter((x) => x.title.includes(ql)).map((x) => ({ g: 'العادات', label: x.title, icon: Flame, run: () => navigate('habits') }));
    return [...t, ...gs, ...hs, ...a];
  }, [ql, tasks, goals, habits]); // eslint-disable-line
  useEffect(() => setIdx(0), [ql]);
  function run(r) {
    close();
    r.run();
  }
  let lastG = null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal cmd" role="dialog" aria-label="قائمة الأوامر">
        <div className="cmd-input">
          <Search size={20} className="dim" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن مهمة، هدف، صفحة أو أمر…"
            aria-label="بحث"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setIdx((i) => Math.min(results.length - 1, i + 1)));
              if (e.key === 'ArrowUp') (e.preventDefault(), setIdx((i) => Math.max(0, i - 1)));
              if (e.key === 'Enter' && results[idx]) run(results[idx]);
              if (e.key === 'Escape') close();
            }}
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmd-list" role="listbox">
          {!results.length && (
            <div className="empty">
              <p className="muted">لا توجد نتائج لـ "{ql}"</p>
              <button className="btn btn-sm btn-primary" onClick={() => (close(), useStore.getState().addTask({ title: ql }), useStore.getState().toast(`تمت إضافة "${ql}"`))}>
                <Plus /> أضف "{ql}" كمهمة
              </button>
            </div>
          )}
          {results.map((r, i) => {
            const head = r.g !== lastG ? <div className="cmd-group">{r.g}</div> : null;
            lastG = r.g;
            const I = r.icon;
            return (
              <div key={r.g + r.label + i}>
                {head}
                <button className={`cmd-item ${i === idx ? 'on' : ''}`} onMouseEnter={() => setIdx(i)} onClick={() => run(r)} role="option" aria-selected={i === idx}>
                  <I />
                  <span className="grow">
                    {r.label}
                    {r.sub && <span className="tiny dim"> — {r.sub}</span>}
                  </span>
                  {r.k && <span className="kbd">{r.k}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// أيقونة الإشعار حسب نوعه (بدل الـEmoji المخزنة)
const NOTIF_ICONS = {
  upcoming: [Bell, 'var(--blue)'],
  overdue: [TriangleAlert, 'var(--red)'],
  streak: [Flame, 'var(--gold)'],
  endOfDay: [Sunset, 'var(--primary-soft)'],
  focus: [Timer, 'var(--green)'],
  goals: [Target, 'var(--primary-soft)'],
  achievements: [Trophy, 'var(--gold)'],
};
function NotifIcon({ type }) {
  const [I, c] = NOTIF_ICONS[type] || [Info, 'var(--primary-soft)'];
  return (
    <span className="t-icon" style={{ color: c }} aria-hidden>
      <I size={18} />
    </span>
  );
}

// ————— مركز الإشعارات —————
export function NotificationsDrawer() {
  const setDrawer = useStore((s) => s.setDrawer);
  const list = useStore((s) => s.notifications);
  const markAll = useStore((s) => s.markAllRead);
  const clear = useStore((s) => s.clearNotifications);
  const remove = useStore((s) => s.removeNotification);
  useEffect(() => {
    const t = setTimeout(markAll, 2500);
    return () => clearTimeout(t);
  }, [markAll]);
  return (
    <Drawer
      title="الإشعارات"
      icon={<Bell size={18} />}
      onClose={() => setDrawer(null)}
      actions={
        list.length > 0 && (
          <button className="btn btn-xs btn-ghost" onClick={clear}>
            مسح الكل
          </button>
        )
      }
    >
      {!list.length ? (
        <div className="empty">
          <div className="e-ico">
            <Bell />
          </div>
          <h3>لا توجد إشعارات</h3>
          <p className="muted small">كل شيء تحت السيطرة.</p>
        </div>
      ) : (
        <div className="col">
          {list.map((n, i) => (
            <div key={n.id} className="task reveal" style={{ animationDelay: `${i * 0.03}s`, cursor: 'default', alignItems: 'flex-start', borderColor: n.read ? '' : 'rgba(var(--primary-rgb),.4)' }}>
              <NotifIcon type={n.type} />
              <div className="grow">
                <div className="bold small">{n.title}</div>
                <div className="small muted">{n.body}</div>
                <div className="tiny dim mt-s">{timeAgo(n.time)}</div>
              </div>
              <button className="icon-btn sm plain" aria-label="حذف الإشعار" onClick={() => remove(n.id)}>
                <X />
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-sm btn-ghost btn-block mt" onClick={() => (setDrawer(null), navigate('settings?tab=notifications'))}>
        تخصيص الإشعارات
      </button>
    </Drawer>
  );
}

// ————— اسأل هّمة (المساعد) —————
export function AssistantDrawer() {
  const setDrawer = useStore((s) => s.setDrawer);
  const persona = useStore((s) => s.settings.persona);
  const name = useStore((s) => s.profile.name);
  const [msgs, setMsgs] = useState(() => [{ role: 'ai', text: `${say(persona, 'hi')} ${name ? name + '،' : ''} أنا مساعد هّمة. كيف أقدر أساعدك اليوم؟` }]);
  const [v, setV] = useState('');
  const [typing, setTyping] = useState(false);
  const end = useRef(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs, typing]);
  function send(text) {
    const t = (text ?? v).trim();
    if (!t) return;
    setV('');
    setMsgs((m) => [...m, { role: 'me', text: t }]);
    setTyping(true);
    setTimeout(() => {
      const r = chat(useStore.getState(), t);
      setMsgs((m) => [...m, { role: 'ai', ...r }]);
      setTyping(false);
    }, 650 + Math.random() * 500);
  }
  function act(a, i) {
    const s = useStore.getState();
    if (a.type === 'focus') (setDrawer(null), s.pickFocus(a.payload));
    if (a.type === 'addTask') (setDrawer(null), s.openModal('task'));
    if (a.type === 'rescue') s.openModal('rescue');
    if (a.type === 'createPlan') s.createStudyPlan(a.payload, a.payload.subject);
    if (a.type === 'createGoal') {
      s.addGoal({ title: a.payload.title, months: a.payload.months, breakdown: a.payload.breakdown });
      s.toast('تم إنشاء الهدف مع خطته', { icon: 'sparkles' });
    }
    if (a.type === 'reorder') (s.applyTimes(a.payload), s.toast('تم اعتماد الترتيب الجديد', { icon: 'check' }));
    if (a.type === 'addParsed') (s.addTasks(a.payload), s.toast('تمت الإضافة إلى جدولك', { icon: 'check' }));
    setMsgs((m) => m.map((x, j) => (j === i ? { ...x, used: true } : x)));
  }
  const prompts = ['رتب يومي', 'وش أسوي الآن؟', 'وش أقدر أنجز خلال ساعة؟', 'أنا متأخر اليوم، ساعدني', 'عندي اختبار بعد 5 أيام وأحتاج أذاكر 4 فصول', 'قسم لي هدف تعلم الإنجليزية خلال 6 أشهر'];
  return (
    <Drawer title="اسأل هّمة" icon={<Sparkles size={18} />} onClose={() => setDrawer(null)} actions={<span className="badge purple"><Glyph name={PERSONAS[persona]?.icon} size={12} /> {PERSONAS[persona]?.label}</span>}>
      <div className="chat">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.text}
            {m.tasks?.length > 0 && (
              <div className="col mt-s" style={{ gap: 6 }}>
                {m.tasks.map((t) => (
                  <div key={t.id} className="row small" style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(var(--primary-rgb),.1)' }}>
                    <Glyph name={t.icon} size={15} />
                    <span className="grow bold">{t.title}</span>
                    <span className="num tiny">{t.newTime || t.time || ''}</span>
                  </div>
                ))}
              </div>
            )}
            {m.plan && (
              <div className="col mt-s" style={{ gap: 6 }}>
                {m.plan.map((p) => (
                  <div key={p.day} className="row small" style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(var(--primary-rgb),.1)' }}>
                    <span className="bold purple">اليوم {p.day}</span>
                    <span className="grow">{p.title}</span>
                  </div>
                ))}
              </div>
            )}
            {m.goal && (
              <div className="col mt-s" style={{ gap: 4 }}>
                {m.goal.breakdown.months.map((mo) => (
                  <div key={mo.title} className="small">• {mo.title}</div>
                ))}
                <div className="tiny muted mt-s">مهام يومية: {m.goal.breakdown.daily.join('، ')}</div>
              </div>
            )}
            {m.parsed && (
              <div className="col mt-s" style={{ gap: 4 }}>
                {m.parsed.map((p, k) => (
                  <div key={k} className="small">
                    <Glyph name={p.icon} size={14} /> <span className="num">{p.time || '—'}</span> — {p.title} — <span className="num">{p.duration}</span> دقيقة
                  </div>
                ))}
              </div>
            )}
            {m.actions?.length > 0 && (
              <div className="row wrap mt-s">
                {m.actions.map((a) => (
                  <button key={a.label} className="btn btn-xs btn-primary" disabled={m.used} onClick={() => act(a, i)}>
                    {m.used ? 'تم' : a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="msg ai">
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        <div ref={end} />
      </div>
      {msgs.length < 3 && (
        <div className="chips mt">
          {prompts.map((p) => (
            <button key={p} className="chip" onClick={() => send(p)}>
              {p}
            </button>
          ))}
        </div>
      )}
      <form
        className="quick mt"
        style={{ position: 'sticky', bottom: 0, maxWidth: 'none' }}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Bot size={18} className="spark" />
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="اكتب سؤالك…" aria-label="اكتب سؤالك للمساعد" autoFocus />
        <button type="submit" className="icon-btn sm primary" aria-label="إرسال" disabled={!v.trim()}>
          <Send style={{ transform: 'scaleX(-1)' }} />
        </button>
      </form>
      <p className="tiny dim mt-s" style={{ textAlign: 'center' }}>
        المساعد يعمل بمنطق ذكي محلي على جهازك — جاهز للربط بنموذج ذكاء اصطناعي لاحقًا.
      </p>
    </Drawer>
  );
}

export function ModalRoot() {
  const modal = useStore((s) => s.modal);
  const drawer = useStore((s) => s.drawer);
  return (
    <>
      {drawer === 'command' && <CommandMenu />}
      {drawer === 'notifications' && <NotificationsDrawer />}
      {drawer === 'assistant' && <AssistantDrawer />}
      {modal?.name === 'task' && <TaskModal key={modal.payload?.task?.id || 'new'} task={modal.payload?.task} preset={modal.payload?.preset} />}
      {modal?.name === 'voice' && <VoiceModal />}
      {modal?.name === 'created' && <CreatedModal ids={modal.payload.ids} />}
      {modal?.name === 'image' && <ImageModal />}
      {modal?.name === 'reschedule' && <RescheduleModal id={modal.payload.id} />}
      {modal?.name === 'rescue' && <RescueModal />}
      {modal?.name === 'oneHour' && <OneHourModal />}
      {modal?.name === 'whatNow' && <WhatNowModal />}
      {modal?.name === 'interactive' && <InteractiveModal />}
      {modal?.name === 'shortcuts' && <ShortcutsModal />}
      {modal?.name === 'focusStart' && <FocusStartModal taskId={modal.payload.taskId} />}
      {modal?.name === 'confirm' && <ConfirmModal {...modal.payload} />}
      {modal?.name === 'custom' && modal.payload.render()}
    </>
  );
}

export { Modal };
