<div align="center">

# Thoughts Reflector — System Design Document

**MVP v0.1**  
*Документ актуален на: 2026-07-04*

</div>

## 1. Вопрос и контекст

**Цель:** Telegram-бот — AI-компаньон по ментальному здоровью (чат-обёртка над LLM с фиксированной терапевтической ролью).

**Целевая аудитория:** люди с тревогой, стрессом, психологическими сложностями. Ожидаемый масштаб MVP: **до 100 пользователей**.

**Ограничения:**
- Бюджет: **$0**
- Разработчик находится в Беларуси (Telegram, Railway/Vercel, Groq, HuggingFace, GitHub; OpenAI недоступен)
- Один разработчик, минимальное время на старт
- Бэкенд: простой сервер (Node.js / Python) на Railway / Vercel Serverless

---

## 2. Functional Requirements

| ID | Требование | Приоритет |
|---|---|---|
| FR-1 | Пользователь находит бота и начинает диалог | Must |
| FR-2 | Бот обрабатывает текстовое сообщение | Must |
| FR-3 | История чата сохраняется в PostgreSQL | Must |
| FR-4 | Сообщение отправляется на LLM API | Must |
| FR-5 | Ответ отправляется пользователю в Telegram | Must |
| FR-6 | Ответ сохраняется в БД | Must |
| FR-7 | ИИ в мультидисциплинарной терапевтической роли (КПТ/РЭПТ, психоанализ Хорни/привязанность, экзистенциальный/гуманистический, даос/буддизм/стоицизм, этология/эволюционная психология, социологический/системный). Предвзятость, поиск психзащит и когнитивных искажений. По одному вопросу за ответ. Никаких рекомендаций и советов. | Must |
| FR-8 | Ghost user protection: не тратить токены на удалённых пользователей | Must |
| FR-9 | Команда /perspectives: анализ текущей проблемы с 6 подходов | Must |
| FR-10 | Ступенчатый контекст-мониторинг (>80% мягкое, >95% жёсткое, >100% авто) + команда /recap для краткого итога | Must |
| FR-11 | Команда /connect: пользователь может предоставить свой API key (Groq/HF/Google) | Must |
| FR-12 | Обработка изображений / файлов | Won't |
| FR-13 | Парольная защита / регистрация | Won't |
| FR-14 | Дневник настроения, напоминания | Won't |

---

## 3. Non-Functional Requirements

| ID | Требование | Цель |
|---|---|---|
| NFR-1 | Время ответа | < 5 сек |
| NFR-2 | Доступность | 99% (Railway/Vercel + Groq + Telegram) |
| NFR-3 | Приватность | История в БД, пользовательские ключи в env |
| NFR-4 | Защита трафика | HTTPS |
| NFR-5 | Масштаб | До 100 пользователей |

---

## 4. Ограничения

| Ограничение | Обоснование |
|---|---|
| $0 бюджет | Нет платных API |
| Один разработчик | Минимум зависимостей |
| Беларусь | Telegram ✓, Railway/Vercel ✓, Groq ✓, HuggingFace ✓, OpenAI ✗ |
| Бэкенд | Требуется для Telegram Bot API |
| Без покупки домена | `*.vercel.app` / `*.railway.app` |

---

## 5. System Overview

```
Пользователь → Telegram → Webhook → Railway/Vercel → PostgreSQL (Neon/Railway)
                                        ↓
                                  Groq (primary)
                                  ↓ (fallback)
                              HuggingFace API
```

**Компоненты:**
- **Telegram Bot** — приём и отправка сообщений
- **Bot Handler** — логика чата, контекст, команды
- **Database** — история, состояние пользователей, summary
- **LLM Client** — Groq primary, HuggingFace fallback

---

## 6. Components

### 6.1 Bot Handler
- Webhook от Telegram
- Загрузка/сохранение истории из БД
- Формирование промпта: system prompt (роль + правила) + short summary + последние K сообщений
- Вызов LLM (Groq → HuggingFace fallback)
- Отправка ответа
- Команды: `/start`, `/help`, `/clear`, `/recap`, `/perspectives`, `/connect`
- **Ghost user protection:** `getChat` перед ответом

### 6.2 Database

**PostgreSQL на бесплатном hosted tier:**
- **Neon** — serverless Postgres, бесплатный tier (0.5 GB, 100 часов/мес)
- **Railway Postgres** — если доступен в free tier проекта Railway
- **Vercel Postgres** — на базе Neon, если деплоишь на Vercel

```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  telegram_id BIGINT PRIMARY KEY,
  username TEXT,
  last_active_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  summary TEXT
);
```

### 6.3 LLM Client

**Primary:** Groq (`https://api.groq.com/openai/v1/chat/completions`)  
**Fallback:** HuggingFace (`https://api-inference.huggingface.co/models/{model_id}`)

**Retry:** при 429 — retry через 10 сек; при 503 — fallback.

---

## 7. Data Flow

### 7.1 Happy Path
```
1. Пользователь отправляет сообщение
2. Bot Handler получает update
3. Проверка: is_active? getChat(chat_id)?
   - Если нет → inactive
4. Обновление last_active_at
5. Оценка размера контекста (summary + последние K сообщений). Ступенчатая логика: см. §10
6. Вызов LLM API
7. Сохранение ответа в БД
8. Отправка ответа пользователю
```

### 7.2 Обработка ошибок

