import type { Locale } from './cyclingModels';
import { usePreferences } from './preferences';

const messages = {
  ru: {
    dashboard: 'Сводка', feed: 'Лента', record: 'Запись', routes: 'Маршруты', bikes: 'Гараж', messages: 'Сообщения', profile: 'Профиль', settings: 'Настройки', signIn: 'Войти', signOut: 'Выйти',
    community: 'Локальное велосообщество', hero: 'Ближе к дороге.', heroEmphasis: 'Ближе', heroEnd: 'к своим.', heroText: 'Маршруты, гараж, журнал заездов и люди, с которыми хочется крутить дальше.', join: 'Присоединиться', viewRoutes: 'Смотреть маршруты →',
    collect: 'Собирай километры', collectText: 'Логируй заезды и смотри честную статистику — без шума.', garage: 'Знай свою технику', garageText: 'Гараж напоминает о цепи, покрышках и тормозах до того, как станет поздно.', discover: 'Находи дорогу', discoverText: 'Делись маршрутами из своего региона и забирай с собой проверенные треки.',
  },
  kz: {
    dashboard: 'Шолу', feed: 'Лента', record: 'Жазба', routes: 'Бағыттар', bikes: 'Гараж', messages: 'Хабарламалар', profile: 'Профиль', settings: 'Баптаулар', signIn: 'Кіру', signOut: 'Шығу',
    community: 'Жергілікті велоқауымдастық', hero: 'Жолға жақын.', heroEmphasis: 'Өзіңе', heroEnd: 'жақын.', heroText: 'Бағыттар, гараж, сапар журналы және бірге педаль басқың келетін адамдар.', join: 'Қосылу', viewRoutes: 'Бағыттарды көру →',
    collect: 'Километр жина', collectText: 'Сапарларды жазып, таза статистиканы көр.', garage: 'Техникаңды таны', garageText: 'Гараж шынжыр, дөңгелек және тежегіш туралы алдын ала ескертеді.', discover: 'Жолды тап', discoverText: 'Өз өңіріңнің бағыттарымен бөлісіп, тексерілген тректерді ал.',
  },
  en: {
    dashboard: 'Overview', feed: 'Feed', record: 'Record', routes: 'Routes', bikes: 'Garage', messages: 'Messages', profile: 'Profile', settings: 'Settings', signIn: 'Sign in', signOut: 'Sign out',
    community: 'Local cycling community', hero: 'Closer to the road.', heroEmphasis: 'Closer', heroEnd: 'to your people.', heroText: 'Routes, garage, ride log and people you want to keep riding with.', join: 'Join in', viewRoutes: 'Explore routes →',
    collect: 'Collect kilometres', collectText: 'Log rides and see clear statistics without the noise.', garage: 'Know your bike', garageText: 'The garage reminds you about chains, tyres and brakes before it is too late.', discover: 'Find your road', discoverText: 'Share local routes and take proven tracks with you.',
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
