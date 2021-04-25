import { startBot } from './deps.ts';
import { commands } from './commands.ts';
import { prefix } from './config.ts';

startBot({
  token: Deno.env.get("BOT_TOKEN")!,
  intents: ["GUILDS", "GUILD_MESSAGES", "DIRECT_MESSAGES"],
  eventHandlers: {
    ready() {
      console.log("ready");
    },
    messageCreate(message) {
      if (!message.content.startsWith(prefix) || message.author.bot) return;
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const command = args.shift()?.toLowerCase()!;
      if (!commands.has(command)) return;
      try {
        commands.get(command)?.dispatcher.dispatch({message, args});
      } catch (error) {
        console.error(error);
        message.reply('there was an error trying to execute that command!');
      }
    },
  },
});