| Сценарий | Обработка |
|---|---|
| Telegram API error (429) | Exponential backoff, retry 1-5 сек |
| Groq 429 | Retry через 10 сек |
| Groq 503 | Fallback на HuggingFace |
| HuggingFace 429/503 | Retry через 30 сек |
| БД недоступна | Fallback на кэш в памяти, логирование |
| Ghost user | `getChat` → inactive |

---

## 8. Доступные сервисы

| Сервис | Стоимость | SLA |
|---|---|---|
| **Railway / Vercel** | $0 | ~99.9% |
| **Groq** | $0 (1,000 req/day, 30 RPM) | Best effort |
| **HuggingFace** | $0 (fallback) | Best effort |
| **Telegram Bot API** | $0 | 99.9%+ |
| **PostgreSQL (Neon)** | $0 (бесплатный tier) | — |

**Итого: $0/месяц** на этапе MVP.

---

## 9. Безопасность и приватность

- История в БД (на MVP — минимум без шифрования; пользовательский ключ хранится отдельно)
- Ключи API в переменных окружения
- Логи не содержат текста сообщений

---

## 10. Экономия токенов

| Механизм | Реализация |
|---|---|
| **Summarization** | Старая история → краткое резюме; последние K → полный текст |
| **Smart truncation** | Удаление пустых строк, фраз |
| **`getChat` верификация** | Перед ответом. Если 400 → inactive, не тратить токены |
| **`last_active_at`** | Если > 48ч → не уведомлять |
| **Context monitoring** | Ступенчатое предупреждение: >80% мягкое, >95% жёсткое, >100% автоматический recap без спроса |
| **Смена темы** | При резком переходе на новую тему → предложить пользователю /recap для обновления краткого итога |
| **Ручной recap** | Команда /recap: суммаризация всей истории + сохранение краткого итога в users.summary + компактный активный контекст |

---

## 11. Масштабирование

**На MVP:**
- Railway + PostgreSQL (Neon free tier)
- Groq 1,000 req/day
- Telegram 30 msg/sec

**Если выросли за 100:**
- Upgrade Railway
- HuggingFace Pro / собственный сервер

---

## 12. Tradeoffs

| Решение | Плюс | Минус |
|---|---|---|
| Telegram Bot | Push, retention | Дополнительная точка отказа |
| Groq + HF fallback | $0, скорость | Два провайдера |
| Серверная БД | Синхронизация | Не 100% локально |
| Без auth | Простота | Любой с Telegram видит историю |
| /connect | User-funded LLM | Дополнительный friction |

---

## 13. Deploy

```
1. git push origin main
2. Railway/Vercel деплоит
3. Настройка webhook: POST https://<host>/webhook/telegram
4. Бот готов
```

**Deploy time:** < 2 минуты.

---

## 14. Прототип

**Файловая структура:**
```
thougts-reflector/
├── src/
│   ├── bot.js      (webhook, команды)
│   ├── db.js       (PostgreSQL)
│   ├── llm.js      (Groq / HF)
│   └── prompts.js  (system, perspectives, recap)
├── package.json / requirements.txt
└── .env.example
```

**Оценка:** 8-15 часов.

---

## 15. Открытые вопросы

| Вопрос | Кто решает |
|---|---|
| Какая модель на Groq? | Разработчик |
| Rate limits: достаточно? | Разработчик (после запуска) |
| Промпт терапевтической роли | Разработчик + психолог |
| Webhook vs Polling? | Разработчик |

---

## 16. Зависимости

```
GitHub → Railway/Vercel → Telegram Bot API → Groq (primary) / HuggingFace (fallback)
```

**Точки отказа:** Railway/Vercel, Telegram API, Groq, HuggingFace.

---

## 17. Сравнение с популярными ботами

Наш MVP следует стандартному паттерну Telegram Bot + LLM API (Groq primary / HuggingFace fallback) + hosted PostgreSQL, что максимально близко к архитектуре @Jarvis-ботов, но с добавлением ghost user protection, контекстной экономии токенов и мультидисциплинарного анализа.

---

## 18. Подводные камни

### Критические

**1. Telegram webhook duplicates**
- Дубликаты update_id → двойной LLM-вызов.
- Лечение: хранить последний `update_id` в памяти, игнорировать дубликаты.

**2. Ghost user detection ненадёжная**
- `getChat` 400 при закрытом приватности аккаунта → false-positive.
- Лечение: комбинировать с `last_active_at` > 30 дней.

**3. Cold-start Railway + Groq/HF**
- Railway: 5-30 сек. HF: 10-30 сек.
- Лечение: keepalive ping раз в 10 минут.

**4. HuggingFace rate limits при фоллбеке**
- ~300 req/hour. При массовом фоллбеке может сдохнуть быстрее Groq.
- Лечение: queue с задержкой 1.5 сек между retry.

### Средние

**5. Summarization quality**
- Модель может упустить важные детали → ответы become generic.
- Лечение: тонкая настройка summary prompt'а, ограничить summary 1-2 абзацами.

**6. No conversation branching**
- Резкая смена темы → summary неактуален → LLM путается.
- Лечение: при смене темы предложить /recap.

**7. Квоты Groq могут измениться**
- Лечение: мониторить лимиты, иметь HF fallback.

### Низкие

**8. Telegram Bot API limits**
- 30 msg/sec — для 100 users не критично.

**9. Без парольной защиты**
- Любой с доступом к Telegram видит историю. Для MVP нормально.

---

<div align="center">

*Telegram Bot + Groq (primary) / HuggingFace (fallback) + PostgreSQL + Railway/Vercel.  
Бюджет: $0. Следующий шаг: прототип.*

</div>
