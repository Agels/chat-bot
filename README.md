# chat-bot

Chat bot project for the Hacktiv8 "Maju AI" training, organized as an npm workspaces monorepo.

```
chat-bot/
├── backend/    Express + Gemini API (session 2)
└── frontend/   Chat UI (session 3, not started yet)
```

## Setup

```bash
npm install
cp backend/.env.example backend/.env   # then fill in the values
```

| Variable         | Description                    |
| ---------------- | ------------------------------ |
| `GEMINI_API_KEY` | API key from Google AI Studio  |
| `GEMINI_MODEL`   | Gemini model name to use       |

## Run the backend

```bash
npm run dev     # nodemon, restarts on change
npm start       # plain node
```

The server listens on http://localhost:3000.

## Endpoints

| Method | Path                    | Body                                         |
| ------ | ----------------------- | -------------------------------------------- |
| GET    | `/`                     | -                                            |
| POST   | `/generate-text`        | JSON: `prompt`                               |
| POST   | `/generate-fr-image`    | form-data: `prompt`, `image` (file)          |
| POST   | `/generate-fr-document` | form-data: `prompt`, `document` (file)       |
| POST   | `/generate-fr-audio`    | form-data: `prompt`, `audio` (file)          |

All POST endpoints respond with `{ "result": "..." }`.
