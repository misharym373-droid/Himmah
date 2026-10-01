import { useState } from 'react';
import { Users, Plus, UserPlus, Trash2, X, Info } from 'lucide-react';
import { useStore } from '../store.js';
import { Modal, Bar, Empty, Avatar, useConfirm } from '../components/ui.jsx';
import { Glyph } from '../components/Glyph.jsx';

const STATUS = {
  todo: { label: 'لم تبدأ', color: '#94A3B8' },
  doing: { label: 'قيد التنفيذ', color: '#FBBF24' },
  done: { label: 'مكتملة', color: '#34D399' },
};

export default function Shared() {
  const projects = useStore((s) => s.projects);
  const [adding, setAdding] = useState(false);
  const [active, setActive] = useState(projects[0]?.id);
  const project = projects.find((p) => p.id === active) || projects[0];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="ico">
              <Users />
            </span>
            المهام المشتركة
          </h1>
          <p>نظّم مشاريع الفريق ووزع المهام على الأعضاء</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus /> مشروع جديد
        </button>
      </div>
      {!projects.length ? (
        <div className="card">
          <Empty icon={<Users />} title="لا توجد مشاريع مشتركة" text="أنشئ مشروعًا وأضف أعضاء فريقك." action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus /> مشروع جديد</button>} />
        </div>
      ) : (
        <>
          <div className="tabs mb">
            {projects.map((p) => (
              <button key={p.id} className={`tab ${project?.id === p.id ? 'on' : ''}`} onClick={() => setActive(p.id)}>
                <Glyph name={p.icon} size={15} /> {p.name}
              </button>
            ))}
          </div>
          {project && <Project p={project} key={project.id} />}
        </>
      )}
      <p className="tiny dim mt row">
        <Info size={14} /> المشاريع محفوظة على جهازك حاليًا. المزامنة الفعلية مع أعضاء الفريق تحتاج ربط هّمة بخادم (البنية جاهزة لذلك).
      </p>
      {adding && <ProjectModal onClose={() => setAdding(false)} onCreated={(id) => setActive(id)} />}
    </>
  );
}

