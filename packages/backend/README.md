# Codenames backend

Websocket API for a Codename game.

## Development

CloudFlare Workers with [Durable Objects](https://developers.cloudflare.com/durable-objects/).

```sh
# Run dev server
pnpm dev

# Deploy it
pnpm deploy

# Use it
websocat wss://api.codenam.es/snazzy-squirrel
```

## Protocol
