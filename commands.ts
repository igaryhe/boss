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

commands.set("start", {
  description: "start the game",
  dispatcher: new Dispatcher<Context>(checkTextChannel, start),
});

commands.set("stop", {
  description: "stop the game",
  dispatcher: new Dispatcher<Context>(checkGame, checkChannel, stop),
});

commands.set("restart", {
  description: "restart the game",
  dispatcher: new Dispatcher<Context>(checkGame, checkGame, restart),
});

commands.set("assign", {
  description: "assign roles to everyone mentioned",
  dispatcher: new Dispatcher<Context>(checkGame, checkTextChannel, assign),
});

commands.set("goto", {
  description: "goto a place",
  dispatcher: new Dispatcher<Context>(
    checkGame,
    checkDMChannel,
    checkPlayer,
    goto,
  ),
});

commands.set("clear", {
  description: "clear locations",
  dispatcher: new Dispatcher<Context>(
    checkGame,
    checkTextChannel,
    checkPlayer,
    clear,
  ),
});

commands.set("reveal", {
  description: "reveal locations",
  dispatcher: new Dispatcher<Context>(checkGame, checkChannel, reveal),
});

commands.set("timer", {
  description: "start a timer",
  dispatcher: new Dispatcher<Context>(argLength, timer),
});

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
  message.channel?.send(`${timerCount} seconds remain.`);
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

function checkGame(ctx: Context, next: Next) {
  if (game == undefined) {
    ctx.message.channel?.send("You need to start the game first");
  } else return next();
}

function checkChannel(ctx: Context, next: Next) {
  if (ctx.message.channel?.id != game?.channel.id) {
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
  game = new Game(ctx.message.channel!);
  ctx.message.channel?.send("Please assign roles to players");
  return next();
}

function stop(_ctx: Context, next: Next) {
  game = undefined;
  return next();
}

function restart(ctx: Context, next: Next) {
  game = new Game(ctx.message.channel!);
  return next();
}

function assign(ctx: Context, next: Next) {
  const assigns = shuffle(roles);
  if (ctx.message.mentions.length != roles.length) {
    ctx.message.channel?.send("Invalid user amount.");
  } else {
    let i = 0;
    ctx.message.mentions.forEach((user) => {
      sendDirectMessage(user, `You are the ${Role[assigns[i]]}`);
      game?.addPlayer(user, assigns[i]);
      if (assigns[i] == Role.Boss) {
        game?.channel.send(`<@${user}> is the Boss.`);
      }
      if (assigns[i] == Role.Police) {
        game?.channel.send(`<@${user}> is the Police.`);
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
    ctx.message.channel?.send(`You are in ${ctx.args[0]} right now`);
    return next();
  } else ctx.message.channel?.send("Invalid place");
}

function clear(_ctx: Context, next: Next) {
  game?.players.forEach((player) => player.clear());
  return next();
}

function reveal(ctx: Context, next: Next) {
  let result = "";
  let caught = false;
  let bossLoc: Location | undefined = undefined;
  game?.players.forEach((player) => {
    if (player.role === Role.Boss) bossLoc = player.location;
    result += `<@${player.user}>: ${player.location}\n`;
  });
  game?.players.forEach((player) => {
    if (
      player.role === Role.Member ||
      player.role === Role.Traitor && player.location === bossLoc
    ) {
      game!.visits += 1;
    }
    if (player.role === Role.Police && player.location === bossLoc) {
      caught = true;
    }
  });
  ctx.message.channel?.send(result);
  ctx.message.channel?.send(`visits: ${game?.visits}`);
  if (caught) ctx.message.channel?.send("The boss is caught by the police");
  else if (game!.visits >= 4) {
    ctx.message.channel?.send("The boss successfully run away");
  }
  return next();
}

function argLength(ctx: Context, next: Next) {
  if (ctx.args.length >= 1) next();
  else ctx.message.channel?.send('Invalid argument');
}

function timer(ctx: Context, next: Next) {
  const timerCount = parseInt(ctx.args[0]);
  timerEx(timerCount, ctx.message);
  return next();
}