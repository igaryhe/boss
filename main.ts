import { startBot } from "./deps.ts";
import { commands, registerCommands } from "./commands.ts";

startBot({
  token: Deno.env.get("BOT_TOKEN")!,
  intents: ["Guilds", "GuildMessages", "DirectMessages"],
  eventHandlers: {
    async ready() {
      console.log("ready");
      await registerCommands(811924657426399253n);
    },
    interactionCreate(interaction) {
      const command = interaction.data?.name;
      const pair = commands.get(command!);
      if (pair !== undefined) {
        commands.get(command!)?.dispatch(interaction);
      }
    },
  },
});