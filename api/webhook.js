const axios = require('axios');
const { Telegraf } = require('telegraf');
const { initDB, saveMessage, getMessages, clearMessages, getUser, upsertUser, updateUserSummary } = require('../src/db');
const { callLLM } = require('../src/llm');
const { SYSTEM_PROMPT, PERSPECTIVES_PROMPT, RECAP_PROMPT, NEW_CHAT_PROMPT } = require('../src/prompts');

const TOKENS_PER_MESSAGE = 1500;
const MODEL_CONTEXT_LIMIT = 8000;
let lastUpdateId = 0;

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.use((ctx, next) => {
  if (ctx.update?.update_id && ctx.update.update_id <= lastUpdateId) {
    return;
  }
  if (ctx.update?.update_id) {
    lastUpdateId = ctx.update.update_id;
  }
  return next();
});

bot.start(async (ctx) => {
  const user = await getUser(ctx.from.id);
  const welcomeMessage = user?.summary 
    ? `${NEW_CHAT_PROMPT(user.summary)}\n\nНапиши о том, что на душе.`
    : `Привет. Я — Thoughts Reflector, AI-компаньон по ментальному здоровью.\n\nЯ задаю вопросы, помогая глубже понять мысли и эмоции. Никаких советов — только рефлексия.\n\nКоманды:\n/help — справка\n/clear — очистить историю\n/recap — краткий итог разговора\n/perspectives — анализ с 6 подходов\n/connect — подключить свой API key`;
  await ctx.reply(welcomeMessage);
  await upsertUser(ctx.from.id, ctx.from.username);
});

bot.help((ctx) => {
  return ctx.reply(`Команды:\n/start — начать/перезагрузить\n/help — справка\n/clear — очистить историю\n/recap — краткий итог разговора\n/perspectives — анализ с 6 подходов\n/connect — подключить свой API key (Groq/HF)`);
});

bot.command('clear', async (ctx) => {
  await clearMessages(ctx.chat.id);
  await updateUserSummary(ctx.from.id, null);
  await ctx.reply('История очищена.');
});

bot.command('recap', async (ctx) => {
  const messages = await getMessages(ctx.chat.id, 100);
  if (messages.length === 0) {
    return ctx.reply('История пуста.');
  }

  const history = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
  const recapMessages = [
    { role: 'system', content: RECAP_PROMPT },
    { role: 'user', content: history }
  ];

  try {
    const recap = await callLLM(recapMessages);
    await updateUserSummary(ctx.from.id, recap);
    await ctx.reply(`Краткий итог:\n\n${recap}`);
  } catch (error) {
    console.error('Recap error:', error);
    await ctx.reply('Не удалось создать итог. Попробуйте позже.');
  }
});

bot.command('perspectives', async (ctx) => {
  const messages = await getMessages(ctx.chat.id, 50);
  if (messages.length === 0) {
    return ctx.reply('Сначала нужно поговорить хотя бы о чём-то.');
  }

  const userName = ctx.from?.username || ctx.from?.first_name || 'пользователь';
  const userQuery = `Проблема пользователя @${userName}: ${messages.map(m => m.content).join(' ').slice(0, 500)}`;
  
  const perspectiveMessages = [
    { role: 'system', content: PERSPECTIVES_PROMPT },
    { role: 'user', content: userQuery }
  ];

  try {
    const result = await callLLM(perspectiveMessages);
    await ctx.reply(result);
  } catch (error) {
    console.error('Perspectives error:', error);
    await ctx.reply('Не удалось выполнить анализ. Попробуйте позже.');
  }
});

bot.command('connect', async (ctx) => {
  await ctx.reply('Команда /connect будет реализована на Этапе 4. Скоро.');
});

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const telegramId = ctx.from.id;
  const text = ctx.message.text;

  try {
    const check = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getChat`, {
      chat_id: chatId
    });
    
    if (!check.data.ok) {
      console.log(`Ghost user detected: ${telegramId}`);
      return;
    }
  } catch {
    return;
  }

  await upsertUser(telegramId, ctx.from?.username, true);
  await saveMessage(chatId, 'user', text);

  const messages = await getMessages(chatId, 15);
  const contextSize = messages.length * TOKENS_PER_MESSAGE;
  
  let warning = null;
  if (contextSize > MODEL_CONTEXT_LIMIT * 0.8 && contextSize <= MODEL_CONTEXT_LIMIT * 0.95) {
    warning = '⚠️ Контекст почти заполнен. Используйте /recap для очистки.';
  } else if (contextSize > MODEL_CONTEXT_LIMIT * 0.95) {
    warning = '🚨 Контекст почти исчерпан. Автоматический /recap...';
    const allMessages = await getMessages(chatId, 100);
    const recapMessages = [
      { role: 'system', content: RECAP_PROMPT },
      { role: 'user', content: allMessages.map(m => `${m.role}: ${m.content}`).join('\n\n') }
    ];
    try {
      const recap = await callLLM(recapMessages);
      await updateUserSummary(telegramId, recap);
    } catch (e) {
      console.error('Auto recap error:', e);
    }
  }

  const llmMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map(m => ({ role: m.role, content: m.content }))
  ];

  try {
    const response = await callLLM(llmMessages);
    await saveMessage(chatId, 'assistant', response);
    
    if (warning) {
      await ctx.reply(`${response}\n\n${warning}`);
    } else {
      await ctx.reply(response);
    }
  } catch (error) {
    console.error('LLM error:', error);
    await ctx.reply('Извините, сейчас я не могу ответить. Попробуйте позже.');
  }
});

let dbInitialized = false;

module.exports = async function handler(req, res) {
  if (!dbInitialized) {
    await initDB().catch(console.error);
    dbInitialized = true;
  }
  
  if (req.method === 'POST') {
    await bot.handleUpdate(req.body);
    res.status(200).end('OK');
  } else {
    res.status(200).send('Thoughts Reflector bot is running');
  }
};