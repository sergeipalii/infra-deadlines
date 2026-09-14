#!/usr/bin/env node
/**
 * Verifies the board itself — structure, dates, sources, and above all whether
 * anything sitting in `open` is already past its announced date.
 *
 *   node scripts/verify.mjs            # report
 *   node scripts/verify.mjs --strict   # exit 1 on any problem (for CI)
 *
 * The check that earns its keep is the last one. On 2026-09-12 four rows had
 * been expired for weeks while still showing on a public page, and two events
 * had never been entered at all. Nothing was broken in the code — the board had
 * simply not been read. This is that reading, automated.
 *
 * What this does NOT do: re-check each entry against its live source. There is
 * no generic probe — one entry is a Chainlink feed read on-chain, the next is a
 * REST endpoint, the next a vendor blog that has since become a JS shell. The
 * series rule stands and stays manual: a deadline is not closed because it was
 * announced, only because the source was checked again on the day.
 */
import { load, deadlineInstant, closedInstant, daysLeft, SOURCE_QUALITY } from "../src/index.mjs";

const STRICT = process.argv.includes("--strict");
const problems = [];
const notes = [];

const board = load();
// Две секции — две формы, и это не недосмотр. У открытой записи есть срок
// впереди (`deadline`) и требуемое действие; у закрытой — день, когда это
// случилось (`effective`), и отметка, чем подтверждено. Требовать от закрытой
// `action` значило бы просить план для того, что уже прошло.
const REQUIRED = {
  open: ["id", "what", "deadline", "action", "source", "source_quality"],
  closed: ["id", "what", "effective", "source"],
};
const DATE_FIELD = { open: "deadline", closed: "effective" };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}:\d{2}$/;

const seen = new Map();
for (const section of ["open", "closed"]) {
  for (const [i, e] of board[section].entries()) {
    const where = `${section}[${i}] ${e?.id ?? "<без id>"}`;

    for (const field of REQUIRED[section]) {
      if (e?.[field] === undefined || e[field] === null || e[field] === "") {
        problems.push(`${where}: нет обязательного поля \`${field}\``);
      }
    }
    if (e?.id) {
      if (seen.has(e.id)) problems.push(`${where}: id повторяется, уже был в ${seen.get(e.id)}`);
      else seen.set(e.id, section);
    }
    const dateField = DATE_FIELD[section];
    const dateValue = e?.[dateField];
    if (dateValue && !DATE.test(String(dateValue))) {
      problems.push(`${where}: ${dateField} «${dateValue}» не в формате YYYY-MM-DD`);
    } else if (dateValue) {
      const instant = section === "open" ? deadlineInstant(e) : closedInstant(e);
      if (Number.isNaN(instant.getTime())) problems.push(`${where}: ${dateField} «${dateValue}» не разбирается как дата`);
    }
    if (section === "open") {
      // `time: null` — законное состояние: источник назвал дату без времени.
      // Отсутствие ключа вовсе — нет: тогда непонятно, спрашивали ли.
      if (e && !("time" in e)) problems.push(`${where}: нет ключа \`time\` (null — законное значение, отсутствие — нет)`);
      if (e?.time && !TIME.test(String(e.time))) {
        problems.push(`${where}: time «${e.time}» не в формате HH:MM:SS`);
      }
      if (e?.source_quality && !SOURCE_QUALITY.includes(String(e.source_quality).split(/\s/)[0])) {
        problems.push(`${where}: source_quality «${e.source_quality}» вне набора ${SOURCE_QUALITY.join(" | ")}`);
      }
    }
    // Ссылка в source — сильное ожидание, но не правило: источником бывает
    // названный документ без стабильного адреса. Замечание, а не ошибка.
    if (e?.source && !/https?:\/\//.test(String(e.source))) {
      notes.push(`${where}: в source нет ссылки — «${e.source}»`);
    }
  }
}

// Порядок — не косметика, и у двух секций он разный, потому что их читают
// по-разному. Открытые: ближайший срок первым — выпуск берёт с доски пять
// верхних строк, и перепутанный порядок молча отправляет в письмо не те пять.
// Закрытые: недавно закрывшееся первым — их читают как «что уже произошло»,
// и так же их рисует страница серии.
const ORDER = { open: "asc", closed: "desc" };
for (const section of ["open", "closed"]) {
  const dates = board[section].map((e) => (section === "open" ? deadlineInstant(e) : closedInstant(e)).getTime());
  for (let i = 1; i < dates.length; i++) {
    const wrong = ORDER[section] === "asc" ? dates[i] < dates[i - 1] : dates[i] > dates[i - 1];
    if (wrong) {
      const how = ORDER[section] === "asc" ? "по возрастанию даты" : "по убыванию даты";
      problems.push(`${section}: порядок нарушен на позиции ${i} (${board[section][i].id}) — секция должна идти ${how}`);
      break;
    }
  }
}

// Главная проверка — и единственное исключение из неё.
//
// `overdue: true` означает «объявленный срок прошёл, а событие не наступило».
// Это не забытая строка, а правило серии: срок не считается закрытым по
// объявлению, только по проверке источника. Такую запись держат открытой
// намеренно и до факта. Поэтому ошибка — просроченная запись БЕЗ этой отметки;
// с отметкой это замечание, за которым надо сходить к источнику.
const stale = board.open.filter((e) => daysLeft(e) < 0);
for (const e of stale) {
  const line = `«${e.id}» истёк ${e.deadline} (${-daysLeft(e)} дн. назад)`;
  if (e.overdue === true) {
    notes.push(`${line}, помечен overdue — событие не наступило; перепроверить источник`);
  } else {
    problems.push(
      `open: ${line}, но всё ещё в open и без отметки overdue — ` +
        `либо перенести в closed, либо проставить \`overdue: true\` с причиной`,
    );
  }
}

// Обратная ошибка: отметка стоит, а срок ещё впереди — значит её забыли снять
// после переноса даты, и доска утверждает несбывшееся про будущее.
for (const e of board.open) {
  if (e.overdue === true && daysLeft(e) >= 0) {
    problems.push(`open: «${e.id}» помечен overdue, но срок ${e.deadline} ещё не наступил — отметку снять`);
  }
}

// Мягкие замечания: не ошибки, но повод посмотреть.
const soon = board.open.filter((e) => daysLeft(e) >= 0 && daysLeft(e) <= 7);
if (soon.length) notes.push(`ближайшие 7 дней: ${soon.length} срок(ов) — ${soon.map((e) => e.id).join(", ")}`);
const secondary = board.open.filter((e) => String(e.source_quality).startsWith("secondary"));
if (secondary.length) notes.push(`без первоисточника: ${secondary.length} — ${secondary.map((e) => e.id).join(", ")}`);
if (board.updated) {
  const age = Math.floor((Date.now() - new Date(`${board.updated}T00:00:00Z`)) / 86_400_000);
  if (age > 14) notes.push(`доска не обновлялась ${age} дн. (updated: ${board.updated})`);
}

console.log(`Доска: ${board.open.length} открытых, ${board.closed.length} закрытых, updated ${board.updated}.`);
for (const n of notes) console.log(`  · ${n}`);
if (problems.length) {
  console.log(`\nПроблем: ${problems.length}`);
  for (const p of problems) console.log(`  ✗ ${p}`);
} else {
  console.log("\nПроблем не найдено.");
}

process.exit(STRICT && problems.length ? 1 : 0);
