import { Message, sendDirectMessage } from "./deps.ts";
import { Game, Location, Role } from "./game.ts";
import { roles } from "./config.ts";
import { Dispatcher, Next } from "./middleware.ts";

let game: Game | undefined = undefined;

export interface Context {
  message: Message;
  args: string[];
}

interface Command {
  description: string;
  dispatcher: Dispatcher<Context>;
}

export const commands: Map<string, Command> = new Map();

commands.set("help", {
  description: "!help",
  dispatcher: new Dispatcher<Context>(help),
});

commands.set("start", {
  description: "!start                   to start the game.",
  dispatcher: new Dispatcher<Context>(checkTextChannel, start),
});

commands.set("stop", {
  description: "!stop                    to stop the game.",
  dispatcher: new Dispatcher<Context>(checkGame, checkChannel, stop),
});

commands.set("restart", {
  description: "!restart                 to restart the game.",
  dispatcher: new Dispatcher<Context>(checkGame, checkChannel, restart),
});

commands.set("assign", {
  description:
    "!assign <@player1> ...   to assign roles to players. This command accept 5 different user mentions as parameters.",
  dispatcher: new Dispatcher<Context>(
    checkGame,
    checkTextChannel,
    checkChannel,
    assign,
  ),
});

/*
commands.set("clear", {
  description: "clear locations",
  dispatcher: new Dispatcher<Context>(
    checkGame,
    checkChannel,
    checkPlayer,
    clear,
  ),
});
*/

commands.set("reveal", {
  description:
    "!reveal                  to reveal everyone's location.",
  dispatcher: new Dispatcher<Context>(
    checkGame,
    checkPlayer,
    checkChannel,
    reveal,
  ),
});

commands.set("timer", {
  description:
    "!timer <seconds>         to start a timer. This command accepts one parameter as the length in seconds for the timer.",
  dispatcher: new Dispatcher<Context>(argLength, timer),
});

commands.set("history", {
  description: "!history                 to view the game history.",
  dispatcher: new Dispatcher<Context>(checkGame, checkChannel, history),
});

/*
commands.set("check", {
  description: "check a player's role",
  dispatcher: new Dispatcher<Context>(
    checkGame,
    checkPlayer,
    checkDMChannel,
    checkRole,
  ),
});
*/

commands.set("goto", {
  description:
    "!goto <place>            to set your next location. <place> could be the following values: airport, bar, casino, hotel, villa.",
  dispatcher: new Dispatcher<Context>(
    checkGame,
    checkDMChannel,
    checkPlayer,
    goto,
  ),
});

commands.set("barrier", {
  description:
    "!barrier <place>         to set a barrier at a location. <place> could be the following values: airport, bar, casino, hotel, villa.",
  dispatcher: new Dispatcher<Context>(
    checkGame,
    checkPlayer,
    checkDMChannel,
    barrier,
  ),
});

// middlewares
function checkGame(ctx: Context, next: Next) {
  if (game == undefined) ctx.message.send("You need to start the game first");
  else return next();
}

function checkChannel(ctx: Context, next: Next) {
  if (ctx.message.channel?.id != game?.channel) {
    ctx.message.send("You are in the wrong channel");
  } else return next();
}

function checkTextChannel(ctx: Context, next: Next) {
  if (ctx.message.channel?.type != 0) {
    ctx.message.send("You are not in a text channel");
  } else return next();
}

function checkDMChannel(ctx: Context, next: Next) {
  if (ctx.message.channel?.type != 1) {
    ctx.message.send("You are not in a DM channel");
  } else return next();
}

function checkPlayer(ctx: Context, next: Next) {
  const player = game?.players.get(ctx.message.author.id);
  if (player == undefined) {
    ctx.message.send("You are not in the game right now");
  } else return next();
}

function start(ctx: Context, next: Next) {
  game = new Game(ctx.message.channel!.id);
  ctx.message.send("Please assign roles to players");
  return next();
}

function stop(_ctx: Context, next: Next) {
  game = undefined;
  return next();
}

function restart(ctx: Context, next: Next) {
  game = new Game(ctx.message.channel!.id);
  return next();
}

