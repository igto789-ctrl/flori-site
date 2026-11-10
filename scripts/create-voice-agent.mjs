// Создаёт (или обновляет) голосового агента Floria в ElevenLabs через API.
// Запуск: ELEVENLABS_API_KEY=... VOICE_WEBHOOK_SECRET=... node scripts/create-voice-agent.mjs [agent_id]
// Ключи берутся только из переменных окружения, в коде их нет.
const KEY = process.env.ELEVENLABS_API_KEY;
const SECRET = process.env.VOICE_WEBHOOK_SECRET;
const SITE = process.env.SITE_URL ?? "https://flori-site.vercel.app";
const existingId = process.argv[2];
if (!KEY || !SECRET) throw new Error("Нужны ELEVENLABS_API_KEY и VOICE_WEBHOOK_SECRET");

const prompt = `Ты — голосовой консультант цветочного магазина Floria в Кишинёве. Говоришь по-русски, коротко и дружелюбно (1–2 предложения за раз). Если клиент говорит по-румынски, отвечай по-румынски.

ЧТО ТЫ ЗНАЕШЬ (говори только это, ничего не выдумывай):
- Floria собирает букеты в день заказа из цветов, которые привезли утром, и доставляет по всему Кишинёву.
- Букеты и цены:
  • «Розовое утро» — 15 пионовидных роз и эвкалипт, 750 лей.
  • «Весенний сад» — тюльпаны, ирисы, мимоза, 590 лей.
  • «Солнечный» — подсолнухи, ромашки, лён, 520 лей.
  • «Нежность» — гортензия, эустома, гвоздика, 890 лей.
- Доставка за 2 часа, бесплатно от 600 лей. Перед отправкой присылаем фото букета. Свежесть 7 дней — или заменим букет.
- После заявки флорист перезванивает в течение 15 минут.
- График работы, точную стоимость доставки дешевле 600 лей, адрес и телефон магазина ты не знаешь: скажи, что это уточнит флорист, когда перезвонит.
- Если вопрос не про цветы и не про магазин, вежливо скажи, что помогаешь только с букетами и доставкой, и верни разговор к выбору букета.

ПОКАЗ РАЗДЕЛОВ САЙТА — инструмент show_section. Есть только 4 раздела:
- bouquets — букеты, цены, «покажи работы», «какие у вас цены», «каталог»;
- delivery — доставка, гарантия свежести, фото перед отправкой;
- order — форма заявки;
- contacts — контакты (внизу страницы: Floria, Кишинёв).
Когда клиент просит показать что-то из этого, вызови show_section и скажи, что именно показываешь, например «Показываю наши букеты с ценами». Потом продолжай разговор.
Если просят раздел, которого нет (отзывы, блог, акции, вакансии, доставка в другие города и т.п.), НЕ вызывай инструмент: скажи, что такого раздела на сайте нет, и предложи то, что есть.

ЗАЯВКА — инструмент create_lead. Когда клиент хочет заказать или чтобы ему перезвонили:
1. Спроси имя. 2. Спроси номер телефона и повтори его цифрами для проверки. 3. Вызови create_lead: name, phone и summary — 1–2 предложения по-русски: какой букет, к какому дню и что важно клиенту.
Если инструмент вернул ошибку в телефоне или имени — переспроси. После успеха скажи, что флорист перезвонит в течение 15 минут.

ЗАВЕРШЕНИЕ РАЗГОВОРА — инструмент end_call. Когда клиент прощается или благодарит в конце («спасибо», «всё, спасибо», «до свидания», «пока», «mulțumesc», «la revedere») и больше ничего не спрашивает, коротко попрощайся одной фразой и сразу вызови end_call. Не задавай после этого новых вопросов. Если клиент молчит после того, как заявка создана, один раз спроси, нужно ли что-то ещё, и при тишине тоже вызови end_call.`;


const body = {
  name: "Floria — голосовой консультант",
  conversation_config: {
    agent: {
      first_message: "Здравствуйте! Я консультант Floria. Помогу выбрать букет и оформить доставку по Кишинёву. Что вас интересует?",
      language: "ru",
      prompt: {
        prompt,
        temperature: 0.3,
        built_in_tools: {
          end_call: {
            name: "end_call",
            description: "Завершить звонок, когда клиент попрощался или поблагодарил и больше ничего не спрашивает.",
            params: { system_tool_type: "end_call" },
          },
        },
        tools: [
          {
            type: "client",
            name: "show_section",
            description: "Прокрутить сайт к разделу. Вызывай только для разделов из списка.",
            expects_response: true,
            response_timeout_secs: 5,
            parameters: {
              type: "object",
              required: ["section"],
              properties: {
                section: { type: "string", description: "Ключ раздела", enum: ["bouquets", "delivery", "order", "contacts"] },
              },
            },
          },
          {
            type: "webhook",
            name: "create_lead",
            description: "Создать заявку в CRM магазина, когда известны имя и телефон клиента.",
            response_timeout_secs: 20,
            api_schema: {
              url: `${SITE}/api/voice-lead`,
              method: "POST",
              request_headers: { "X-Voice-Secret": SECRET },
              request_body_schema: {
                type: "object",
                required: ["name", "phone", "summary"],
                properties: {
                  name: { type: "string", description: "Имя клиента" },
                  phone: { type: "string", description: "Телефон клиента цифрами, например +37369123456" },
                  summary: { type: "string", description: "Краткое содержание разговора: букет, дата, пожелания (1–2 предложения по-русски)" },
                },
              },
            },
          },
        ],
      },
    },
    tts: { model_id: "eleven_flash_v2_5", voice_id: "hpp4J3VqNfWAUOO0d1Us" },
    conversation: { max_duration_seconds: 180 },
  },
  platform_settings: {
    auth: { enable_auth: false, allowlist: [{ hostname: new URL(SITE).hostname }, { hostname: "localhost" }] },
    call_limits: { agent_concurrency_limit: 2, daily_limit: 30 },
  },
};

const url = existingId
  ? `https://api.elevenlabs.io/v1/convai/agents/${existingId}`
  : "https://api.elevenlabs.io/v1/convai/agents/create";
const res = await fetch(url, {
  method: existingId ? "PATCH" : "POST",
  headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const text = await res.text();
if (!res.ok) {
  console.error(res.status, text);
  process.exit(1);
}
console.log("OK", existingId ?? JSON.parse(text).agent_id);
