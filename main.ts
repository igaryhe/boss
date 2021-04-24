import { startBot } from "https://deno.land/x/discordeno/mod.ts";
import { commands } from "./commands.ts";

const prefix = '!';

startBot({
  token: Deno.env.get("BOT_TOKEN") as string,
  intents: ["GUILDS", "GUILD_MESSAGES", "DIRECT_MESSAGES"],
  eventHandlers: {
    ready() {
      console.log("ready");
    },
    messageCreate(message) {
      if (!message.content.startsWith(prefix) || message.author.bot) return;
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      const command = args.shift()?.toLowerCase() as string;
      if (!commands.has(command)) return;
      try {
        commands.get(command)?.execute(message, args);
      } catch (error) {
        console.error(error);
        message.reply('there was an error trying to execute that command!');
      }
    },
  },
});