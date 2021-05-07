import {
  ApplicationCommandInteractionDataOptionUser,
  cache,
  createSlashCommand,
  DiscordApplicationCommandOptionTypes,
  Embed,
  EmbedField,
  Interaction,
  sendDirectMessage,
  getSlashCommands,
  sendInteractionResponse,
  DiscordInteractionResponseTypes
} from "./deps.ts";
import { Game, Location, Role } from "./game.ts";
import { roles } from "./config.ts";
import { Dispatcher, Next } from "./middleware.ts";

let game: Game | undefined = undefined;

export const commands: Map<string, Dispatcher<Interaction>> = new Map();

commands.set("start", new Dispatcher<Interaction>(checkTextChannel, start));
commands.set("stop", new Dispatcher<Interaction>(checkGame, stop));
commands.set("restart", new Dispatcher<Interaction>(checkGame, restart));
commands.set("assign", new Dispatcher<Interaction>(checkGame, assign));
commands.set(
  "reveal",
  new Dispatcher<Interaction>(checkGame, checkPlayer, reveal),
);
// commands.set("timer", new Dispatcher<Interaction>(argLength, timer));
commands.set("history", new Dispatcher<Interaction>(checkGame, history));
commands.set("goto", new Dispatcher<Interaction>(checkGame, checkPlayer, goto));
commands.set(
  "barrier",
  new Dispatcher<Interaction>(checkGame, checkPlayer, checkPolice, barrier),
);

function checkGame(interaction: Interaction, next: Next) {
  if (game == undefined) {
    response(interaction, "You need to start the game first.");
  } else if (interaction.channelId != game?.channel.toString()) {
    response(interaction, "You are in the wrong channel.");
  } else return next();
}

function checkTextChannel(interaction: Interaction, next: Next) {
  if (interaction.user !== undefined) {
    response(interaction, "You are not in a guild channel.");
  } else return next();
}

function checkPlayer(interaction: Interaction, next: Next) {
  const player = game?.players.get(interaction.member!.user.id);
  if (player == undefined) {
    response(interaction, "You are not in the game right now");
  } else return next();
}

function checkPolice(interaction: Interaction, next: Next) {
  if (
    game?.players.get(interaction.member!.user.id)?.role ===
      Role.Police
  ) {
    return next();
  } else response(interaction, "You are not the police.", true);
}

function start(interaction: Interaction, next: Next) {
  game = new Game(BigInt(interaction.channelId));
  response(interaction, "Please assign roles to players");
  return next();
}

function stop(interaction: Interaction, next: Next) {
  game = undefined;
  response(interaction, "The game is stopped.");
  return next();
}

function restart(interaction: Interaction, next: Next) {
  game = new Game(BigInt(interaction.channelId));
  response(interaction, "Please assign roles to players");
  return next();
}

function assign(interaction: Interaction, next: Next) {
  const assigns = shuffle(roles);
  let i = 0;
  let result = "";
  interaction.data?.options?.forEach((option) => {
    const user = option as ApplicationCommandInteractionDataOptionUser;
    sendDirectMessage(user.value, `You are the ${Role[assigns[i]]}`);
    game?.addPlayer(user.value.toString(), assigns[i]);
    if (assigns[i] == Role.Boss) {
      result += `<@${user.value}> is the Boss.\n`;
    }
    if (assigns[i] == Role.Police) {
      result += `<@${user.value}> is the Police.\n`;
    }
    i++;
  });
  response(interaction, result);
  return next();
}

function goto(interaction: Interaction, next: Next) {
  const player = game?.players.get(interaction.member!.user.id);
  const arg = interaction.data?.options![0].value as string;
  player?.goto(<Location> arg);
  response(interaction, `You are in ${arg} right now`, true);
  return next();
}

function reveal(interaction: Interaction, next: Next) {
  const embed: Embed = { title: "Result", description: "" };
  const fields: EmbedField[] = [];
  let caught = false;
  let bossLoc: Location | undefined = undefined;

  game?.updateHistory();

  game?.players.forEach((player) => {
    if (player.role === Role.Boss) bossLoc = player.location;
    fields.push({
      name: `${roleEmoji(player.role)} ${cache.members.get(BigInt(player.user))
        ?.username}`,
      value: `${locationEmoji(player.location!)} ${player.location}`,
      inline: true,
    });
  });

  game?.players.forEach((player) => {
    if (player.location !== bossLoc) return;
    if (player.role === Role.Police) caught = true;
    else if (player.role === Role.Member || player.role === Role.Traitor) {
      if (player.location !== game?.barrier) game!.visits += 1;
    }
  });

  fields.push({ name: "visits", value: `${game?.visits}`, inline: true });

  if (caught) embed.description = "The boss is caught by the police\n";
  else if (game!.history.length <= 3 && game!.visits >= 4) {
    embed.description = "The boss successfully escaped\n";
  } else if (game!.history.length == 3 && game!.visits < 4) {
    embed.description = "The boss failed to escape\n";
  }

  if (game?.barrier !== undefined) {
    game!.hasSetBarrier = true;
    game!.barrier = undefined;
    embed.description += `The barrier is set at ${game.barrier}`;
  }

  embed.fields = fields;
  responseEmbed(interaction, embed);

  return next();
}

