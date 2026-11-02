// Каталог букетов: один список для сайта и для Telegram Mini App.
export const BOUQUETS = [
  { id: "pink-morning", name: "Розовое утро", desc: "15 пионовидных роз, эвкалипт", price: 750, emoji: "🌹", tone: "pink" },
  { id: "spring-garden", name: "Весенний сад", desc: "Тюльпаны, ирисы, мимоза", price: 590, emoji: "🌷", tone: "green" },
  { id: "sunny", name: "Солнечный", desc: "Подсолнухи, ромашки, лён", price: 520, emoji: "🌻", tone: "yellow" },
  { id: "tenderness", name: "Нежность", desc: "Гортензия, эустома, гвоздика", price: 890, emoji: "💐", tone: "lilac" },
] as const;

export type Bouquet = (typeof BOUQUETS)[number];

export function findBouquet(id: unknown): Bouquet | undefined {
  return BOUQUETS.find((b) => b.id === id);
}
