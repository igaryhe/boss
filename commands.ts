import {
  DiscordApplicationCommandOptionTypes,
  DiscordenoInteractionResponse,
  DiscordInteractionResponseTypes,
  Embed,
  EmbedField,
  Interaction,
} from "./deps.ts";
import { Game, Location, Role } from "./game.ts";
import { roles } from "./config.ts";
import { Dispatcher, Next } from "./middleware.ts";
import { sendFollowup, updateCommands } from "./rest.ts";

let game: Game | undefined = undefined;
let gameRoles: Role[] = [];

export let res: DiscordenoInteractionResponse | undefined = undefined;

export const commands: Map<string, Dispatcher<Interaction>> = new Map();
commands.set("start", new Dispatcher<Interaction>(checkTextChannel, start));
commands.set("stop", new Dispatcher<Interaction>(checkGame, stop));
commands.set("restart", new Dispatcher<Interaction>(checkGame, start));
commands.set(
  "join",
  new Dispatcher<Interaction>(
    checkGame,
    checkPlayerCount,
    checkPlayerJoined,
    join,
  ),
);
commands.set(
  "reveal",
  new Dispatcher<Interaction>(
    checkGame,
    checkPlayer,
    checkEnoughPlayer,
    reveal,
  ),
);
commands.set("history", new Dispatcher<Interaction>(checkGame, history));
commands.set("goto", new Dispatcher<Interaction>(checkGame, checkPlayer, goto));
commands.set(
  "barrier",
  new Dispatcher<Interaction>(checkGame, checkPlayer, checkPolice, barrier),
);

function checkGame(interaction: Interaction, next: Next) {
  if (game == undefined) {
    res = response("You need to start the game first.", true);
  } else if (interaction.channelId != game?.channel.toString()) {
    res = response("You are in the wrong channel.", true);
  } else return next();
}

function checkTextChannel(interaction: Interaction, next: Next) {
  if (interaction.user === undefined) return next();
  res = response("You are not in a guild channel");
}

function checkPlayer(interaction: Interaction, next: Next) {
  if (game?.players.has(interaction.member?.user.id!)) return next();
  res = response("You are not in the game right now", true);
}

function checkPlayerCount(_interaction: Interaction, next: Next) {
  if (game!.players.size < roles.length) return next();
  res = response("5 players have joined the game", true);
}

function checkEnoughPlayer(_: Interaction, next: Next) {
  if (game?.players.size === roles.length) return next();
  res = response("Not enough players");
}

function checkPlayerJoined(interaction: Interaction, next: Next) {
  if (!game?.players.has(interaction.member?.user.id!)) return next();
  res = response("You've already joined the game", true);
}

function checkPolice(interaction: Interaction, next: Next) {
  const player = game?.players.get(interaction.member!.user.id);
  if (player?.role !== Role.Police) return next();
  res = response("You are not the Police", true);
}

function start(interaction: Interaction, _next: Next) {
  game = new Game(BigInt(interaction.channelId));
  gameRoles = shuffle(roles);
  res = response("Players could join the game now");
}

function stop(_interaction: Interaction, _next: Next) {
  game = undefined;
  gameRoles = [];
  res = response("The game is stopped");
}

function join(interaction: Interaction, _next: Next) {
  const user = interaction.member?.user;
  const role = gameRoles.shift()!;
  game?.addPlayer(user?.id!, role);
  if (role == Role.Boss) {
    res = response(`<@${user?.id}> is the Boss ${roleEmoji(role)}`);
  } else if (role == Role.Police) {
    res = response(`<@${user?.id}> is the Police ${roleEmoji(role)}`);
  } else {
    res = response(`<@${user?.id}> joined the game`);
    sendFollowup(
      interaction.token,
      `You are the ${Role[role]} ${roleEmoji(role)}`,
    );
  }
}

function goto(interaction: Interaction, _next: Next) {
  const player = game?.players.get(interaction.member!.user.id);
  const arg = interaction.data?.options![0].value as string;
  if (player?.name === undefined) {
    player!.name = interaction.member?.user.username;
  }
  player?.goto(<Location> arg);
  res = response(`You are in ${arg} right now`, true);
}

function reveal(_interaction: Interaction, _next: Next) {
  const embed: Embed = { title: "Result", description: "" };
  const fields: EmbedField[] = [];
  let caught = false;
  let bossLoc: Location | undefined = undefined;

  game?.updateHistory();

  game?.players.forEach((player) => {
    if (player.role === Role.Boss) bossLoc = player.location;
    fields.push({
      name: `${roleEmoji(player.role)} ${player.name}`,
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

  fields.push({ name: "visits", value: `${game?.visits}` });

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
  res = responseEmbed(embed);
}

function history(_interaction: Interaction, _next: Next) {
  const embeds: Embed[] = [];
  if (game?.history.length) {
    let round = 1;
    game.history.forEach((players) => {
      const embed: Embed = { title: `Round ${round}`, description: "" };
      const fields: EmbedField[] = [];
      players.forEach((player) =>
        fields.push({
          name: `${roleEmoji(player.role)} ${player.name}`,
          value: `${locationEmoji(player.location!)} ${player.location}`,
        })
      );
      fields.push({ name: "visits", value: `${game?.visits}`, inline: true });
      embed.fields = fields;
      embeds.push(embed);
      round++;
    });
    res = responseEmbeds(embeds);
  } else res = response("No history.");
}

function barrier(interaction: Interaction, _next: Next) {
  const arg = interaction.data?.options![0];
  if (!game?.hasSetBarrier) {
    game!.barrier = <Location> (arg?.value as string);
    res = response(`You've set a barrier in ${arg?.value}`, true);
  } else res = response("You've already used the barrier", true);
}

const choices = [
  { name: "airport", value: "airport" },
  { name: "bar", value: "bar" },
  { name: "casino", value: "casino" },
  { name: "hotel", value: "hotel" },
  { name: "villa", value: "villa" },
];

export async function registerCommands(guildID: bigint) {
  await updateCommands([
    { name: "join", description: "Join the game" },
    { name: "start", description: "start the game" },
    { name: "stop", description: "stop the game" },
    { name: "restart", description: "restart the game" },
    { name: "reveal", description: "reveal everyone's location" },
    { name: "history", description: "show locations & scores of the game" },
    {
      name: "goto",
      description: "set location",
      options: [{
        type: DiscordApplicationCommandOptionTypes.String,
        name: "location",
        description: "a location you would like to go",
        required: true,
        choices: choices,
      }],
    },
    {
      name: "barrier",
      description: "set barrier",
      options: [{
        type: DiscordApplicationCommandOptionTypes.String,
        name: "location",
        description: "a location you would like set the barrier",
        required: true,
        choices: choices,
      }],
    },
  ], guildID);
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

function response(
  message: string,
  priv = false,
): DiscordenoInteractionResponse {
  const res: DiscordenoInteractionResponse = {
    type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
    data: { content: message },
  };
  if (priv) res.data!.flags = 64;
  return res;
}

function responseEmbed(embed: Embed) {
  return {
    type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
    data: { embeds: [embed] },
  };
}

function responseEmbeds(embeds: Embed[]) {
  return {
    type: DiscordInteractionResponseTypes.ChannelMessageWithSource,
    data: { embeds: embeds },
  };
}

export function resetResponse() {
  res = undefined;
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
function timer(interaction: Interaction, next: Next) {
  const timerCount = parseInt(ctx.args[0]);
  timerEx(timerCount, ctx.message);
  return next();
}

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