/*
function timer(interaction: Interaction, next: Next) {
  const timerCount = parseInt(ctx.args[0]);
  timerEx(timerCount, ctx.message);
  return next();
}
*/

function history(interaction: Interaction, next: Next) {
  const embeds: Embed[] = [];
  if (game?.history.length) {
    let round = 1;
    game.history.forEach((players) => {
      const embed: Embed = { title: `Round ${round}`, description: "" };
      const fields: EmbedField[] = [];
      players.forEach((player) =>
        fields.push({
          name: `${roleEmoji(player.role)} ${
            cache.members.get(BigInt(player.user))
          }`,
          value: `${locationEmoji(player.location!)} ${player.location}`,
        })
      );
      fields.push({ name: "visits", value: `${game?.visits}`, inline: true });
      embed.fields = fields;
      embeds.push(embed);
      round++;
    });
    responseEmbeds(interaction, embeds);
    return next();
  } else response(interaction, "No history.");
}

function barrier(interaction: Interaction, next: Next) {
  const arg = interaction.data?.options![0];
  if (!game?.hasSetBarrier) {
    game!.barrier = <Location> (arg?.value as string);
    response(interaction, `You've set a barrier in ${arg?.value}`, true);
    return next();
  } else response(interaction, "You've already used the barrier.");
}

export async function registerCommands(guildID: bigint) {
  const options = [];
  for (let i = 0; i != roles.length; i++) {
    options.push({
      type: DiscordApplicationCommandOptionTypes.User,
      name: `player${i + 1}`,
      description: `player${i + 1}`,
      required: true,
    });
  }
  await createSlashCommand({
    name: "assign",
    description: "assign roles to players",
    options: options,
  }, guildID);
  await createSlashCommand({
    name: "start",
    description: "start the game",
  }, guildID);
  await createSlashCommand({
    name: "stop",
    description: "stop the game",
  }, guildID);
  await createSlashCommand({
    name: "restart",
    description: "restart the game",
  }, guildID);
  await createSlashCommand({
    name: "reveal",
    description: "reveal everyone's location",
  }, guildID);
  await createSlashCommand({
    name: "history",
    description: "show locations & scores of the game",
  }, guildID);
  await createSlashCommand({
    name: "goto",
    description: "set location",
    options: [{
      type: DiscordApplicationCommandOptionTypes.String,
      name: "location",
      description: "a location you would like to go",
      required: true,
      choices: [
        { name: "airport", value: "airport" },
        { name: "bar", value: "bar" },
        { name: "casino", value: "casino" },
        { name: "hotel", value: "hotel" },
        { name: "villa", value: "villa" },
      ],
    }],
  }, guildID);
  await createSlashCommand({
    name: "barrier",
    description: "set barrier",
    options: [{
      type: DiscordApplicationCommandOptionTypes.String,
      name: "location",
      description: "a location you would like set the barrier",
      required: true,
      choices: [
        { name: "airport", value: "airport" },
        { name: "bar", value: "bar" },
        { name: "casino", value: "casino" },
        { name: "hotel", value: "hotel" },
        { name: "villa", value: "villa" },
      ],
    }],
  }, guildID);
  console.log(await getSlashCommands(guildID));
}

// helper functions
function shuffle(array: Array<Role>) {
  let currentIndex = array.length, temporaryValue, randomIndex;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

function response(interaction: Interaction, message: string, priv = false) {
  sendInteractionResponse(
    BigInt(interaction.id),
    interaction.token,
    {
      type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
      data: { content: message },
      private: priv,
    },
  );
}

function responseEmbed(interaction: Interaction, embed: Embed) {
  sendInteractionResponse(
    BigInt(interaction.id),
    interaction.token,
    {
      type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
      data: { embeds: [embed] },
    },
  );
}

function responseEmbeds(interaction: Interaction, embeds: Embed[]) {
  sendInteractionResponse(
    BigInt(interaction.id),
    interaction.token,
    {
      type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
      data: { embeds: embeds },
    },
  );
}

function roleEmoji(role: Role): string {
  switch (role) {
    case Role.Boss:
      return ":eye:";
    case Role.Police:
      return ":cowboy:";
    case Role.Member:
      return ":spy:";
    case Role.Traitor:
      return ":spy:";
  }
}

function locationEmoji(location: Location): string {
  switch (location) {
    case Location.Airport:
      return ":airplane_departure:";
    case Location.Bar:
      return ":beers:";
    case Location.Casino:
      return ":slot_machine:";
    case Location.Hotel:
      return ":hotel:";
    case Location.Villa:
      return ":house:";
  }
}

/*
function timerEx(timerCount: number, message: Message) {
  message.send(`${timerCount} seconds remain.`);
  if (timerCount > 30) {
    setTimeout(timerEx, 30000, timerCount - 30, message);
  } else if (timerCount <= 30 && timerCount > 10) {
    setTimeout(timerEx, 10000, timerCount - 10, message);
  } else if (timerCount <= 10 && timerCount > 0) {
    setTimeout(timerEx, 2000, timerCount - 2, message);
  } else {
    // reveal
  }
}
*/