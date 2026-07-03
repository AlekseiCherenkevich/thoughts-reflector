# Thoughts Reflector — Development Plan

## Проект

Telegram-бот — AI-компаньон по ментальному здоровью. Мультидисциплинарный анализ (КПТ, психоанализ Хорни, экзистенциальный/гуманистический, даос/буддизм/стоицизм, этология, социологический/системный). Предвзятость, поиск психзащит и когнитивных искажений. По одному вопросу за ответ. Никаких рекомендаций и советов.

- Бюджет: $0
- До 100 пользователей
- Бэкенд: Node.js или Python
- БД: PostgreSQL (Neon free tier)
- LLM: Groq primary, HuggingFace fallback

## Файлы проекта

- `D:\Projects\thougts-reflector\requirements.md` — системный дизайн
- `D:\Projects\thougts-reflector\rompts.md` — промпты для LLM

## План разработки

### Этап 1: Базовый бот и БД (2-3 часа)

**Задачи:**
1. Инициализировать проект (package.json / requirements.txt)
2. Настроить подключение к PostgreSQL (Neon)
3. Создать таблицы: `messages`, `users`
4. Реализовать webhook endpoint (`POST /webhook/telegram`)
5. Обработать команды: `/start`, `/help`, `/clear`
6. Сохранять/загружать сообщения из БД

**Проверка:** бот отвечает на `/start`, сохраняет сообщения в БД.

---

### Этап 2: LLM интеграция (1-2 часа)

**Задачи:**
1. Реализовать вызов Groq API с системным промптом
2. Подключить HuggingFace fallback
3. Реализовать retry логику (429 → 10 сек, 503 → fallback)
4. Добавить контекст: system prompt + последние K сообщений

**Проверка:** бот отвечает через Groq, при 503 переключается на HF.

---

### Этап 3: Контекст и суммаризация (1-2 часа)

**Задачи:**
1. Реализовать summarization buffer: старая история → краткое резюме
2. Добавить поле `users.summary`
3. Реализовать контекст-мониторинг (>80%, >95%, >100%)
4. Команда `/recap` — суммаризация всей истории
5. Команда `/clear` — полная очистка

**Проверка:** при 80% контекста бот предупреждает, `/recap` генерирует summary.

---

### Этап 4: Продвинутые команды (1-2 часа)

**Задачи:**
1. Команда `/perspectives` — анализ с 6 подходов
2. Команда `/connect` — пользовательский API key
3. Ghost user protection: `getChat` перед ответом
4. Обновление `last_active_at` при каждом сообщении

**Проверка:** `/perspectives` возвращает анализ, `/connect` сохраняет ключ, ghost user помечается inactive.

---

### Этап 5: Деплой и финализация (1-2 часа)

**Задачи:**
1. Деплой на Railway/Vercel
2. Настройка webhook в Telegram
3. Настройка переменных окружения
4. Тестирование end-to-end
5. Добавить keepalive ping для Railway cold-start

**Проверка:** бот работает в Telegram, отвечает < 5 сек, fallback работает.

---

## Технические решения

### Стек

**Node.js:**
- `telegraf` — Telegram Bot framework
- `pg` — PostgreSQL клиент
- `node-fetch` или `axios` — HTTP клиент для Groq/HF

**Python:**
- `aiogram` — Telegram Bot framework
- `asyncpg` — PostgreSQL клиент
- `httpx` — HTTP клиент для Groq/HF

### Переменные окружения

```
TELEGRAM_BOT_TOKEN=
GROQ_API_KEY=
GROQ_MODEL=
HUGGINGFACE_API_KEY=
HUGGINGFACE_MODEL=
DATABASE_URL=
```

### PostgreSQL schema

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

## Критерии готовности MVP

1. Бот отвечает на сообщения через Groq
2. История сохраняется в PostgreSQL
3. Команды `/start`, `/help`, `/clear`, `/recap`, `/perspectives`, `/connect` работают
4. Контекст-мониторинг работает (>80%, >95%, >100%)
5. Ghost user protection работает
6. HuggingFace fallback работает при ошибках Groq
7. Деплой на Railway/Vercel, webhook настроен
8. Время ответа < 5 сек

## Приоритеты

1. **Сначала:** бот отвечает, сохраняет историю, работает webhook
2. **Потом:** суммаризация, /recap, контекст-мониторинг
3. **В конце:** /perspectives, /connect, ghost user protection
