Я работаю над проектом **Thoughts Reflector** — Telegram-бот, AI-компаньон по ментальному здоровью.

## Текущий статус
- Есть готовые требования: `D:\Projects\thougts-reflector\requirements.md`
- Есть готовые промпты: `D:\Projects\thougts-reflector\rompts.md`
- Есть готовый план разработки: `D:\Projects\thougts-reflector\dev-plan.md`
- Файловая структура проекта пока пустая, нужно создавать с нуля

## Архитектура
- **Telegram Bot** на Node.js или Python
- **Backend**: Railway / Vercel Serverless
- **LLM**: Groq primary (1,000 req/day, 30 RPM, 300+ TPS), HuggingFace fallback
- **БД**: PostgreSQL (Neon free tier 0.5 GB)
- **Бюджет**: $0
- **Масштаб**: до 100 пользователей

## Ключевые требования из `requirements.md`

### Functional Requirements (Must)
1. Мультидисциплинарная терапевтическая роль: КПТ/РЭПТ, психоанализ Хорни/теория привязанности, экзистенциальный/гуманистический (Ялом, Франкл, Роджерс), даос/буддизм/стоицизм, этология/эволюционная психология, социологический/системный (Гофман, Боуэн, Минухин)
2. Предвзятость, поиск психзащит и когнитивных искажений
3. По одному вопросу за ответ
4. Никаких рекомендаций и советов
5. Команда `/perspectives` — анализ проблемы с 6 подходов (КПТ, Хорни, экзистенциальный, даос/буддизм/стоицизм, этология, системный)
6. Команда `/recap` — краткий итог разговора, сохранение в users.summary
7. Ступенчатый контекст-мониторинг: >80% мягкое, >95% жёсткое, >100% автоматический recap
8. Ghost user protection: `getChat` перед ответом, `last_active_at`
9. Команда `/connect` — пользователь может предоставить свой API key (Groq/HF/Google)
10. Summarization buffer: старая история → резюме, последние K → полный текст

### Non-Functional Requirements
- Время ответа < 5 сек
- Доступность 99% (Railway/Vercel + Groq + Telegram)
- История в PostgreSQL
- HTTPS
- До 100 пользователей

### Ограничения
- $0 бюджет
- Один разработчик
- Беларусь: Telegram ✓, Railway/Vercel ✓, Groq ✓, HuggingFace ✓, OpenAI ✗
- Бэкенд обязателен
- Без покупки домена

## План разработки

Следуй плану из `D:\Projects\thougts-reflector\dev-plan.md` по этапам:

### Этап 1: Базовый бот и БД (2-3 часа)
- Инициализация проекта
- PostgreSQL подключение (Neon)
- Таблицы `messages`, `users`
- Webhook endpoint
- Команды: `/start`, `/help`, `/clear`
- Сохранение/загрузка сообщений

### Этап 2: LLM интеграция (1-2 часа)
- Groq API вызов с системным промптом
- HuggingFace fallback
- Retry логика (429 → 10 сек, 503 → fallback)
- Контекст: system prompt + последние K сообщений

### Этап 3: Контекст и суммаризация (1-2 часа)
- Summarization buffer
- Поле `users.summary`
- Контекст-мониторинг (>80%, >95%, >100%)
- Команда `/recap`
- Команда `/clear`

### Этап 4: Продвинутые команды (1-2 часа)
- Команда `/perspectives` — 6 подходов
- Команда `/connect` — пользовательский API key
- Ghost user protection: `getChat` перед ответом
- `last_active_at` обновление

### Этап 5: Деплой и финализация (1-2 часа)
- Деплой на Railway/Vercel
- Настройка webhook
- Переменные окружения
- Тестирование end-to-end
- Keepalive ping для Railway cold-start

## Выбор стека

Выбери оптимальный вариант и создай структуру src/:

**Вариант A: Node.js**
- `telegraf` — Telegram Bot framework
- `pg` — PostgreSQL клиент
- `node-fetch` или `axios` — HTTP клиент для Groq/HF

**Вариант B: Python**
- `aiogram` — Telegram Bot framework
- `asyncpg` — PostgreSQL клиент
- `httpx` — HTTP клиент для Groq/HF

## Файловая структура

```
thougts-reflector/
├── src/
│   ├── bot.js или bot.py      (webhook, команды)
│   ├── db.js или db.py        (PostgreSQL)
│   ├── llm.js или llm.py      (Groq / HF)
│   └── prompts.js или prompts.py  (system, perspectives, recap)
├── package.json или requirements.txt
└── .env.example
```

## Промпты из `rompts.md`

Используй промпты:
1. **System prompt** — мультидисциплинарная роль, правила
2. **Perspectives prompt** — анализ с 6 подходов
3. **Recap prompt** — краткий итог разговора
4. **New chat prompt** — после recap с users.summary

## Критерии готовности MVP

1. Бот отвечает на сообщения через Groq
2. История сохраняется в PostgreSQL
3. Команды `/start`, `/help`, `/clear`, `/recap`, `/perspectives`, `/connect` работают
4. Контекст-мониторинг работает (>80%, >95%, >100%)
5. Ghost user protection работает
6. HuggingFace fallback работает при ошибках Groq
7. Деплой на Railway/Vercel, webhook настроен
8. Время ответа < 5 сек