function assign(ctx: Context, next: Next) {
  const assigns = shuffle(roles);
  if (ctx.message.mentions.length != roles.length) {
    ctx.message.send("Invalid user amount.");
  } else {
    let i = 0;
    ctx.message.mentions.forEach((user) => {
      sendDirectMessage(user, `You are the ${Role[assigns[i]]}`);
      game?.addPlayer(user, assigns[i]);
      if (assigns[i] == Role.Boss) ctx.message.send(`<@${user}> is the Boss.`);
      if (assigns[i] == Role.Police) {
        ctx.message.send(`<@${user}> is the Police.`);
      }
      i++;
    });
    return next();
  }
}

function goto(ctx: Context, next: Next) {
  const player = game?.players.get(ctx.message.author.id);
  if (Object.values(Location).some((loc: string) => loc === ctx.args[0])) {
    player?.goto(<Location> ctx.args[0]);
    ctx.message.send(`You are in ${ctx.args[0]} right now`);
    return next();
  } else ctx.message.send("Invalid place");
}

/*
function clear(_ctx: Context, next: Next) {
  game?.players.forEach((player) => player.clear());
  return next();
}
*/

function reveal(ctx: Context, next: Next) {
  let result = "";
  let caught = false;
  let bossLoc: Location | undefined = undefined;

  game?.updateHistory();

  game?.players.forEach((player) => {
    if (player.role === Role.Boss) bossLoc = player.location;
    result += `<@${player.user}>:\t\`${player.location}\`\n`;
  });

  game?.players.forEach((player) => {
    if (player.location !== bossLoc) return;
    if (player.role === Role.Police) caught = true;
    else if (player.role === Role.Member || player.role === Role.Traitor) {
      if (player.location !== game?.barrier) game!.visits += 1;
    }
  });

  ctx.message.send(result);

  if (game?.barrier !== undefined) {
    ctx.message.send(`The barrier is set at \`${game.barrier}\``);
    game!.hasSetBarrier = true;
    game!.barrier = undefined;
  }

  ctx.message.send(`visits: ${game?.visits}`);

  if (caught) ctx.message.send("The boss is caught by the police");
  else if (game!.history.length <= 3 && game!.visits >= 4) {
    ctx.message.send("The boss successfully escaped");
  } else if (game!.history.length == 3 && game!.visits < 4) {
    ctx.message.send("The boss failed to escape");
  }

  return next();
}

function argLength(ctx: Context, next: Next) {
  if (ctx.args.length >= 1) next();
  else ctx.message.send("Invalid argument");
}

function timer(ctx: Context, next: Next) {
  const timerCount = parseInt(ctx.args[0]);
  timerEx(timerCount, ctx.message);
  return next();
}

function history(ctx: Context, next: Next) {
  if (game?.history.length) {
    let round = 1;
    game.history.forEach((players) => {
      let result = "";
      players.forEach((player) =>
        result += `<@${player.user}>:\t\`${player.location}\`\n`
      );
      ctx.message.send(`Round ${round}`);
      ctx.message.send(result);
      round++;
    });
    return next();
  } else ctx.message.send("No history");
}

/*
function checkRole(ctx: Context, next: Next) {
  if (game?.players.get(ctx.message.author.id)?.role === Role.Police) {
    cache.members.forEach((member) => {
      if (member.username === ctx.args[0]) {
        ctx.message.send(Role[game!.players.get(member.id)!.role]);
      }
    });
    return next();
  } else ctx.message.send("You are not the police");
}
*/

function barrier(ctx: Context, next: Next) {
  if (game?.players.get(ctx.message.author.id)?.role === Role.Police) {
    if (!game?.hasSetBarrier) {
      if (Object.values(Location).some((loc: string) => loc === ctx.args[0])) {
        game.barrier = <Location> ctx.args[0];
        ctx.message.send(`You've set a barrier in ${ctx.args[0]}`);
        return next();
      } else ctx.message.send("Invalid place");
    } else ctx.message.send("You've already set a barrier.");
  } else ctx.message.send("You are not the police");
}

function help(ctx: Context, next: Next) {
  let result = "```";
  commands.forEach((command) => result += command.description + "\n");
  result += "```";
  ctx.message.send(result);
  return next();
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
