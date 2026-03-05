require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const axios = require('axios')
const fs = require('fs');
const giveupImg = fs.readFileSync('./giveup.jpg');
const winImg = fs.readFileSync('./win.jpg');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true })

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'meta-llama/llama-3.3-70b-instruct:free'

console.log('Бот "Угадай число" с ИИ запущен')

const games = {}

function getMenu(chatId) {
  return {
    reply_markup: {
      keyboard: [[games[chatId] ? { text: 'Сдаться' } : { text: 'Начать игру' }]],
      resize_keyboard: true,
    },
  }
}

bot.on('message', async (msg) => {
  if (!msg.text) return

  const chatId = msg.chat.id
  const text = msg.text.toLowerCase().trim()

  if (text === '/start' || text === 'привет') {
    bot.sendMessage(
      chatId,
      `Привет, ${msg.chat.first_name}!
Я загадаю число от 1 до 100. А ты попробуй угадать!`,
      getMenu(chatId)
    )
    return
  }

  if (text === 'начать игру') {
    games[chatId] = {
      number: Math.floor(Math.random() * 100) + 1,
      attempts: 0,
    }

    bot.sendMessage(
      chatId,
      'Я загадал число от 1 до 100. Поехали 🚀',
      getMenu(chatId)
    )
    return
  }

  if (text === 'сдаться') {
    if (!games[chatId]) {
      bot.sendMessage(chatId, 'Игра ещё не началась, нажми "Начать игру"', getMenu(chatId))
      return
    }

    bot.sendPhoto(
      chatId,
      giveupImg,
      { caption: `Ты сдался. Это печально. Моё число было ${games[chatId].number}`,
        reply_markup: getMenu(chatId).reply_markup }
    )

    delete games[chatId]
    return
  }


  if (!games[chatId]) {
    bot.sendMessage(chatId, 'Нажми «Начать игру»', getMenu(chatId))
    return
  }

  const guess = parseInt(text)
  if (isNaN(guess) || guess < 1 || guess > 100) {
    bot.sendMessage(chatId, 'Введи число от 1 до 100', getMenu(chatId))
    return
  }

  games[chatId].attempts++
  const { number, attempts } = games[chatId]

  if (guess < number) {
    bot.sendMessage(chatId, `Моё число больше чем ${guess}`, getMenu(chatId))
    return
  }

  if (guess > number) {
    bot.sendMessage(chatId, `Моё число меньше чем ${guess}`, getMenu(chatId))
    return
  }

  const percent = Math.max(
    5,
    Math.min(95, 100 - attempts * 8)
  )

  bot.sendPhoto(chatId, winImg, { caption: 'Ты угадал! Считаю твою статистику...' })

  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: `Игрок угадал число за ${attempts} попыток.
Напиши короткое дружелюбное сообщение:
- сколько попыток
- что он умнее чем примерно ${percent}% людей
- стиль: лёгкий, немного шутливый
- 2–3 предложения`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const aiText =
      response.data.choices[0].message.content

    bot.sendMessage(chatId, aiText, getMenu(chatId))
  } catch (err) {
    bot.sendMessage(
      chatId,
      `Ты угадал за ${attempts} попыток!
Это лучше, чем у ${percent}% игроков`,
      getMenu(chatId)
    )
  }

  delete games[chatId]
})
