# 10x Cards

A modern web application built with Astro, React, and TypeScript for creating and managing digital cards.

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started Locally](#getting-started-locally)
- [Available Scripts](#available-scripts)
- [Project Scope](#project-scope)
- [Project Status](#project-status)
- [License](#license)

## Tech Stack

- **Framework**: [Astro](https://astro.build/) v5.13.7 - Modern web framework for building fast, content-focused websites
- **UI Library**: [React](https://react.dev/) v19.1.1 - For building interactive components
- **Language**: [TypeScript](https://www.typescriptlang.org/) v5 - Type-safe JavaScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) v4.1.13 - Utility-first CSS framework
- **Components**: [Shadcn/ui](https://ui.shadcn.com/) - Modern UI components
- **Icons**: [Lucide React](https://lucide.dev/) - Beautiful & consistent icon toolkit
- **Runtime**: [@astrojs/node](https://docs.astro.build/en/guides/integrations-guide/node/) - Node.js runtime for Astro
- **Testing (Unit)**: [Vitest](https://vitest.dev/) + Testing Library ([React](https://testing-library.com/docs/react-testing-library/intro/), [Astro](https://docs.astro.build/en/guides/testing/))
- **Testing (E2E)**: [Playwright](https://playwright.dev/) (+ [@axe-core/playwright](https://github.com/abhinaba-ghosh/axe-core-playwright) for a11y checks)

## Getting Started Locally

### Prerequisites

- **Node.js**: v22.14.0 (as specified in `.nvmrc`)
- **Package Manager**: npm (comes with Node.js)

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/your-username/10x-cards.git
   cd 10x-cards
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:

   Copy `.env.example` to `.env` and fill in your values:

   ```bash
   cp .env.example .env
   ```

   | Variable                   | Required | Description                                                                             |
   | -------------------------- | -------- | --------------------------------------------------------------------------------------- |
   | `SUPABASE_URL`             | ✅       | Project URL from Supabase dashboard                                                     |
   | `SUPABASE_KEY`             | ✅       | Service role key (server-side only)                                                     |
   | `OPENROUTER_API_KEY`       | ✅       | Server-only key obtained from OpenRouter                                                |
   | `OPENROUTER_DEFAULT_MODEL` | ✅       | Default model alias, e.g. `openrouter/anthropic/claude-3.5-sonnet`                      |
   | `OPENROUTER_BASE_URL`      | ➖       | Override for the chat completions endpoint (defaults to `https://openrouter.ai/api/v1`) |
   | `OPENROUTER_REFERRER`      | ✅       | Origin sent in `HTTP-Referer` header to satisfy OpenRouter policy                       |
   | `OPENROUTER_TITLE`         | ✅       | App name shown in OpenRouter logs                                                       |
   | `AI_TIMEOUT_MS`            | ➖       | Server-side timeout (ms) for OpenRouter calls, defaults to 30000                        |
   | `AI_RATE_LIMIT_PER_MINUTE` | ➖       | Soft quota enforced per user per minute                                                 |
   | `AI_RATE_LIMIT_PER_DAY`    | ➖       | Daily quota enforced per user                                                           |
   | `AI_MAX_INPUT_LENGTH`      | ➖       | Maximum characters accepted from user input                                             |
   | `AI_DEFAULT_MAX_CARDS`     | ➖       | Default card batch size for flashcard generation                                        |
   | `AI_MAX_CARDS_LIMIT`       | ➖       | Hard ceiling for generated cards in a single request                                    |

4. **Run the development server**:

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173) in your browser to see the application.

5. **Build for production**:

   ```bash
   npm run build
   ```

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check for code issues
- `npm run lint:fix` - Automatically fix ESLint issues where possible
- `npm run format` - Format code with Prettier

## AI Integration

The application uses OpenRouter to power AI-assisted flashcard workflows. All requests are served through a single server route: `POST /api/v1/ai/chat`.

### Flashcard generation

Send plain text to the endpoint and the server will create a deck, persist generated cards, and return metadata.

```bash
curl -X POST http://localhost:5173/api/v1/ai/chat \\
   -H "Content-Type: application/json" \\
   -H "Authorization: Bearer <YOUR_SUPABASE_ACCESS_TOKEN>" \\
   -d '{
      "inputText": "Explain the basics of Newtonian mechanics...",
      "deckName": "Newton",
      "maxCards": 12
   }'
```

Successful responses (`201 Created`) include:

- `deck`: Newly created deck metadata
- `cards`: Array of generated cards capped by `AI_MAX_CARDS_LIMIT`
- `log`: Audit record saved to `ai_generation_logs`
- Headers `X-RateLimit-Remaining` and optional `Retry-After` for quota feedback

### Direct chat access & streaming

To access raw model output or stream tokens to the client, pass a `messages` array in the OpenAI-compatible shape:

```bash
curl -N -X POST http://localhost:5173/api/v1/ai/chat \\
   -H "Content-Type: application/json" \\
   -H "Accept: text/event-stream" \\
   -H "Authorization: Bearer <YOUR_SUPABASE_ACCESS_TOKEN>" \\
   -d '{
      "stream": true,
      "messages": [
         { "role": "system", "content": "You are a concise flashcard generator." },
         { "role": "user", "content": "Create 5 Q/A pairs about the water cycle." }
      ],
      "response_format": {
         "type": "json_schema",
         "json_schema": {
            "name": "flashcard_batch",
            "strict": true,
            "schema": {
               "type": "object",
               "required": ["cards"],
               "properties": {
                  "cards": {
                     "type": "array",
                     "items": {
                        "type": "object",
                        "required": ["question", "answer"],
                        "properties": {
                           "question": { "type": "string" },
                           "answer": { "type": "string" },
                           "hint": { "type": "string" }
                        }
                     }
                  }
               }
            }
         }
      }
   }'
```

When `stream` is `true` the route emits Server-Sent Events (`data: {...}`) followed by `data: [DONE]`. For non-streaming requests the handler returns a JSON body with the assistant message and token usage.

### Error handling

The API communicates throttling and upstream failures using standard HTTP status codes:

- `400` – Payload validation failed (Zod)
- `401` – Missing or invalid Supabase session / OpenRouter rejection
- `422` – Model produced an invalid payload (schema mismatch)
- `429` – Rate limit exceeded (`Retry-After` header provided when possible)
- `503`/`504` – Upstream service temporarily unavailable or timed out

Clients should leverage the response headers (`X-RateLimit-Remaining`, `Retry-After`) to pace follow-up requests.

## Project Scope

The 10x Cards project is designed to provide a flexible platform for creating, managing, and sharing digital cards. Key features include:

- **Card Creation**: Easy-to-use interface for designing custom cards
- **Templates**: Pre-built templates for quick card generation
- **Sharing**: Options to share cards via links or export
- **Responsive Design**: Optimized for desktop and mobile devices
- **Accessibility**: Built with accessibility best practices

## Project Status

🚧 **Active Development**

This project is currently in active development. Core features are implemented, but additional enhancements and optimizations are ongoing.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

For more information, visit the [project repository](https://github.com/your-username/10x-cards).
