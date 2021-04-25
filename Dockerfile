FROM hayd/alpine-deno:latest
WORKDIR /usr/src/boss
COPY . .
CMD ["deno", "run", "--allow-env", "--allow-net", "main.ts"]