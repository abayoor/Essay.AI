import type { Locale } from './cyclingModels';
import { usePreferences } from './preferences';

const messages = {
  ru: {
    dashboard: 'Сводка', feed: 'Лента', map: 'Карта', record: 'Запись', competitions: 'Соревнования', profile: 'Профиль', settings: 'Настройки', signIn: 'Войти', signOut: 'Выйти', messages: 'Сообщения', myRides: 'Мои заезды', bikesAndService: 'Велосипеды и ТО',
    feedKicker: 'Общая лента', feedTitle: 'Что у сообщества?', feedDescription: 'Свежие фото, видео и тренировки всех райдеров — в одном месте.', newPost: 'Создать пост', loadFeed: 'Загружаем ленту…', emptyFeedTitle: 'Лента пока пустая', emptyFeedDescription: 'Опубликуй первый заезд — его увидит всё сообщество.', retry: 'Повторить',
    recordDistance: 'Дистанция', recordSpeed: 'Скорость', recordTime: 'Время', km: 'км', kmh: 'км/ч', meters: 'м', gpsSearching: 'Уточняем GPS…', gpsReady: 'GPS готов', gpsPoints: 'Точек: ', gpsWeak: 'Слабый GPS', gpsPaused: 'Запись на паузе', gpsDenied: 'Нужен доступ к геолокации', gpsUnavailable: 'GPS пока недоступен', startRecording: 'Старт записи', pause: 'Пауза', finish: 'Завершить', resume: 'Продолжить', newRecording: 'Новая запись', backToDashboard: '← Вернуться к сводке',
  },
  kz: {
    dashboard: 'Шолу', feed: 'Лента', map: 'Карта', record: 'Жазба', competitions: 'Жарыстар', profile: 'Профиль', settings: 'Баптаулар', signIn: 'Кіру', signOut: 'Шығу', messages: 'Хабарламалар', myRides: 'Менің сапарларым', bikesAndService: 'Велосипедтер және қызмет',
    feedKicker: 'Ортақ лента', feedTitle: 'Қауымдастықта не болып жатыр?', feedDescription: 'Барлық райдердің жаңа фотолары, видеолары және жаттығулары — бір жерде.', newPost: 'Жазба жасау', loadFeed: 'Лента жүктелуде…', emptyFeedTitle: 'Лента әзірге бос', emptyFeedDescription: 'Алғашқы сапарыңды жарияла — оны бүкіл қауымдастық көреді.', retry: 'Қайталау',
    recordDistance: 'Қашықтық', recordSpeed: 'Жылдамдық', recordTime: 'Уақыт', km: 'км', kmh: 'км/сағ', meters: 'м', gpsSearching: 'GPS нақтылануда…', gpsReady: 'GPS дайын', gpsPoints: 'Нүктелер: ', gpsWeak: 'GPS сигналы әлсіз', gpsPaused: 'Жазба кідіртілді', gpsDenied: 'Геолокацияға рұқсат керек', gpsUnavailable: 'GPS әзірге қолжетімсіз', startRecording: 'Жазбаны бастау', pause: 'Кідірту', finish: 'Аяқтау', resume: 'Жалғастыру', newRecording: 'Жаңа жазба', backToDashboard: '← Шолуға оралу',
  },
  en: {
    dashboard: 'Overview', feed: 'Feed', map: 'Map', record: 'Record', competitions: 'Competitions', profile: 'Profile', settings: 'Settings', signIn: 'Sign in', signOut: 'Sign out', messages: 'Messages', myRides: 'My rides', bikesAndService: 'Bikes & service',
    feedKicker: 'Community feed', feedTitle: 'What is the community up to?', feedDescription: 'Fresh photos, videos and rides from every rider — all in one place.', newPost: 'Create post', loadFeed: 'Loading feed…', emptyFeedTitle: 'The feed is empty', emptyFeedDescription: 'Publish the first ride for the whole community to see.', retry: 'Retry',
    recordDistance: 'Distance', recordSpeed: 'Speed', recordTime: 'Time', km: 'km', kmh: 'km/h', meters: 'm', gpsSearching: 'Refining GPS…', gpsReady: 'GPS ready', gpsPoints: 'Points: ', gpsWeak: 'Weak GPS', gpsPaused: 'Recording paused', gpsDenied: 'Location permission is needed', gpsUnavailable: 'GPS is unavailable', startRecording: 'Start recording', pause: 'Pause', finish: 'Finish', resume: 'Resume', newRecording: 'New recording', backToDashboard: '← Back to overview',
  },
} as const;

export type TranslationKey = keyof typeof messages.ru;

export function translate(locale: Locale, key: TranslationKey): string {
  return messages[locale][key];
}

export function useTranslations(): (key: TranslationKey) => string {
  const { locale } = usePreferences();
  return (key) => translate(locale, key);
}
