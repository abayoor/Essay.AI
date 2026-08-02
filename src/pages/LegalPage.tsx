import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'wouter';
import { PageShell } from '../components/PageShell';
import { useLocaleText } from '../lib/localized';
import { billingConfiguration } from '../lib/subscriptions';
import '../styles/legal.css';

type LegalKind = 'privacy' | 'terms' | 'refunds';

type LegalSection = {
  title: string;
  body: string;
};

export function LegalPage({ kind }: { kind: LegalKind }) {
  const text = useLocaleText();

  const content: Record<LegalKind, { eyebrow: string; title: string; intro: string; sections: LegalSection[] }> = {
    privacy: {
      eyebrow: text('Конфиденциальность', 'Құпиялық', 'Privacy'),
      title: text('Как Slipstream работает с данными', 'Slipstream деректермен қалай жұмыс істейді', 'How Slipstream handles data'),
      intro: text(
        'Эта страница объясняет, какие данные нужны сервису, зачем они используются и какие действия доступны тебе.',
        'Бұл бет сервиске қандай деректер қажет екенін, олардың не үшін пайдаланылатынын және саған қандай әрекеттер қолжетімді екенін түсіндіреді.',
        'This page explains which data the service needs, why it is used, and the choices available to you.',
      ),
      sections: [
        {
          title: text('Аккаунт и поездки', 'Аккаунт және сапарлар', 'Account and rides'),
          body: text(
            'Supabase хранит данные аккаунта, профиль, велосипеды, маршруты, поездки и публикации. Доступ к личным строкам ограничен правилами RLS и идентификатором вошедшего пользователя.',
            'Supabase аккаунт, профиль, велосипед, бағыт, сапар және жарияланым деректерін сақтайды. Жеке жолдарға қолжетімділік RLS ережелерімен және кірген пайдаланушы идентификаторымен шектеледі.',
            'Supabase stores account, profile, bike, route, ride, and post data. Access to personal rows is limited by RLS rules and the signed-in user ID.',
          ),
        },
        {
          title: text('Карта и геолокация', 'Карта және геолокация', 'Map and location'),
          body: text(
            'Выбранные точки и текущее местоположение передаются сервису маршрутизации OpenRouteService или BRouter, чтобы провести линию по дорожной сети. Серверный краткий кэш повторных маршрутов живёт около минуты; история геолокации этой функцией не создаётся.',
            'Таңдалған нүктелер мен ағымдағы орын жол желісі бойынша бағыт құру үшін OpenRouteService немесе BRouter сервисіне жіберіледі. Сервердегі қайталанатын бағыттардың қысқа кэші шамамен бір минут сақталады; бұл функция геолокация тарихын жасамайды.',
            'Selected points and current location are sent to OpenRouteService or BRouter to calculate a route on the road network. A short server cache for repeated routes lasts about one minute; this feature does not create a location history.',
          ),
        },
        {
          title: text('Персональный ИИ-разбор', 'Жеке AI талдауы', 'Personal AI analysis'),
          body: text(
            'Рост, вес, длина ноги и ответы анкеты отправляются Google Gemini только после отдельного согласия и только для создания запрошенного отчёта. Анкета автоматически не сохраняется; Slipstream сохраняет лишь факт согласия и использование лимита. Не указывай медицинские документы и секретные данные.',
            'Бой, салмақ, аяқ ұзындығы және сауалнама жауаптары бөлек келісімнен кейін және сұралған есепті жасау үшін ғана Google Gemini-ге жіберіледі. Сауалнама автоматты түрде сақталмайды; Slipstream тек келісім фактісін және лимиттің қолданылуын сақтайды. Медициналық құжаттар мен құпия деректерді жазба.',
            'Height, weight, inseam, and form answers are sent to Google Gemini only after separate consent and only to create the requested report. The form is not automatically saved; Slipstream stores only the consent record and quota usage. Do not enter medical records or secrets.',
          ),
        },
        {
          title: text('Оплата и управление данными', 'Төлем және деректерді басқару', 'Payments and data controls'),
          body: text(
            'В веб-версии оплату обрабатывает Lemon Squeezy; Slipstream не получает и не хранит номер карты. Для доступа, исправления или удаления данных напиши на адрес поддержки. Некоторые записи могут сохраняться дольше, если этого требует закон, безопасность или учёт платежей.',
            'Веб-нұсқада төлемді Lemon Squeezy өңдейді; Slipstream карта нөмірін алмайды және сақтамайды. Деректерге қол жеткізу, түзету немесе жою үшін қолдау мекенжайына жаз. Кейбір жазбалар заң, қауіпсіздік немесе төлем есебі талап етсе, ұзағырақ сақталуы мүмкін.',
            'On the web, Lemon Squeezy processes payments; Slipstream never receives or stores the card number. Contact support to access, correct, or delete data. Some records may be retained longer where required for law, security, or payment accounting.',
          ),
        },
      ],
    },
    terms: {
      eyebrow: text('Условия', 'Шарттар', 'Terms'),
      title: text('Условия использования Slipstream Pro', 'Slipstream Pro пайдалану шарттары', 'Slipstream Pro terms of use'),
      intro: text(
        'Оплачивая Pro, ты соглашаешься с ежемесячной подпиской и правилами ниже. Цена и возможный налог всегда показываются до подтверждения оплаты.',
        'Pro-ны төлей отырып, ай сайынғы жазылымға және төмендегі ережелерге келісесің. Баға мен ықтимал салық төлемді растағанға дейін көрсетіледі.',
        'By purchasing Pro, you agree to a monthly subscription and the terms below. The price and any applicable tax are shown before payment is confirmed.',
      ),
      sections: [
        {
          title: text('$5 в месяц', 'Айына $5', '$5 per month'),
          body: text(
            'Подписка продлевается каждый месяц, пока ты её не отменишь. В Pro входит до 30 успешно созданных ИИ-отчётов за календарный месяц. Бесплатные функции сообщества и базовых маршрутов не требуют Pro.',
            'Жазылым тоқтатылғанға дейін ай сайын жаңартылады. Pro күнтізбелік айда сәтті жасалған 30 AI есебіне дейін қамтиды. Қауымдастық пен негізгі бағыттардың тегін функциялары Pro-ны қажет етпейді.',
            'The subscription renews monthly until canceled. Pro includes up to 30 successfully generated AI reports per calendar month. Free community and basic routing features do not require Pro.',
          ),
        },
        {
          title: text('Рекомендации, а не гарантия', 'Ұсыныс, кепілдік емес', 'Guidance, not a guarantee'),
          body: text(
            'ИИ может ошибаться. Советы о велосипеде, посадке, тренировках, питании и маршрутах носят информационный характер и не заменяют врача, профессиональный bike fit, механика или оценку дорожной обстановки.',
            'AI қателесуі мүмкін. Велосипед, отырыс, жаттығу, тамақтану және бағыт туралы кеңестер ақпараттық сипатта және дәрігерді, кәсіби bike fit маманын, механикті немесе жол жағдайын бағалауды алмастырмайды.',
            'AI can be wrong. Bike, fit, training, nutrition, and route guidance is informational and does not replace a doctor, professional bike fitter, mechanic, or your assessment of road conditions.',
          ),
        },
        {
          title: text('Возраст и честное использование', 'Жас және адал пайдалану', 'Age and fair use'),
          body: text(
            'Если по законам твоей страны ты не можешь самостоятельно заключить договор, покупку должен подтвердить родитель или законный представитель. Нельзя обходить лимиты, передавать аккаунт для массового использования или применять сервис незаконно.',
            'Еліңнің заңдары бойынша шартты өз бетіңше жасай алмасаң, сатып алуды ата-ана немесе заңды өкіл растауы керек. Лимиттерді айналып өтуге, аккаунтты жаппай қолдануға беруге немесе сервисті заңсыз пайдалануға болмайды.',
            'If local law does not allow you to enter this agreement yourself, a parent or legal guardian must approve the purchase. You may not bypass limits, share the account for bulk use, or use the service unlawfully.',
          ),
        },
      ],
    },
    refunds: {
      eyebrow: text('Оплата', 'Төлем', 'Billing'),
      title: text('Отмена и возвраты', 'Тоқтату және қайтару', 'Cancellation and refunds'),
      intro: text(
        'Подпиской можно управлять на странице платёжного партнёра. Здесь собраны правила без скрытых условий.',
        'Жазылымды төлем серіктесінің бетінде басқаруға болады. Мұнда жасырын шартсыз ережелер берілген.',
        'You can manage the subscription on the payment provider page. These are the rules without hidden conditions.',
      ),
      sections: [
        {
          title: text('Отмена', 'Тоқтату', 'Cancellation'),
          body: text(
            'Отменить автопродление можно в любой момент через «Управлять подпиской» на странице Pro. Новых списаний после конца текущего периода не будет, а уже оплаченный доступ сохранится до указанной даты.',
            'Автоматты жаңартуды Pro бетіндегі «Жазылымды басқару» арқылы кез келген уақытта тоқтатуға болады. Ағымдағы кезең аяқталғаннан кейін жаңа төлем алынбайды, ал төленген қолжетімділік көрсетілген күнге дейін сақталады.',
            'Cancel auto-renewal anytime through “Manage subscription” on the Pro page. No new charge occurs after the current period, and paid access remains available until the shown date.',
          ),
        },
        {
          title: text('Запрос возврата', 'Қайтару сұрауы', 'Refund requests'),
          body: text(
            'Возврат не происходит автоматически после отмены. Если платёж был ошибочным, продублированным или сервис не работал, напиши в поддержку с email аккаунта и датой платежа. Запрос рассматривается по обязательным правам потребителя, правилам платёжного партнёра и применимому законодательству.',
            'Тоқтатудан кейін ақша автоматты түрде қайтарылмайды. Төлем қате, қайталанған немесе сервис жұмыс істемеген болса, аккаунт email-ынан төлем күнін көрсетіп қолдауға жаз. Сұрау міндетті тұтынушы құқықтарына, төлем серіктесінің ережелеріне және қолданылатын заңға сәйкес қаралады.',
            'Cancellation does not automatically issue a refund. If a charge was mistaken, duplicated, or the service did not work, contact support from the account email with the payment date. Requests are handled under mandatory consumer rights, provider rules, and applicable law.',
          ),
        },
        {
          title: text('Мобильные покупки', 'Мобильді сатып алулар', 'Mobile purchases'),
          body: text(
            'Покупками из Android или iOS управляет соответствующий магазин приложений; его правила отмены и возврата могут отличаться от веб-версии.',
            'Android немесе iOS арқылы жасалған сатып алуларды тиісті қолданба дүкені басқарады; оның тоқтату және қайтару ережелері веб-нұсқадан өзгеше болуы мүмкін.',
            'Android or iOS purchases are managed by the relevant app store; its cancellation and refund rules may differ from the web version.',
          ),
        },
      ],
    },
  };

  const page = content[kind];
  const supportEmail = billingConfiguration.supportEmail;

  return <PageShell>
    <main className="legal-page">
      <div className="legal-wrap">
        <Link className="legal-back" href="/pro"><ArrowLeft size={17} /> {text('Назад к Pro', 'Pro бетіне оралу', 'Back to Pro')}</Link>
        <header className="legal-hero">
          <p><ShieldCheck size={16} /> {page.eyebrow}</p>
          <h1>{page.title}</h1>
          <span>{text('Редакция от 1 августа 2026', '2026 жылғы 1 тамыздағы нұсқа', 'Effective August 1, 2026')}</span>
          <div>{page.intro}</div>
        </header>

        <div className="legal-sections">
          {page.sections.map((section) => <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>)}
        </div>

        <aside className="legal-contact">
          <Mail size={21} />
          <div>
            <strong>{text('Нужна помощь?', 'Көмек керек пе?', 'Need help?')}</strong>
            {supportEmail
              ? <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
              : <span>{text(
                'Оплата отключена, пока владелец не добавит публичный email поддержки.',
                'Иесі жалпыға қолжетімді қолдау email-ын қоспайынша төлем өшірулі.',
                'Checkout stays disabled until the owner adds a public support email.',
              )}</span>}
          </div>
        </aside>

        <nav className="legal-nav" aria-label={text('Юридические страницы', 'Құқықтық беттер', 'Legal pages')}>
          <Link href="/legal/privacy">{text('Конфиденциальность', 'Құпиялық', 'Privacy')}</Link>
          <Link href="/legal/terms">{text('Условия', 'Шарттар', 'Terms')}</Link>
          <Link href="/legal/refunds">{text('Отмена и возвраты', 'Тоқтату және қайтару', 'Cancellation and refunds')}</Link>
        </nav>
      </div>
    </main>
  </PageShell>;
}
