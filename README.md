# Thoughts Reflector

Telegram bot — AI companion for mental health. Multi-disciplinary therapeutic role.

## MVP Features
- `/start` — начало работы
- `/help` — справка
- `/clear` — очистка истории
- `/recap` — краткий итог разговора
- `/perspectives` — анализ с 6 подходов
- `/connect` — пользовательский API key

## Tech Stack
- Node.js + Telegraf
- PostgreSQL (Neon)
- Groq (primary) / HuggingFace (fallback)

## Setup
1. `npm install`
2. Configure `.env` from `.env.example`
3. `npm start`

## Deploy
Railway/Vercel with webhook.