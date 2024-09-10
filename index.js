import { Telegraf } from 'telegraf';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Your bot token
const bot = new Telegraf("7401919847:AAG6AWqYjFvfjcE9dJWGLXm2YvXz5QXbI3s");

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// List of required channels with their names
const requiredChannels = [
  { username: '@fabedevjournal', name: "Fabe's Dev Journal" },
  { username: '@fabe_crypto', name: 'Fabe Crypto' },
  { username: '@fabemovies', name: 'Fabe Movies' }
];

// Helper function to capitalize and take the first two letters of each name
function formatName(name) {
  return name.slice(0, 2).toUpperCase(); // Take the first two letters and capitalize
}

// Helper function to create the URL from the input data
function createVerificationUrl(fullName, rollNumber) {
  const [firstName, middleName, lastName] = fullName.split(' ');

  if (!firstName || !lastName) {
    throw new Error('Full name must include at least a first name and a last name');
  }

  const formattedFirstName = formatName(firstName);
  const formattedLastName = formatName(lastName);
  const formattedMiddleName = middleName ? formatName(middleName) : '';

  // Construct the URL with only the first two letters concatenated
  return `https://verify.eaes.et/temporary/${formattedFirstName}${formattedLastName}${formattedMiddleName}=${rollNumber}`;
}

// Helper function to check if user is a member of all required channels
async function checkMembership(ctx) {
  for (const channel of requiredChannels) {
    try {
      const chatMember = await ctx.telegram.getChatMember(channel.username, ctx.from.id);
      if (chatMember.status !== 'member' && chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
        return false;
      }
    } catch (error) {
      console.error(`Error checking membership for ${channel.username}: ${error.message}`);
      return false;
    }
  }
  return true;
}

// Create the inline keyboard with buttons for each required channel
function createChannelButtons() {
  return requiredChannels.map(channel => ({
    text: channel.name,
    url: `https://t.me/${channel.username.slice(1)}` // Remove '@' from the username
  }));
}

// Handle "/start" command
bot.start(async (ctx) => {
  if (await checkMembership(ctx)) {
    ctx.reply('Welcome! Please enter your full name and roll number in the format: "FirstName MiddleName LastName, RollNumber"');
  } else {
    ctx.reply('You must join the following channels to use this bot:', {
      reply_markup: {
        inline_keyboard: [
          createChannelButtons()
        ]
      }
    });
  }
});

// Handle message input
bot.on('text', async (ctx) => {
  if (!await checkMembership(ctx)) {
    return ctx.reply('You must join the following channels to use this bot:', {
      reply_markup: {
        inline_keyboard: [
          createChannelButtons()
        ]
      }
    });
  }

  try {
    const [fullName, rollNumber] = ctx.message.text.split(',').map((part) => part.trim());
    if (!fullName || !rollNumber) {
      throw new Error('Invalid input. Please provide your full name and roll number in the correct format.');
    }

    const url = createVerificationUrl(fullName, rollNumber);
    ctx.reply(`Accessing verification site...`);

    // Fetch the PDF from the URL
    const response = await fetch(url);
    if (response.ok) {
      const buffer = await response.buffer();

      // Ensure the "files" directory exists
      const filesDir = path.join(__dirname, 'files');
      if (!fs.existsSync(filesDir)) {
        fs.mkdirSync(filesDir);
      }

      // Save the PDF in the "files" directory
      const pdfPath = path.join(filesDir, `${rollNumber}.pdf`);
      fs.writeFileSync(pdfPath, buffer);

      // Send the PDF to the user
      await ctx.replyWithDocument({ source: pdfPath });

      // Clean up: Remove the saved PDF file after sending it
      fs.unlinkSync(pdfPath);
    } else {
      ctx.reply(`Failed to access the verification site. Please check your details.`);
    }
  } catch (error) {
    ctx.reply(`Error: ${error.message}`);
  }
});

// Start the bot
bot.launch();

console.log('Bot is running...');
