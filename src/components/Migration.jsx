// اقتراح نقل بيانات الحساب المحلي القديم إلى حساب Supabase الحالي
import { useState } from 'react';
import { DatabaseBackup, X, Loader2 } from 'lucide-react';
import { useStore } from '../store.js';
import { findLegacyAccounts, mergeLegacy, markMigrated } from '../lib/migrate.js';
import { tr, trf } from '../i18n/index.js';

const LATER = 'himmah:migrate-later';

export function MigrationBanner() {
  const mode = useStore((s) => s.sync.mode);
  const [legacy, setLegacy] = useState(() => (mode === 'remote' ? findLegacyAccounts() : []));
  const [later, setLater] = useState(() => {
    try {
      return sessionStorage.getItem(LATER) === '1';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);
  if (mode !== 'remote' || !legacy.length || later) return null;
  const acc = legacy[0];
  const count = acc.data.tasks.filter((t) => !t.template).length;

  async function run() {
    setBusy(true);
    const st = useStore.getState();
    const { patch, counts, total } = mergeLegacy(acc.data, st);
    useStore.setState(patch);
    const ok = await st.waitForSync();
    setBusy(false);
    if (!ok) {
      st.toast(tr('بدأ النقل، لكن لم يكتمل الرفع بعد بسبب الاتصال. سنكمل تلقائيًا عند عودته.'), { icon: 'clock', duration: 6000 });
      return;
    }
    // لا نحذف البيانات المحلية — فقط نضع علامة أنها نُقلت
    markMigrated(acc.id);
    setLegacy((l) => l.slice(1));
    const parts = [
      counts.tasks && trf('{n} مهمة', { n: counts.tasks }),
      counts.goals && trf('{n} أهداف', { n: counts.goals }),
      counts.habits && trf('{n} عادات', { n: counts.habits }),
      counts.challenges && trf('{n} تحديات', { n: counts.challenges }),
      counts.rewards && trf('{n} مكافآت', { n: counts.rewards }),
      counts.projects && trf('{n} مشاريع', { n: counts.projects }),
    ].filter(Boolean);
    st.toast(total ? trf('تم نقل بياناتك: {list}', { list: parts.join(tr('، ')) }) : tr('بياناتك القديمة موجودة مسبقًا في حسابك — لا يوجد شيء جديد للنقل'), { icon: 'check', duration: 6000 });
  }
  function dismiss() {
    try {
      sessionStorage.setItem(LATER, '1');
    } catch (e) {
      // ميزة ثانوية غير متاحة في هذا المتصفح — لا توقف التطبيق
      console.warn('[himmah:migration-later]', e?.message || e);
    }
    setLater(true);
  }
  return (
    <div className="notice warn mb reveal" role="region" aria-label={tr('استيراد البيانات القديمة')} style={{ marginTop: 12 }}>
      <DatabaseBackup size={18} aria-hidden />
      <span className="grow small">
        {tr('وجدنا بيانات قديمة محفوظة على هذا الجهاز')}{acc.name ? ' ' + trf('(حساب {name})', { name: acc.name }) : ''} — <b className="num">{count}</b> {tr('مهمة وغيرها. تريد نقلها إلى حسابك؟')}
      </span>
      <button className="btn btn-xs btn-primary" onClick={run} disabled={busy}>
        {busy ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} /> : null} {tr('استيراد بياناتك القديمة')}
      </button>
      <button className="icon-btn sm plain" aria-label={tr('لاحقًا')} title={tr('لاحقًا')} onClick={dismiss} disabled={busy}>
        <X />
      </button>
    </div>
  );
}
