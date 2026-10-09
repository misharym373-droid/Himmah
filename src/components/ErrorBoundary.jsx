// شبكة أمان: أي خطأ غير متوقع في الواجهة يعرض بطاقة استرجاع بدل صفحة فارغة (البيانات محفوظة)
import { Component } from 'react';
import { tr } from '../i18n/index.js';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[himmah:crash]', error, info?.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const home = () => {
      window.location.hash = '#/home';
      this.setState({ error: null });
    };
    return (
      <div className="onb">
        <div className="card onb-card" style={{ textAlign: 'center' }}>
          <h2>{tr('صار خطأ غير متوقع')}</h2>
          <p className="muted mt-s">{tr('بياناتك محفوظة. ارجع للرئيسية أو أعد تحميل الصفحة.')}</p>
          <div className="row mt" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={home}>
              {tr('الرجوع للرئيسية')}
            </button>
            <button className="btn" onClick={() => window.location.reload()}>
              {tr('إعادة تحميل الصفحة')}
            </button>
          </div>
          <p className="tiny dim mt">{String(this.state.error?.message || '').slice(0, 160)}</p>
        </div>
      </div>
    );
  }
}
