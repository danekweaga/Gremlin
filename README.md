# Gremlin

Gremlin turns hidden feature scope into a creature that shrinks as work is cut or completed. When the active feature is finished, the creature disappears.

## Run locally

Requires Node.js 24. The app deliberately has no third-party runtime dependencies.

```bash
npm run dev
```

Open `http://127.0.0.1:4173`.

The complete demo works without credentials. For live scope analysis through OpenRouter, copy `.env.example` to `.env` and add a key:

```env
OPENROUTER_API_KEY=your_new_key_here
OPENROUTER_MODEL=openai/gpt-5.6-terra-pro
PORT=4173
```

Do not use a key that has been pasted into a chat or committed to source control. The key is read only by the local server. The browser calls `/api/analyze`, and the server uses OpenRouter's Responses API with a strict JSON schema. If OpenRouter is missing or unavailable, Gremlin automatically uses polished, feature-specific demo analysis. Direct OpenAI keys remain supported through `OPENAI_API_KEY` and `OPENAI_MODEL`.

## Verify

```bash
npm run check
npm run build
```

`npm run build` creates the production `dist/` interface. Local development uses `server.mjs`; Vercel uses the serverless handlers in `api/`.

## Deploy to Vercel

The repository includes Vercel Functions for `/api/health` and `/api/analyze`, plus a
`vercel.json` configuration that serves the production interface from `dist/`.

1. Import the GitHub repository into Vercel or run `vercel --prod`.
2. Add `OPENROUTER_API_KEY` as a sensitive environment variable for Production and Preview.
3. Add `OPENROUTER_MODEL=openai/gpt-5.6-terra-pro` for Production and Preview.
4. Redeploy after saving the variables.

Never commit `.env`; both Git and Vercel explicitly exclude it. Without a production key,
the deployment remains fully usable in polished demo mode.

## Codex collaboration

Codex accelerated the build by turning the product idea into a shippable loop in one stretch: local Node server, strict analysis schema, demo fallback brain, canvas creature arena, share card, tests, and a Vercel static-plus-functions deploy path. Instead of spending the hackathon on scaffolding and hosting guesswork, most of the time went into the metaphor, the containment UX, and making long feature titles survive the workspace layout.

Product and design decisions Codex helped lock in:

- Treat hidden scope as a **creature you shrink**, not a spreadsheet you ignore. Completing or cutting work must visibly mutate the specimen until it disappears.
- Ship a **zero-dependency** runtime so the demo never dies on install friction, with polished feature-specific demo analysis when no API key is present.
- Keep **local `server.mjs`** for development and **`api/` serverless handlers** for Vercel, with `framework: null` so production serves `dist/` instead of trying to run a long-lived HTTP server.
- Use an **acid-lab visual system** (near-black grid, lime containment ring, Impact titles) and a Devpost thumbnail that literalizes sticky-note scope as a grinning gremlin.
- Scale workspace titles with `is-long` / `is-very-long` classes so GPT-generated feature names stay readable instead of blowing out the header.

**GPT-5.6** (via OpenRouter’s Responses API, with direct OpenAI as a fallback) is the live scoping engine: it returns structured required/later tasks, hour ranges, assumptions, and a sharp verdict under a strict JSON schema. Codex wired that contract end-to-end—prompt, schema, normalization, health/analyze routes, and the UI loop that turns the model output into something you can cut, complete, and defeat.
