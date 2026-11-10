import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { SOURCES, STAGES, STAGE_KEYS, formatDate, isStage, type RequestRow, type Stage } from "@/lib/requests";

// MCP-сервер CRM Floria (транспорт Streamable HTTP, без состояния, ответы JSON).
// Подключение: claude mcp add --transport http floria-crm https://flori-site.vercel.app/api/mcp \
//   --header "Authorization: Bearer <MCP_TOKEN>"
// Токен лежит только в переменной MCP_TOKEN на Vercel. Без него — 401.

export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "floria-crm", version: "1.0.0" };
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

function authorized(req: Request) {
  const expected = process.env.MCP_TOKEN?.trim();
  const header = req.headers.get("authorization") ?? "";
  const got = header.replace(/^Bearer\s+/i, "").trim();
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const unauthorized = () =>
  NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Доступ запрещён: нужен токен (Authorization: Bearer …)" } },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="floria-crm"' } }
  );

// ---------- Инструменты ----------

const stageList = STAGE_KEYS.map((k) => `${k} (${STAGES[k]})`).join(", ");

const TOOLS = [
  {
    name: "list_requests",
    description:
      "Список заявок CRM за период (по дате создания, время Кишинёва). Без дат — за сегодня. " +
      "Можно отфильтровать по этапу и источнику. Подходит для вопросов «сколько заявок сегодня», «что пришло за неделю».",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Начало периода, YYYY-MM-DD (включительно). По умолчанию сегодня." },
        to: { type: "string", description: "Конец периода, YYYY-MM-DD (включительно). По умолчанию = from." },
        stage: { type: "string", description: `Этап: ${stageList}` },
        source: { type: "string", description: `Источник: ${Object.entries(SOURCES).map(([k, v]) => `${k} (${v})`).join(", ")}` },
        limit: { type: "number", description: "Сколько заявок вернуть, по умолчанию 50, максимум 200" },
      },
    },
  },
  {
    name: "find_client",
    description: "Найти клиента по имени (часть имени) или телефону (часть цифр). Возвращает карточки с id, этапом и источником.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: { query: { type: "string", description: "Имя или телефон, например «Иванов» или «069»" } },
    },
  },
  {
    name: "change_stage",
    description:
      "Перевести карточку клиента на другой этап воронки. Укажи client — id карточки, имя или телефон. " +
      "Если найдено несколько клиентов, ничего не меняется и возвращается список — уточни id. " +
      "Переход записывается в историю карточки с пометкой «MCP».",
    inputSchema: {
      type: "object",
      required: ["client", "stage"],
      properties: {
        client: { type: "string", description: "id карточки, имя или телефон" },
        stage: { type: "string", description: `Новый этап — ключ или название: ${stageList}` },
      },
    },
  },
];

type Args = Record<string, unknown>;

// Смещение Кишинёва для даты (учитывает летнее/зимнее время), например "+02:00".
function chisinauOffset(date: Date) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Chisinau", timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = part?.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : "+02:00";
}

function todayInChisinau() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau" }).format(new Date());
}

function dayBounds(from: string, to: string) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(from) || !re.test(to)) throw new Error("Даты нужны в формате YYYY-MM-DD");
  const start = new Date(`${from}T00:00:00${chisinauOffset(new Date(`${from}T12:00:00Z`))}`);
  const end = new Date(`${to}T00:00:00${chisinauOffset(new Date(`${to}T12:00:00Z`))}`);
  end.setUTCDate(end.getUTCDate() + 1);
  if (end <= start) throw new Error("Конец периода раньше начала");
  return { start: start.toISOString(), end: end.toISOString() };
}

function toStage(value: unknown): Stage | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (isStage(v)) return v;
  const byLabel = STAGE_KEYS.find((k) => STAGES[k].toLowerCase() === v);
  return byLabel ?? null;
}

