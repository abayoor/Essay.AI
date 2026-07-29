type LandingVisualKind = 'hero' | 'recording' | 'community' | 'group' | 'challenge' | 'safety' | 'marketplace' | 'strava';

export function LandingVisual({ kind }: { kind: LandingVisualKind }) {
  if (kind === 'hero') {
    return <div className="landing-visual visual-hero" aria-hidden="true"><div className="visual-map-grid" /><svg viewBox="0 0 620 360" preserveAspectRatio="none"><path className="visual-route-shadow" d="M34 276C105 279 111 116 196 149s87 157 164 81c53-53 24-170 179-159 31 3 54 25 55 61" /><path className="visual-route" d="M34 276C105 279 111 116 196 149s87 157 164 81c53-53 24-170 179-159 31 3 54 25 55 61" /><circle className="visual-start" cx="34" cy="276" r="10" /><circle className="visual-finish" cx="594" cy="132" r="10" /></svg><div className="hero-map-stat"><span>Сегодня</span><strong>24.8 км</strong><small>+312 м · Алматы</small></div></div>;
  }
  if (kind === 'recording') {
    return <div className="landing-visual visual-recording" aria-hidden="true"><div className="visual-live-dot" /><span className="visual-live-label">LIVE GPS</span><strong>18.4 <small>км</small></strong><div className="visual-mini-map"><i /><i /><i /><b /></div><dl><div><dt>Скорость</dt><dd>23.6 км/ч</dd></div><div><dt>Набор</dt><dd>186 м</dd></div></dl></div>;
  }
  if (kind === 'community') {
    return <div className="landing-visual visual-community" aria-hidden="true"><div className="visual-post-head"><i>А</i><span><b>Алина едет в горы</b><small>12 мин назад</small></span></div><div className="visual-post-photo"><svg viewBox="0 0 300 120"><path d="M0 110 66 43l36 46 57-76 47 76 42-36 52 57Z" /><circle cx="210" cy="30" r="10" /></svg></div><div className="visual-social-actions"><span>♡ 24</span><span>◌ 6</span><span>↗</span></div></div>;
  }
  if (kind === 'group') {
    return <div className="landing-visual visual-group" aria-hidden="true"><div className="visual-map-grid" /><svg viewBox="0 0 340 220" preserveAspectRatio="none"><path className="visual-route" d="M24 172c54-45 48-112 117-88 58 20 50 74 111 50 29-11 34-32 61-64" /></svg><span className="rider-dot rider-one">Н</span><span className="rider-dot rider-two">Д</span><span className="rider-dot rider-three">М</span><p>4 райдера рядом</p></div>;
  }
  if (kind === 'challenge') {
    return <div className="landing-visual visual-challenge" aria-hidden="true"><p>Неделя 31</p><strong>Гонка километров</strong><ol><li><span>1</span><b>Алия</b><i style={{ width: '90%' }} /><em>146 км</em></li><li><span>2</span><b>Ты</b><i style={{ width: '74%' }} /><em>121 км</em></li><li><span>3</span><b>Никита</b><i style={{ width: '56%' }} /><em>92 км</em></li></ol></div>;
  }
  if (kind === 'safety') {
    return <div className="landing-visual visual-safety" aria-hidden="true"><div className="visual-map-grid" /><span className="hazard-pin pin-one">!</span><span className="hazard-pin pin-two">!</span><section><p>Сегмент: Медеу</p><ol><li><span>1</span><b>07:42</b></li><li className="leader-row"><span>2</span><b>Ты · 08:11</b></li><li><span>3</span><b>08:26</b></li></ol></section></div>;
  }
  if (kind === 'marketplace') {
    return <div className="landing-visual visual-marketplace" aria-hidden="true"><article><div className="visual-bike"><i /><i /><b /></div><p>Giant Contend AR</p><strong>380 000 ₸</strong></article><article><div className="visual-wheel">◌</div><p>Колёса 700c</p><strong>95 000 ₸</strong></article></div>;
  }
  return <div className="landing-visual visual-strava" aria-hidden="true"><div className="strava-source">S</div><div className="visual-transfer">→</div><div className="slipstream-target">↗</div><p>238 поездок<br /><span>импортировано</span></p></div>;
}
