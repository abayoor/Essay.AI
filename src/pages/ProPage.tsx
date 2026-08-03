import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity,
  Bike,
  BrainCircuit,
  Check,
  ChevronRight,
  CreditCard,
  Droplets,
  Gauge,
  HeartPulse,
  LockKeyhole,
  Route,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Wrench,
} from 'lucide-react';
import { Link } from 'wouter';
import { PageShell } from '../components/PageShell';
import { ProAnalyzer } from '../components/ProAnalyzer';
import { ProToolkit } from '../components/ProToolkit';
import { ProWeeklyDigest } from '../components/ProWeeklyDigest';
import { useSession } from '../lib/auth';
import { useLocaleText } from '../lib/localized';
import { usePreferences } from '../lib/preferences';
import {
  billingConfiguration,
  createBillingPortal,
  createProCheckout,
  hasActivePro,
  loadCurrentSubscription,
  redeemProPromo,
  type BillingSubscription,
} from '../lib/subscriptions';
import '../styles/pro.css';

type ProFeature = {
  icon: ReactNode;
  title: string;
  description: string;
  detail: string;
};

type BillingAction = 'checkout' | 'portal' | 'promo' | null;

function openBillingUrl(url: string): void {
  window.location.assign(url);
}

export function ProPage() {
  const { session } = useSession();
  const text = useLocaleText();
  const { locale } = usePreferences();
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [billingAction, setBillingAction] = useState<BillingAction>(null);
  const [message, setMessage] = useState('');
  const [promoCode, setPromoCode] = useState('');

  const features = useMemo<ProFeature[]>(() => [
    {
      icon: <BrainCircuit size={22} />,
      title: text('Персональный профиль райдера', 'Райдердің жеке профилі', 'Personal rider profile'),
      description: text(
        'ИИ учитывает введённые рост, вес, длину ноги, опыт, цель и доступное время.',
        'AI енгізілген бойды, салмақты, аяқ ұзындығын, тәжірибені, мақсатты және бос уақытты ескереді.',
        'AI considers the height, weight, inseam, experience, goal and available time you enter.',
      ),
      detail: text('Только данные, которые ты разрешишь использовать', 'Тек пайдалануға рұқсат берген деректер', 'Only data you choose to share'),
    },
    {
      icon: <Bike size={22} />,
      title: text('Велосипед, размер и посадка', 'Велосипед, өлшем және отырыс', 'Bike, size and fit'),
      description: text(
        'Подбор типа велосипеда, ориентировочного размера рамы, геометрии, колёс, трансмиссии и тормозов.',
        'Велосипед түрін, рама өлшемін, геометрияны, дөңгелекті, трансмиссия мен тежегішті таңдау.',
        'Bike type, approximate frame size, geometry, wheels, drivetrain and brakes.',
      ),
      detail: text('Чек-лист покупки под бюджет и стиль катания', 'Бюджет пен міну стиліне сай сатып алу тізімі', 'A buying checklist for your budget and riding style'),
    },
    {
      icon: <Activity size={22} />,
      title: text('Тренировки и готовность', 'Жаттығу және дайындық', 'Training and readiness'),
      description: text(
        'Недельная структура тренировок, безопасная интенсивность и восстановление под твой опыт и свободные часы.',
        'Тәжірибең мен бос уақытыңа сай апталық жаттығу құрылымы, қауіпсіз қарқын және қалпына келу.',
        'A weekly training structure, safe intensity and recovery matched to your experience and available hours.',
      ),
      detail: text('Недельный отчёт с понятными причинами рекомендаций', 'Ұсыныстардың себептері бар апталық есеп', 'A weekly report explaining every recommendation'),
    },
    {
      icon: <Route size={22} />,
      title: text('Умные маршруты и безопасность', 'Ақылды бағыттар және қауіпсіздік', 'Smart routes and safety'),
      description: text(
        'ИИ подсказывает подходящий рельеф и покрытие, приоритет маршрута и конкретные проверки безопасности.',
        'AI қолайлы жер бедері мен жол жамылғысын, бағыт басымдығын және қауіпсіздік тексерулерін ұсынады.',
        'AI suggests suitable terrain and surfaces, a routing priority and concrete safety checks.',
      ),
      detail: text('Приоритет комфорта, скорости или спокойных улиц', 'Жайлылыққа, жылдамдыққа немесе тыныш көшелерге басымдық', 'Prioritize comfort, speed or quiet streets'),
    },
    {
      icon: <Wrench size={22} />,
      title: text('Персональное обслуживание', 'Жеке техникалық қызмет', 'Personal maintenance'),
      description: text(
        'Персональный чек-лист цепи, колодок, шин, трансмиссии и важных проверок перед поездкой.',
        'Тізбек, қалып, шина, трансмиссия және сапар алдындағы маңызды тексерулерге арналған жеке тізім.',
        'A personal checklist for the chain, pads, tires, drivetrain and important pre-ride checks.',
      ),
      detail: text('Понятно, что проверить сейчас и после поездки', 'Қазір және сапардан кейін не тексеру керегі түсінікті', 'Know what to check now and after a ride'),
    },
    {
      icon: <HeartPulse size={22} />,
      title: text('Восстановление и питание', 'Қалпына келу және тамақтану', 'Recovery and nutrition'),
      description: text(
        'Практичные подсказки по воде, еде до и после поездки, отдыху и лёгким дням с учётом длительности нагрузки.',
        'Су, сапар алдындағы және кейінгі ас, демалыс және жеңіл күндер туралы жүктеме ұзақтығына сай кеңестер.',
        'Practical hydration, pre/post-ride food, rest and easy-day guidance based on ride duration.',
      ),
      detail: text('Спортивные рекомендации, не медицинская диагностика', 'Спорттық кеңес, медициналық диагноз емес', 'Training guidance, not medical diagnosis'),
    },
    {
      icon: <Droplets size={22} />,
      title: text('План воды и питания', 'Су мен тамақ жоспары', 'Hydration and fuel planner'),
      description: text(
        'Введи длительность, погоду и интенсивность — получишь воду, количество фляг, углеводы и окно восстановления.',
        'Ұзақтықты, ауа райын және қарқынды енгіз — су, бөтелке саны, көмірсу және қалпына келу уақытын аласың.',
        'Enter duration, weather and intensity to get water, bottle count, carbohydrates and a recovery window.',
      ),
      detail: text('Мгновенный расчёт перед каждой поездкой', 'Әр сапар алдындағы жедел есеп', 'An instant calculation before every ride'),
    },
    {
      icon: <Gauge size={22} />,
      title: text('Калькулятор давления', 'Қысым калькуляторы', 'Tire pressure calculator'),
      description: text(
        'Стартовое давление отдельно для переднего и заднего колеса с учётом веса, ширины шины, покрытия и бескамерной установки.',
        'Салмақты, шина енін, жолды және камерасыз орнатуды ескеретін алдыңғы және артқы қысым.',
        'Starting front and rear pressure based on weight, tire width, surface and tubeless setup.',
      ),
      detail: text('Bar и PSI с напоминанием о пределах шины', 'Bar және PSI, шина шегі туралы ескертумен', 'Bar and PSI with tire-limit reminders'),
    },
    {
      icon: <Activity size={22} />,
      title: text('Готовность к поездке', 'Сапарға дайындық', 'Ride readiness'),
      description: text(
        'Быстрая оценка дня по сну, усталости и планируемой нагрузке: ехать по плану, снизить темп или восстановиться.',
        'Ұйқы, шаршау және жоспарланған жүктеме бойынша күнді бағалау: жоспармен жүру, қарқынды азайту немесе демалу.',
        'A quick daily check using sleep, fatigue and planned load: ride as planned, ease off or recover.',
      ),
      detail: text('Работает без ожидания ответа ИИ', 'AI жауабын күтпей жұмыс істейді', 'Works without waiting for an AI response'),
    },
  ], [text]);

  const active = hasActivePro(subscription);
  const needsBillingAttention = subscription?.status === 'past_due'
    || subscription?.status === 'paused'
    || subscription?.status === 'unpaid';

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setSubscriptionLoading(true);
    const checkoutSucceeded = new URLSearchParams(window.location.search).get('checkout') === 'success';
    const attempts = checkoutSucceeded ? 7 : 1;
    void (async () => {
      let failed = false;
      let confirmed = false;
      for (let attempt = 0; attempt < attempts && !cancelled; attempt += 1) {
        try {
          const nextSubscription = await loadCurrentSubscription();
          failed = false;
          if (!cancelled) setSubscription(nextSubscription);
          if (hasActivePro(nextSubscription)) {
            confirmed = true;
            break;
          }
        } catch {
          failed = true;
        }
        if (attempt < attempts - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, Math.min(1_500 * (attempt + 1), 5_000)));
        }
      }
      if (!cancelled && failed) setMessage(text(
        'Не удалось проверить статус подписки. Обнови страницу чуть позже.',
        'Жазылым күйін тексеру мүмкін болмады. Бетті кейінірек жаңарт.',
        'We could not check your subscription. Refresh the page a little later.',
      ));
      else if (!cancelled && checkoutSucceeded && !confirmed) setMessage(text(
        'Платёж ещё обрабатывается. Не оплачивай повторно: обнови страницу через несколько минут.',
        'Төлем әлі өңделіп жатыр. Қайта төлеме: бірнеше минуттан кейін бетті жаңарт.',
        'Payment is still processing. Do not pay again; refresh the page in a few minutes.',
      ));
      if (!cancelled) setSubscriptionLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session, text]);

  useEffect(() => {
    const checkoutResult = new URLSearchParams(window.location.search).get('checkout');
    if (checkoutResult === 'success') {
      setMessage(text(
        'Платёж получен. Проверяем подтверждение платёжного сервиса — Pro включится только после ответа сервера.',
        'Төлем алынды. Төлем сервисінің растауын тексеріп жатырмыз — Pro сервер жауабынан кейін ғана қосылады.',
        'Payment received. We are checking the payment provider; Pro activates only after the server confirms it.',
      ));
    } else if (checkoutResult === 'cancelled') {
      setMessage(text(
        'Оплата отменена, деньги не списаны.',
        'Төлем тоқтатылды, ақша алынбады.',
        'Checkout was cancelled and no payment was taken.',
      ));
    }
  }, [text]);

  async function beginCheckout(): Promise<void> {
    setBillingAction('checkout');
    setMessage('');
    try {
      openBillingUrl(await createProCheckout(locale));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text(
        'Не удалось открыть оплату.',
        'Төлемді ашу мүмкін болмады.',
        'Could not open checkout.',
      ));
      setBillingAction(null);
    }
  }

  async function openPortal(): Promise<void> {
    setBillingAction('portal');
    setMessage('');
    try {
      openBillingUrl(await createBillingPortal());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text(
        'Не удалось открыть управление подпиской.',
        'Жазылымды басқаруды ашу мүмкін болмады.',
        'Could not open subscription management.',
      ));
      setBillingAction(null);
    }
  }

  async function redeemPromo(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBillingAction('promo');
    setMessage('');
    try {
      const nextSubscription = await redeemProPromo(promoCode);
      setSubscription(nextSubscription);
      setPromoCode('');
      setMessage(text('Промокод принят — бесплатный Pro активирован.', 'Промокод қабылданды — тегін Pro белсендірілді.', 'Promo accepted — free Pro is active.'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text('Не удалось применить промокод.', 'Промокодты қолдану мүмкін болмады.', 'Could not apply the promo code.'));
    } finally {
      setBillingAction(null);
    }
  }

  const renewalDate = subscription?.currentPeriodEnd
    ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(subscription.currentPeriodEnd))
    : null;

  return <PageShell>
    <main className="pro-page">
      <section className="pro-hero">
        <div className="pro-hero-copy">
          <p className="pro-eyebrow"><Sparkles size={14} /> Slipstream Pro</p>
          <h1>{text('Езжай умнее.\nКаждый день.', 'Күн сайын\nақылдырақ жүр.', 'Ride smarter.\nEvery day.')}</h1>
          <p>{text(
            'Один персональный велоассистент для выбора велосипеда, тренировок, маршрутов, обслуживания и восстановления.',
            'Велосипед таңдау, жаттығу, бағыт, қызмет көрсету және қалпына келуге арналған бір жеке велокөмекші.',
            'One personal cycling assistant for bike choice, training, routes, maintenance and recovery.',
          )}</p>
          <div className="pro-hero-points" aria-label={text('Главные преимущества', 'Негізгі артықшылықтар', 'Key benefits')}>
            <span><Check size={15} /> {text('6 инструментов Ride Lab', '6 Ride Lab құралы', '6 Ride Lab tools')}</span>
            <span><Check size={15} /> {text('30 полных ИИ-разборов в месяц', 'Айына 30 толық AI талдауы', '30 full AI analyses each month')}</span>
            <span><Check size={15} /> {text('Отмена в любой момент', 'Кез келген уақытта тоқтату', 'Cancel anytime')}</span>
          </div>
        </div>

        <aside className="pro-price-card" id="pro-price" aria-label={text('Тариф Slipstream Pro', 'Slipstream Pro тарифі', 'Slipstream Pro plan')}>
          <div className="pro-price-card-top">
            <span>{text('Ежемесячно', 'Ай сайын', 'Monthly')}</span>
            <strong>$5<small> / {text('месяц', 'ай', 'month')}</small></strong>
            <p>{text(
              'Базовая цена — $5 в месяц без годовой привязки. Местный налог, если он нужен, будет показан до оплаты.',
              'Негізгі баға — жылдық міндеттемесіз айына $5. Қажет болса, жергілікті салық төлемге дейін көрсетіледі.',
              'The base price is $5 monthly with no annual commitment. Any required local tax is shown before payment.',
            )}</p>
          </div>

          {active ? <div className="pro-current-plan" role="status">
            <ShieldCheck size={20} />
            <div>
              <strong>{text('Pro активен', 'Pro белсенді', 'Pro is active')}</strong>
              <span>{subscription?.cancelAtPeriodEnd
                ? text(`Доступ до ${renewalDate ?? 'конца периода'}`, `${renewalDate ?? 'кезең соңына'} дейін қолжетімді`, `Access until ${renewalDate ?? 'the period ends'}`)
                : renewalDate
                  ? text(`Следующее списание ${renewalDate}`, `Келесі төлем ${renewalDate}`, `Next charge ${renewalDate}`)
                  : text('Подписка подтверждена', 'Жазылым расталды', 'Subscription confirmed')}</span>
            </div>
          </div> : needsBillingAttention ? <div className="pro-current-plan" role="alert">
            <CreditCard size={20} />
            <div><strong>{text('Нужно обновить оплату', 'Төлемді жаңарту керек', 'Payment needs attention')}</strong><span>{text('Pro временно приостановлен — открой управление подпиской.', 'Pro уақытша тоқтатылды — жазылымды басқаруды аш.', 'Pro is paused until you update the subscription.')}</span></div>
          </div> : null}

          {active && subscription?.source === 'promotion' ? <div className="pro-promo-active"><Sparkles size={18} />{text('Бесплатный Pro активирован', 'Тегін Pro белсендірілді', 'Free Pro activated')}</div> : active || needsBillingAttention ? <button className="pro-primary-button" type="button" disabled={!billingConfiguration.checkoutEnabled || billingAction !== null} onClick={() => void openPortal()}>
            {billingAction === 'portal'
              ? text('Открываем…', 'Ашып жатырмыз…', 'Opening…')
              : billingConfiguration.nativePlatform
                ? text('Управление через магазин', 'Дүкен арқылы басқару', 'Manage in the store')
                : needsBillingAttention
                  ? text('Исправить оплату', 'Төлемді түзету', 'Fix payment')
                  : text('Управлять подпиской', 'Жазылымды басқару', 'Manage subscription')}
            <ChevronRight size={18} />
          </button> : session ? <button
            className="pro-primary-button"
            type="button"
            disabled={!billingConfiguration.checkoutEnabled || billingAction !== null || subscriptionLoading}
            onClick={() => void beginCheckout()}
          >
            {billingAction === 'checkout'
              ? text('Переходим к оплате…', 'Төлемге өтіп жатырмыз…', 'Opening checkout…')
              : billingConfiguration.checkoutEnabled
                ? text('Подключить Pro за $5', 'Pro-ны $5-ға қосу', 'Get Pro for $5')
                : billingConfiguration.nativePlatform
                  ? text('Оплата через Google Play', 'Google Play арқылы төлеу', 'Pay with Google Play')
                  : text('Оплата скоро появится', 'Төлем жақында ашылады', 'Checkout coming soon')}
            <ChevronRight size={18} />
          </button> : <Link className="pro-primary-button" href="/auth/sign-in">
            {text('Войти и подключить Pro', 'Кіру және Pro қосу', 'Sign in to get Pro')} <ChevronRight size={18} />
          </Link>}

          {session && !active && <form className="pro-promo-form" onSubmit={(event) => void redeemPromo(event)}>
            <label htmlFor="pro-promo-code">{text('Есть промокод?', 'Промокод бар ма?', 'Have a promo code?')}</label>
            <div><input id="pro-promo-code" value={promoCode} onChange={(event) => setPromoCode(event.target.value)} placeholder={text('Введите код', 'Кодты енгізіңіз', 'Enter code')} maxLength={40} autoComplete="off" /><button type="submit" disabled={billingAction !== null || !promoCode.trim()}>{billingAction === 'promo' ? text('Проверяем…', 'Тексерілуде…', 'Checking…') : text('Применить', 'Қолдану', 'Apply')}</button></div>
          </form>}

          <ul className="pro-trust-list">
            <li><LockKeyhole size={15} /><span><strong>{text('Безопасная оплата', 'Қауіпсіз төлем', 'Secure checkout')}</strong>{text('На защищённой странице платёжного партнёра', 'Төлем серіктесінің қорғалған бетінде', 'On the payment provider’s secure page')}</span></li>
            <li><TimerReset size={15} /><span><strong>{text('Легко отменить', 'Оңай тоқтату', 'Easy to cancel')}</strong>{text('Доступ останется до конца периода', 'Қолжетімділік кезең соңына дейін қалады', 'Keep access through the paid period')}</span></li>
          </ul>

          <nav className="pro-legal-links" aria-label={text('Условия покупки', 'Сатып алу шарттары', 'Purchase terms')}>
            <Link href="/legal/terms">{text('Условия', 'Шарттар', 'Terms')}</Link>
            <Link href="/legal/privacy">{text('Конфиденциальность', 'Құпиялық', 'Privacy')}</Link>
            <Link href="/legal/refunds">{text('Отмена и возвраты', 'Тоқтату және қайтару', 'Cancellation and refunds')}</Link>
          </nav>

          {!billingConfiguration.checkoutEnabled && <p className="pro-preview-note">
            {billingConfiguration.nativePlatform ? text(
              'В Android-приложении цифровая подписка будет подключаться через Google Play. Веб-оплата здесь специально отключена до интеграции Play Billing.',
              'Android қолданбасында цифрлық жазылым Google Play арқылы қосылады. Play Billing интеграциясына дейін веб-төлем әдейі өшірілген.',
              'In the Android app, the digital subscription will use Google Play. Web checkout is intentionally disabled until Play Billing is integrated.',
            ) : billingConfiguration.enabled && !billingConfiguration.supportEmail ? text(
              'Оплата останется выключенной, пока владелец Slipstream не добавит публичный email поддержки в настройках приложения.',
              'Slipstream иесі қолданба баптауларына жалпыға қолжетімді қолдау email-ын қоспайынша төлем өшірулі қалады.',
              'Checkout stays disabled until the Slipstream owner configures a public support email.',
            ) : text(
              'Это предварительный экран: реальные списания выключены, пока владелец Slipstream не подключит платёжный сервис.',
              'Бұл алдын ала экран: Slipstream иесі төлем сервисін қоспайынша нақты төлем алынбайды.',
              'This is a preview: real charges stay disabled until Slipstream connects a payment provider.',
            )}
          </p>}
        </aside>
      </section>

      {message && <p className="pro-message" role="status">{message}</p>}

      <ProAnalyzer active={active} statusLoading={subscriptionLoading} />

      <ProToolkit active={active} />

      <ProWeeklyDigest active={active} />

      <section className="pro-benefits" aria-labelledby="pro-benefits-title">
        <header>
          <p className="pro-eyebrow"><BrainCircuit size={14} /> {text('Внутри Pro', 'Pro ішінде', 'Inside Pro')}</p>
          <h2 id="pro-benefits-title">{text('Не просто цифры — конкретные решения', 'Жай сандар емес — нақты шешімдер', 'More than numbers — clear decisions')}</h2>
          <p>{text(
            'Каждая рекомендация объясняет, какие данные повлияли на вывод и что лучше сделать дальше.',
            'Әр ұсыныс қорытындыға қандай деректер әсер еткенін және әрі қарай не істеу керегін түсіндіреді.',
            'Every recommendation explains the data behind it and what to do next.',
          )}</p>
        </header>
        <div className="pro-benefit-grid">
          {features.map((feature) => <article className="pro-benefit-card" key={feature.title}>
            <span className="pro-benefit-icon">{feature.icon}</span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
            <small><Check size={13} /> {feature.detail}</small>
          </article>)}
        </div>
      </section>

      <section className="pro-privacy">
        <ShieldCheck size={25} />
        <div><h2>{text('Твои данные остаются твоими', 'Деректерің өзіңе тиесілі', 'Your data stays yours')}</h2><p>{text(
          'Анкета отправляется модели ИИ Google только после отдельного согласия и сейчас не сохраняется автоматически. Платёжные реквизиты Slipstream не хранит — ими управляет платёжный партнёр.',
          'Сауалнама жеке келісімнен кейін ғана Google AI моделіне жіберіледі және қазір автоматты түрде сақталмайды. Slipstream төлем деректерін сақтамайды — оларды төлем серіктесі басқарады.',
          'The form is sent to Google AI only after separate consent and is not currently auto-saved. Slipstream does not store card details; the payment provider handles them.',
        )}</p></div>
      </section>

      <section className="pro-faq" aria-labelledby="pro-faq-title">
        <h2 id="pro-faq-title">{text('Коротко о важном', 'Маңыздысы қысқаша', 'Good to know')}</h2>
        <details><summary>{text('Можно отменить подписку?', 'Жазылымды тоқтатуға бола ма?', 'Can I cancel?')}</summary><p>{text('Да, в любой момент. Pro останется активным до конца уже оплаченного месяца.', 'Иә, кез келген уақытта. Pro төленген айдың соңына дейін белсенді болады.', 'Yes, anytime. Pro remains active through the month you already paid for.')}</p></details>
        <details><summary>{text('Есть лимит на ИИ-разборы?', 'AI талдауларына шектеу бар ма?', 'Is there an AI analysis limit?')}</summary><p>{text('Да: до 30 полных отчётов в календарный месяц. Это защищает сервис от злоупотреблений и сохраняет цену $5.', 'Иә: күнтізбелік айда 30 толық есепке дейін. Бұл сервисті теріс пайдаланудан қорғайды және $5 бағасын сақтайды.', 'Yes: up to 30 full reports per calendar month. This prevents abuse and keeps the price at $5.')}</p></details>
        <details><summary>{text('ИИ заменяет врача или профессиональный bike fit?', 'AI дәрігерді немесе кәсіби bike fit-ті алмастыра ма?', 'Does AI replace a doctor or professional bike fit?')}</summary><p>{text('Нет. Это персональные спортивные подсказки. При боли или проблемах со здоровьем обратись к врачу; точную посадку проверяй со специалистом.', 'Жоқ. Бұл жеке спорттық кеңестер. Ауырсыну не денсаулық мәселесі болса, дәрігерге жүгін; нақты отырысты маманмен тексер.', 'No. These are personalized training tips. See a doctor for pain or health concerns and a professional for precise bike fitting.')}</p></details>
        <details><summary>{text('Что будет с бесплатной версией?', 'Тегін нұсқаға не болады?', 'What happens to the free version?')}</summary><p>{text('Запись поездок, базовые маршруты, лента и сообщество останутся доступными. Pro добавляет полный персональный ИИ-отчёт и подробные чек-листы.', 'Сапар жазу, негізгі бағыттар, лента және қауымдастық қолжетімді қалады. Pro толық жеке AI есебі мен егжей-тегжейлі тізімдерді қосады.', 'Ride recording, basic routes, the feed and community remain available. Pro adds a full personal AI report and detailed checklists.')}</p></details>
      </section>

      <footer className="pro-final-cta">
        <div><CreditCard size={23} /><span><strong>Slipstream Pro · $5/{text('месяц', 'ай', 'month')}</strong><small>{text('Отмена в любой момент', 'Кез келген уақытта тоқтату', 'Cancel anytime')}</small></span></div>
        {active || needsBillingAttention ? <button type="button" onClick={() => void openPortal()} disabled={!billingConfiguration.checkoutEnabled || billingAction !== null}>{billingConfiguration.nativePlatform
          ? text('Магазин', 'Дүкен', 'Store')
          : needsBillingAttention
            ? text('Исправить оплату', 'Төлемді түзету', 'Fix payment')
            : text('Управлять', 'Басқару', 'Manage')} <ChevronRight size={17} /></button>
          : session ? <button type="button" onClick={() => void beginCheckout()} disabled={!billingConfiguration.checkoutEnabled || billingAction !== null}>{billingConfiguration.checkoutEnabled
            ? text('Подключить Pro', 'Pro қосу', 'Get Pro')
            : billingConfiguration.nativePlatform
              ? text('Google Play', 'Google Play', 'Google Play')
              : text('Скоро', 'Жақында', 'Coming soon')} <ChevronRight size={17} /></button>
            : <Link href="/auth/sign-in">{text('Войти', 'Кіру', 'Sign in')} <ChevronRight size={17} /></Link>}
      </footer>

      <p className="pro-health-disclaimer">{text(
        'Slipstream Pro предоставляет спортивные и информационные рекомендации и не является медицинским сервисом. При боли, головокружении или плохом самочувствии остановись и обратись к врачу или взрослому, которому доверяешь.',
        'Slipstream Pro спорттық және ақпараттық кеңес береді, медициналық сервис емес. Ауырсыну, бас айналу немесе нашар сезім болса, тоқтап, дәрігерге не сенетін ересекке хабарлас.',
        'Slipstream Pro provides training and informational guidance, not medical care. Stop and contact a doctor or trusted adult if you feel pain, dizziness or unwell.',
      )}</p>
    </main>
  </PageShell>;
}
