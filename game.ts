import { Channel } from "./deps.ts";

export enum Location {
  Bridge = "bridge",
  Grass = "grass",
  Aurora = "aurora",
  Space = "space",
  Beach = "beach",
}

export enum Role {
  Boss,
  Member,
  Police,
  Traitor,
}

class Player {
  user: string;
  role: Role;
  location: Location | undefined;
  constructor(user: string, role: Role) {
    this.user = user;
    this.role = role;
  }

  goto(location: Location) {
    this.location = location;
  }

  clear() {
    this.location = undefined;
  }
}

export class Game {
  channel: Channel;
  players: Map<string, Player>;
  visits: number;
  history: Map<string, Player>[];
  constructor(channel: Channel) {
    this.channel = channel;
    this.players = new Map();
    this.visits = 0;
    this.history = [];
  }

  addPlayer(user: string, role: Role) {
    const player = new Player(user, role);
    this.players.set(user, player);
  }

  updateHistory() {
    this.history.push(this.players);
  }
}