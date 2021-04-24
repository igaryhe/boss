import { Game, Location, Role } from "./player.ts";
import { Message, sendDirectMessage } from "https://deno.land/x/discordeno/mod.ts";

const roles = [Role.Boss, Role.Police, Role.Member, Role.Member, Role.Traitor];
const playerCount = 2;

let game: Game | undefined = undefined;

interface Command {
  description: string,
  execute: (message: Message, args: Array<string>) => void
}
export const commands: Map<string, Command> = new Map();

commands.set('start', {
  description: "start the game",
  execute(message: Message, _args: Array<string>) {
    if (message.channel?.type != 0) {
      message.channel?.send("Must start the game in a text channel");
    } else {
      game = new Game(message.channel);
      message.channel.send("Please assign roles to players");
    }
  },
});
commands.set('assign', {
  description: "assign roles to everyone mentioned",
  execute(message: Message, _args: Array<string>) {
    if (game == undefined) {
      message.channel?.send("You need to start the game first.");
      return;
    }
    if (message.channel?.id != game.channel.id) {
      message.channel?.send("You are in the wrong channel");
    }
    const assigns = shuffle(roles);
    if (message.mentions.length != playerCount) {
      message.channel?.send("Invalid user amount.");
    } else {
      let i = 0;
      message.mentions.forEach((user) => {
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
    }
  },
});

commands.set('goto', {
  description: "goto a place",
  execute(message: Message, args: Array<string>) {
    if (game == undefined) {
      message.channel?.send("You need to start the game first");
      return;
    }
    if (message.channel?.type != 1) {
      message.channel?.send("You could only set location in a DM channel");
      return;
    }
    const player = game.players.get(message.author.id);
    if (player == undefined) {
      message.channel.send("You are not in the game right now.");
      return;
    }
    if (args.length > 1) {
      message.channel.send("Too many arguments");
      return;
    }
    if (Object.values(Location).some((loc: string) => loc === args[0])) {
      player.goto(<Location> args[0]);
      message.channel.send("Done!");
    } else message.channel.send('Invalid place');
  },
});

commands.set('reveal', {
  description: "reveal locations",
  execute(message: Message, _args: Array<string>) {
    if (game == undefined) {
      message.channel?.send("You need to start the game first");
      return;
    }
    if (message.channel?.id != game.channel.id) {
      message.channel?.send("You are in the wrong channel");
      return;
    }
    let result = "";
    let caught = false;
    let bossLoc: Location | undefined = undefined;
    game.players.forEach((player) => {
      if (player.role === Role.Boss) bossLoc = player.location;
      result += `<@${player.user}>: ${player.location}\n`;
    });
    game.players.forEach((player) => {
      if (player.role === Role.Member || player.role === Role.Traitor && player.location === bossLoc) game!.visits += 1;
      if (player.role === Role.Police && player.location === bossLoc) caught = true;
    });
    message.channel.send(result);
    message.channel.send(`visits: ${game.visits}`);
    if (caught) message.channel.send('The boss is caught by the police');
    else if (game.visits >= 4) message.channel.send('The boss successfully run away');
  },
});

commands.set('stop', {
  description: "stop the game",
  execute(message: Message, _args: Array<string>) {
    if (game == undefined) {
      message.channel?.send("You need to start the game first");
      return;
    }
    if (message.channel?.id != game.channel.id) {
      message.channel?.send("You are in the wrong channel");
      return;
    }
    game = undefined;
  },
});

commands.set('timer', {
  description: "start a timer",
  execute(message: Message, args: Array<string>) {
    const timerCount = parseInt(args[0]);
    timer(timerCount, message);
  },
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

function timer(timerCount: number, message: Message) {
  message.channel?.send(`${timerCount} seconds remain.`);
  if (timerCount > 30) {
    setTimeout(timer, 30000, timerCount - 30, message);
  } else if (timerCount <= 30 && timerCount > 10) {
    setTimeout(timer, 10000, timerCount - 10, message);
  } else if (timerCount <= 10 && timerCount > 0) {
    setTimeout(timer, 2000, timerCount - 2, message);
  } else {
    // reveal
  }
}