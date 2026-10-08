# ChainBreaker

An AI companion that helps students understand their daily challenges, manage stress, build
healthier routines and break harmful patterns — with a clear hand-off to human support when a
situation goes past what an AI should handle.

**Kivd** is the companion you actually talk to.

On first run you answer three short questions, and the whole app is built around those
answers. There is no placeholder data anywhere: no fake conversations, no invented user.

---

## Running it

1. **Get an API key.** DeepSeek has no free tier, but it's cheap (~$0.15 per million input
   tokens off-peak) and the context window is 1M tokens. Get one at
   <https://platform.deepseek.com/api_keys>.

   *Want free instead?* See **Switching provider** below — one word in `config.json`.

2. **Open `config.json`** in Notepad and paste your key:

   ```json
   {
     "preset": "deepseek",
     "apiKey": "sk-your-key-here",
     ...
   }
   ```

3. **Double-click `start.cmd`.** A black window opens and stays open. That's the server —
   leave it running while you use the app.

4. **Open <http://localhost:8787/index.html>** and answer the three steps.

After that the app lives at <http://localhost:8787/>.

> **Don't open `index_2.html` by double-clicking it.** It needs the server, both to reach Kivd
> and to keep your data in a stable place. Always go through `localhost:8787`.

---

## How the first conversation works

You never have to break the ice. When you finish setup, ChainBreaker makes a real model call
that asks Kivd to greet you by name and ask how your day was. That message is genuinely
generated — it isn't a hardcoded string.

If the model can't be reached, Kivd falls back to a plain "Hi *name*, how was your day
today?" so the app is never silent on first run.

Your profile records that this happened, so editing your setup later won't make Kivd
introduce himself twice.

---

## Switching provider

Everything speaks the OpenAI chat-completions format, so changing provider is one line. Set
`preset` in `config.json`:

| `preset` | Model default | Cost |
| --- | --- | --- |
| `deepseek` | `deepseek-flash` | Paid, very cheap. 1M context. |
| `groq` | `openai/gpt-oss-20b` | Fast, free developer tier |
| `openrouter` | `deepseek/deepseek-chat-v3.1:free` | Has genuinely free models — look for the `:free` suffix |
| `ollama` | `qwen3.5:4b` | Free and fully local. No key, no internet |
| `custom` | — | Anything OpenAI-compatible: LM Studio, vLLM, a remote box |

Override `baseUrl` and `model` individually if a preset drifts out of date.

**Prefer to keep the key out of the file?** Use an environment variable — it takes priority:

```powershell
$env:CHAINBREAKER_API_KEY = "sk-..."
node server.js
```

---

## Files

| File | What it is |
| --- | --- |
| `start.cmd` | Double-click launcher. Checks for Node, then runs the server. |
| `config.json` | **The only file you edit.** Provider, key, port, prompt override. |
| `server.js` | Local server. Serves the folder and proxies chat. Holds the key. |
| `index.html` / `setup.js` / `setup.css` | Welcome animation and the three-step wizard. Also the clinician entry link, top-right. |
| `index_2.html` | The client app: Chat, Tracking, Time Freeze, Safe Space. |
| `app.js` | Streaming, storage, sidebar, tracking, timers, emergency panel, Safe Space. |
| `profile.js` | Storage contract, Kivd's prompt builder, risk detection, anonymised client codes. |
| `therapist.html` / `therapist.js` / `therapist.css` | The clinician console. Separate page, separate surface. |
| `styles.css` | Design tokens and all client-facing styling. |

---

## Safe Space and the clinician console

**Safe Space** is the client's side. Signing in opens a session and creates a private thread.
The clinician signs in separately at `therapist.html`, reachable from the **Therapist sign-in**
link in the top-right of the setup page.

Anonymity is one-way on purpose:

- The console is given a **hashed client code** (`CB-XXXXXX`), derived from the private fields
  with two FNV-1a passes. Same person, same code — and the code cannot be read back to a name.
- The console shows a **coarse age band** (`18–24`), the client's own words for their goal, and
  the shared thread. It is never handed the name, exact age, contact details, Kivd
  conversations, or mood history — there is a "Withheld by design" panel listing exactly that.
- `therapist.js` contains no reference to the client's name anywhere. The only `name` it touches
  is the clinician's own.

**The leave-lock.** While a session is open the clinician cannot sign out or close the console —
both controls are disabled and the reason is shown on screen. Only the client can end it, from
the **End session** button in Safe Space. For symmetry the client cannot sign out mid-session
either, so neither side can strand the other.

> **This is an anonymiser, not encryption.** It keeps the name off the clinician's screen; it
> does not protect anything at rest. A real deployment must hash server-side and store nothing
> identifying in the browser.

> **Both sides share `localStorage`, so this only works in one browser on one machine.** Across
> two real people it needs a backend with accounts, consent records and transport security.
> Session state lives in `chainbreaker.session.v1`.

---

## The two sections

**Chat** — talk to Kivd. Conversations are saved and grouped by date in the sidebar.

**Tracking** — derived entirely from your real conversations. It shows how many days you've
shown up, your current streak, and the last 14 days so the gaps are visible rather than
smoothed over. It is deliberately thin right now: mood, sleep and habit tracking land here
once Kivd is solid. That's the next piece of work.

---

## Where your data lives

- **Profile** (name, age, course, goal, tone, custom prompt) — browser `localStorage`.
- **Conversations and tracking** — browser `localStorage`.
- **API key** — `config.json` on disk, or an environment variable.

Clearing site data for `localhost` wipes your profile and chats. Nothing is uploaded anywhere
except the message text you send to your chosen provider.

```
browser  ──POST /api/chat { system, messages }──▶  server.js
                                                     │ adds your key
                                                     ▼
                                          api.deepseek.com/chat/completions
                                                     │ streamed
   browser  ◀──── SSE: {type:"delta", text:"…"} ─────┘
```

The key is **never sent to the browser**. The server binds to loopback so nothing on your
network can reach it, and it refuses to serve `config.json` over HTTP.

---

## Editing Kivd's prompt

Setup step 3 contains his full system prompt, pre-filled from your answers. Rewrite it freely
— it's sent as the `system` message ahead of every conversation. **Reset to generated** puts
back the version built from your name, age, course, year, goal and tone.

The generated prompt also states Kivd's **boundary**: he is not a doctor or therapist, must
not diagnose or give medication advice, and must point you to a real person if the
conversation turns to serious mental-health concerns, self-harm, addiction, abuse or a crisis.
Please keep that part if you rewrite it.

For a server-wide override that wins over every browser profile, set `systemPromptOverride`
in `config.json`.

## Advanced request options

`extraBody` in `config.json` is merged into the upstream request — the escape hatch for
anything the app doesn't expose:

```json
{
  "extraBody": {
    "reasoning_effort": "low",
    "temperature": 0.7
  }
}
```

## Not built yet

- Mood, sleep and habit tracking inside the **Tracking** section.
- Accountability partner — the person who sees whether you kept your word.
- The daily check-in form.
- File attachments and voice input. The buttons say so rather than pretending.

## Scope

A local, single-user app. It is **not** hardened for the public internet: no authentication,
no rate limiting, no HTTPS. If you ever host it, put it behind a real backend with proper
auth, and don't ship your key.

ChainBreaker is a wellbeing companion, not a medical device. It does not diagnose or treat any
condition and is not a substitute for professional care.
