// Разделы сайта, которые голосовой агент умеет показывать (инструмент show_section).
// id — якорь на главной странице. Агент знает только эти ключи; если клиент просит
// что-то другое, агент говорит, что такого раздела нет, и ничего не открывает.
export const VOICE_SECTIONS = {
  bouquets: { id: "bouquets", label: "Букеты и цены" },
  delivery: { id: "delivery", label: "Доставка и гарантия свежести" },
  order: { id: "order", label: "Форма заявки" },
  contacts: { id: "contacts", label: "Контакты" },
} as const;

export type VoiceSection = keyof typeof VOICE_SECTIONS;

// ID агента ElevenLabs — публичный (виден в коде виджета), это не секрет.
export const ELEVENLABS_AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || "agent_4201m72xezrefx48gj25m6n7aaax";
