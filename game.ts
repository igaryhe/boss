export enum Location {
  Airport = "airport",
  Bar = "bar",
  Casino = "casino",
  Hotel = "hotel",
  Villa = "villa",
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
  location?: Location;
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
  channel: bigint;
  players: Map<string, Player>;
  visits: number;
  history: Map<string, Player>[];
  barrier?: Location;
  hasSetBarrier: boolean;

  constructor(channel: bigint) {
    this.channel = channel;
    this.players = new Map();
    this.visits = 0;
    this.history = [];
    this.hasSetBarrier = false;
  }

  addPlayer(user: string, role: Role) {
    const player = new Player(user, role);
    this.players.set(user, player);
  }

  updateHistory() {
    this.history.push(this.players);
  }
}