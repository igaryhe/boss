import { Application, decodeString, sign_detached_verify, Interaction, camelize } from "./deps.ts";
import { commands, registerCommands, res, resetResponse } from "./commands.ts";

const app = new Application();
const pubkey = Deno.env.get("PUBLIC_KEY")!;
const encoder = new TextEncoder();

await registerCommands(811924657426399253n);

app.use(async (ctx, next) => {
  const signature = ctx.request.headers.get("X-Signature-Ed25519");
  const timestamp = ctx.request.headers.get("X-Signature-Timestamp");
  if (ctx.request.hasBody && signature && timestamp) {
    const body = await ctx.request.body({ type: "text" }).value;
    const isVerified = sign_detached_verify(
      encoder.encode(timestamp + body),
      decodeString(signature),
      decodeString(pubkey),
    );
    if (isVerified) await next();
    else ctx.response.status = 401;
  }
});

app.use(async (ctx) => {
  if (ctx.request.hasBody) {
    const result = await ctx.request.body({ type: "json" }).value;
    if (result.type === 1) {
      ctx.response.body = result;
    } else if (result.type === 2) {
      const interaction = camelize<Interaction>(result);
      const command = interaction.data?.name;
      const pair = commands.get(command!);
      if (pair !== undefined) {
        await pair.dispatch(interaction);
        if (res !== undefined) {
          ctx.response.body = res;
          resetResponse();
        }
      }
    }
  }
});

await app.listen({ port: 8000 });