function Project({ p }) {
  const s = useStore.getState();
  const confirm = useConfirm();
  const [member, setMember] = useState('');
  const [task, setTask] = useState('');
  const [assignee, setAssignee] = useState('me');
  const done = p.tasks.filter((t) => t.status === 'done').length;
  const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
  const mem = (id) => p.members.find((m) => m.id === id) || p.members[0];
  return (
    <div className="dash" style={{ marginTop: 0 }}>
      <div className="card span-4 r-6 reveal">
        <div className="row between">
          <h3>
            <Glyph name={p.icon} size={20} className="purple" /> {p.name}
          </h3>
          <button className="icon-btn sm plain" aria-label="حذف المشروع" onClick={() => confirm({ title: 'حذف المشروع', body: `حذف "${p.name}" وكل مهامه؟`, danger: true, confirmLabel: 'حذف', onConfirm: () => s.deleteProject(p.id) })}>
            <Trash2 />
          </button>
        </div>
        <div className="row between mt small">
          <span className="muted">التقدم</span>
          <span className="num bold purple">{pct}%</span>
        </div>
        <Bar value={pct} className="mt-s" />
        <div className="bold mt" style={{ marginTop: 20 }}>الأعضاء</div>
        <div className="col mt-s">
          {p.members.map((m) => {
            const mine = p.tasks.filter((t) => t.assignee === m.id);
            return (
              <div key={m.id} className="row">
                <span className="avatar sm" style={{ background: m.color }}>{m.name.charAt(0)}</span>
                <span className="grow bold small">
                  {m.name} {m.id === 'me' && <span className="tiny muted">(أنت)</span>}
                </span>
                <span className="tiny muted num">
                  {mine.filter((t) => t.status === 'done').length}/{mine.length}
                </span>
                {m.id !== 'me' && (
                  <button className="icon-btn sm plain" aria-label={`إزالة ${m.name}`} onClick={() => s.removeMember(p.id, m.id)}>
                    <X />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <form className="row mt" onSubmit={(e) => (e.preventDefault(), member.trim() && (s.addMember(p.id, member.trim()), setMember('')))}>
          <input className="input" value={member} onChange={(e) => setMember(e.target.value)} placeholder="اسم العضو" aria-label="اسم العضو" />
          <button className="icon-btn" aria-label="إضافة عضو">
            <UserPlus />
          </button>
        </form>
      </div>
      <div className="span-8 r-6 col" style={{ gap: 16 }}>
        <form className="card tight row wrap" onSubmit={(e) => (e.preventDefault(), task.trim() && (s.addProjectTask(p.id, task.trim(), assignee), setTask('')))}>
          <input className="input grow" style={{ minWidth: 180 }} value={task} onChange={(e) => setTask(e.target.value)} placeholder="مهمة جديدة للمشروع…" aria-label="مهمة جديدة" />
          <select className="select" style={{ width: 'auto', minWidth: 130 }} value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="إسناد إلى">
            {p.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button className="btn btn-primary">
            <Plus /> إضافة
          </button>
        </form>
        <div className="grid g3">
          {Object.entries(STATUS).map(([k, st]) => {
            const list = p.tasks.filter((t) => t.status === k);
            return (
              <div key={k} className="card tight reveal">
                <div className="row between mb">
                  <span className="bold small row">
                    <i style={{ width: 9, height: 9, borderRadius: 5, background: st.color, boxShadow: `0 0 8px ${st.color}` }} /> {st.label}
                  </span>
                  <span className="badge num">{list.length}</span>
                </div>
                <div className="col" style={{ gap: 8 }}>
                  {list.map((t) => (
                    <div key={t.id} className="wk-task" style={{ cursor: 'default', borderInlineStart: `3px solid ${st.color}` }}>
                      <div className="bold" style={{ textDecoration: k === 'done' ? 'line-through' : '' }}>{t.title}</div>
                      <div className="row mt-s" style={{ gap: 6 }}>
                        <span className="avatar sm" style={{ background: mem(t.assignee).color, width: 22, height: 22, fontSize: '.65rem' }}>{mem(t.assignee).name.charAt(0)}</span>
                        <select className="select" style={{ height: 30, fontSize: '.75rem', padding: '0 8px', flex: 1 }} value={t.assignee} onChange={(e) => s.updateProjectTask(p.id, t.id, { assignee: e.target.value })} aria-label="المسؤول">
                          {p.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="row mt-s" style={{ gap: 4 }}>
                        {Object.entries(STATUS)
                          .filter(([k2]) => k2 !== k)
                          .map(([k2, s2]) => (
                            <button key={k2} className="btn btn-xs" style={{ flex: 1, fontSize: '.7rem', padding: '0 6px' }} onClick={() => s.updateProjectTask(p.id, t.id, { status: k2 })}>
                              {s2.label}
                            </button>
                          ))}
                        <button className="icon-btn sm plain" style={{ width: 28, height: 28 }} aria-label="حذف" onClick={() => s.deleteProjectTask(p.id, t.id)}>
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!list.length && <p className="tiny dim" style={{ textAlign: 'center', padding: 10 }}>لا توجد مهام</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectModal({ onClose, onCreated }) {
  const add = useStore((s) => s.addProject);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('folder');
  function save() {
    if (!name.trim()) return;
    add(name.trim(), icon);
    onCreated(useStore.getState().projects.at(-1).id);
    onClose();
  }
  return (
    <Modal
      title="مشروع جديد"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!name.trim()}>
            إنشاء
          </button>
        </>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <label className="field">
          <span>اسم المشروع</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: مشروع الجامعة" autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        <div className="chips">
          {['folder', 'study', 'work', 'home', 'rocket', 'party', 'laptop', 'chart'].map((i) => (
            <button key={i} className={`chip icon-chip ${icon === i ? 'on' : ''}`} onClick={() => setIcon(i)} aria-label={i}>
              <Glyph name={i} size={17} />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export { Avatar };
