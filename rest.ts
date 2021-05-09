import { CreateGlobalApplicationCommand, DiscordenoInteractionResponse } from "./deps.ts";

const appId = Deno.env.get("APP_ID")!;
const token = Deno.env.get("BOT_TOKEN")!;
const baseUrl = `https://discord.com/api/v8/applications/${appId}`;

export async function registerCommand(
  command: CreateGlobalApplicationCommand,
  guildId: bigint | undefined = undefined,
) {
  let url = baseUrl;
  if (guildId === undefined) url += `/commands`;
  else url += `/guilds/${guildId.toString()}/commands`;
  const headers = new Headers();
  headers.append("Authorization", `Bot ${token}`);
  headers.append("Content-Type", "application/json");
  const response = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(command),
  });
  response.json().then((data) => console.log(data));
}

export async function deleteCommand(
  commandId: string,
  guildId: bigint | undefined = undefined,
) {
  let url = baseUrl;
  if (guildId === undefined) url += `/commands`;
  else url += `/guilds/${guildId.toString()}/commands/${commandId}`;
  const headers = new Headers();
  headers.append("Authorization", `Bot ${token}`);
  headers.append("Content-Type", "application/json");
  const response = await fetch(url, {
    method: "DELETE",
    headers: headers,
  });
  response.json().then((data) => console.log(data));
}

export async function updateCommands(
  commands: CreateGlobalApplicationCommand[],
  guildId: bigint | undefined = undefined,
) {
  let url = baseUrl;
  if (guildId === undefined) url += `/commands`;
  else url += `/guilds/${guildId.toString()}/commands`;
  const headers = new Headers();
  headers.append("Authorization", `Bot ${token}`);
  headers.append("Content-Type", "application/json");
  const response = await fetch(url, {
    method: "PUT",
    headers: headers,
    body: JSON.stringify(commands),
  });
  response.json().then((data) => console.log(data));
}

export async function sendFollowup(id: string, res: DiscordenoInteractionResponse) {
  const url = `https://discord.com/api/v8/webhooks/${appId}/${id}`;
  const headers = new Headers();
  headers.append("Authorization", `Bot ${token}`);
  headers.append("Content-Type", "application/json");
  const response = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(res),
  });
  response.json().then((data) => console.log(data));
}