function card(r: RequestRow) {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    stage: `${STAGES[r.stage] ?? r.stage}`,
    source: `${SOURCES[r.source] ?? r.source}`,
    created: formatDate(r.created_at),
    comment: r.comment || undefined,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function searchClients(query: string, limit = 10) {
  const supabase = createServiceClient();
  const q = query.trim();
  if (UUID_RE.test(q)) {
    const { data, error } = await supabase.from("requests").select("*").eq("id", q).returns<RequestRow[]>();
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  const digits = q.replace(/\D/g, "");
  const safe = q.replace(/[%,()]/g, " ");
  const filters = [`name.ilike.%${safe}%`];
  if (digits.length >= 3) filters.push(`phone.ilike.%${digits.split("").join("%")}%`);
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RequestRow[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function callTool(name: string, args: Args) {
  const supabase = createServiceClient();

  if (name === "list_requests") {
    const from = String(args.from ?? todayInChisinau());
    const to = String(args.to ?? from);
    const { start, end } = dayBounds(from, to);
    const limit = Math.min(Math.max(Number(args.limit ?? 50) || 50, 1), 200);
    let query = supabase
      .from("requests")
      .select("*", { count: "exact" })
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (args.stage) {
      const st = toStage(args.stage);
      if (!st) throw new Error(`Неизвестный этап «${args.stage}». Доступны: ${stageList}`);
      query = query.eq("stage", st);
    }
    if (args.source) {
      const src = String(args.source).toLowerCase();
      const key = (Object.keys(SOURCES) as (keyof typeof SOURCES)[]).find((k) => k === src || SOURCES[k].toLowerCase() === src);
      if (!key) throw new Error(`Неизвестный источник «${args.source}»`);
      query = query.eq("source", key);
    }
    const { data, error, count } = await query.returns<RequestRow[]>();
    if (error) throw new Error(error.message);
    return { period: from === to ? from : `${from} — ${to}`, total: count ?? data?.length ?? 0, requests: (data ?? []).map(card) };
  }

  if (name === "find_client") {
    const q = String(args.query ?? "").trim();
    if (q.length < 2) throw new Error("Запрос слишком короткий");
    const rows = await searchClients(q, 20);
    return { found: rows.length, clients: rows.map(card) };
  }

  if (name === "change_stage") {
    const stage = toStage(args.stage);
    if (!stage) throw new Error(`Неизвестный этап «${args.stage}». Доступны: ${stageList}`);
    const client = String(args.client ?? "").trim();
    if (client.length < 2) throw new Error("Укажи клиента: id, имя или телефон");
    const rows = await searchClients(client, 10);
    if (rows.length === 0) return { changed: false, message: `Клиент «${client}» не найден` };
    if (rows.length > 1)
      return { changed: false, message: "Найдено несколько клиентов — уточни id", candidates: rows.map(card) };

    const before = rows[0];
    if (before.stage === stage)
      return { changed: false, message: `${before.name} уже на этапе «${STAGES[stage]}»`, client: card(before) };

    const { data, error } = await supabase
      .rpc("set_stage_via", { p_id: before.id, p_stage: stage, p_via: "MCP" });
    if (error) throw new Error(error.message);
    const after = (data as RequestRow[] | null)?.[0];
    return {
      changed: true,
      message: `${before.name}: «${STAGES[before.stage]}» → «${STAGES[stage]}» (в истории с пометкой MCP)`,
      client: after ? card(after) : undefined,
    };
  }

  throw new Error(`Неизвестный инструмент: ${name}`);
}

// ---------- JSON-RPC ----------

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

async function handleRpc(msg: RpcRequest) {
  const { id, method, params } = msg;
  const ok = (result: unknown) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

  switch (method) {
    case "initialize": {
      const requested = String(params?.protocolVersion ?? "");
      return ok({
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "CRM цветочного магазина Floria: заявки, поиск клиентов и смена этапа воронки.",
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const name = String(params?.name ?? "");
      const args = (params?.arguments ?? {}) as Args;
      try {
        const result = await callTool(name, args);
        return ok({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return ok({ content: [{ type: "text", text: `Ошибка: ${message}` }], isError: true });
      }
    }
    default:
      return fail(-32601, `Метод не поддерживается: ${method}`);
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }

  const messages = (Array.isArray(body) ? body : [body]) as RpcRequest[];
  const responses = [];
  for (const m of messages) {
    if (m && typeof m === "object" && m.id !== undefined && m.id !== null) responses.push(await handleRpc(m));
    // Уведомления (без id), например notifications/initialized, ответа не требуют.
  }
  if (responses.length === 0) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0]);
}

export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  // Сервер без состояния: поток событий не открываем.
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE(req: Request) {
  if (!authorized(req)) return unauthorized();
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
