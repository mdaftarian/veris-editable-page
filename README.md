# Editable page — "Real People Don't Talk Like That"

A recreation of the Veris blog post as a small static web app you can host on
GitHub Pages. Everything on the page can be edited live, any block can carry a
comment thread, and a **Compare** tab shows the original next to the current
version with a short summary of every change and the reasoning behind it.

No build step, no framework, no server of your own.

| File | What it is |
|---|---|
| `index.html` | The app shell (toolbar + three tabs + outline) |
| `content.js` | The **original** page content as data. Never overwritten by edits. |
| `app.js` | Rendering, editing, comments, compare, storage |
| `styles.css` | Styling (matches the Veris page's palette and type) |
| `config.js` | Where you paste your Supabase keys (see step 3) and an optional edit passcode |
| `supabase.sql` | One-time database setup script for Supabase |
| `edits.json` | *Optional.* Only used in local mode (no Supabase): published edits you commit. |

---

## 1. Open it in VS Code

1. Unzip the folder (or clone the repo) and open it in VS Code: **File → Open Folder…**
2. Install the **Live Server** extension (Ritwick Dey) if you don't have it.
3. Right-click `index.html` → **Open with Live Server**. The page opens at `http://127.0.0.1:5500`.

> Opening `index.html` directly as a `file://` URL also works for editing, but the
> browser blocks the `edits.json` fetch — so use Live Server (or GitHub Pages) to
> see published edits.

## 2. Put it on GitHub Pages

1. On github.com click **New repository**, name it (e.g. `veris-page`), keep it public, create it.
2. In VS Code open the terminal (**Terminal → New Terminal**) and run:

   ```bash
   git init
   git add .
   git commit -m "Editable Veris page"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/veris-page.git
   git push -u origin main
   ```

3. On GitHub go to **Settings → Pages**. Under *Build and deployment* choose
   **Deploy from a branch**, branch `main`, folder `/ (root)`, click **Save**.
4. After about a minute the site is live at
   `https://YOUR-USERNAME.github.io/veris-page/`.

## 3. Turn on shared live editing (Supabase, free)

Without this step the site works, but each visitor's edits stay in their own
browser. With it, everyone with the URL edits and comments on one live copy —
no accounts needed for them.

1. Go to https://supabase.com, sign up (free), click **New project**. Give it a
   name and a database password (you won't need the password again), pick a
   region near you, and wait a minute for it to be created.
2. In the left sidebar open **SQL Editor → New query**. Open `supabase.sql` from
   this folder, paste its whole contents into the editor and click **Run**. It
   creates one table, turns on live updates, and creates an `images` bucket for
   uploads.
3. In the sidebar open **Project Settings → API**. Copy the **Project URL** and
   the **anon public** key.
4. Open `config.js` in VS Code and paste them in:

   ```js
   supabaseUrl: "https://xxxxxxxxxxxx.supabase.co",
   supabaseAnonKey: "eyJhbGciOi...",
   ```

   Optionally set `editPasscode: "something"` — visitors then have to type it
   once before they can edit or comment (readers never see the prompt). It's a
   light gate, not real security; anyone determined could still write to the
   database, which is fine for a review page among clients and collaborators.
5. Commit and push (`git add . && git commit -m "Enable shared editing" && git push`).
   A minute later the site's status (top right of the toolbar) reads
   **live · shared with everyone (supabase)**.

The anon key is designed to be public — it only allows what the policies in
`supabase.sql` allow. Free-tier limits (500 MB database, 1 GB storage) are far
more than this page will ever use.

---

## Using the app

**Toolbar**

- **You** — type your name once; it's attached to your edits and comments.
- **Edit** (or press `E`) — turns on edit mode. Click any text to edit it in place;
  click away (or press Enter on a heading) and a small dialog asks you to confirm the
  change and, optionally, say *why* you made it. That note appears in the Compare tab.
  Click the hero image or any image to replace it (URL or upload). Hover between two
  blocks (or use the "Add a section" bar at the end) to insert a title, subtitle,
  text block or image. Each block has a ⠿ drag handle for drag-and-drop reordering,
  ↑ ↓ buttons, "save for later" (moves it to a tray at the bottom of the page, from
  where it can be put back or dragged back in) and ✕ delete.
- **Comment** (or press `C`) — turns on comment mode. Click any paragraph, table,
  chart, quote box or image to open its thread. Blocks with open comments show a
  💬 pin. General (whole-page) comments live on the Comments tab.
- **Export** — downloads `edits.json` containing the current content, the change
  log and the comments.
- **Import** — loads an `edits.json` file.
- **Reset** — throws away everything in this browser and returns to the original.

**Tabs**

- **Page** — the live, editable page.
- **Comments** — every thread, filterable by open / resolved, with reply, resolve,
  delete and a "jump to it" link.
- **Compare** — the page as it is now, with edited, added and removed sections
  marked. Click any marked section to see who changed it, when, the *why* note
  they typed, and a before/after snippet with the changed words highlighted.

---

## How saving works

**With Supabase configured (step 3):** every edit, comment, reorder and upload is
saved to the shared database the moment it happens, and everyone who has the page
open sees it within a second or two. Nothing else to do.

**Without Supabase (local mode):** GitHub Pages only serves static files, so the
page can't write to the server. Saving then works in two layers:

1. **Automatically, in your browser.** Every edit and comment is saved to this
   browser's local storage the moment you make it. Reload the page and it's still
   there. But it's *only in that browser*.
2. **Published for everyone — by committing `edits.json`.** When you're happy:
   click **Export**, move the downloaded `edits.json` into the project folder
   (replacing the old one), then in VS Code:

   ```bash
   git add edits.json
   git commit -m "Publish edits"
   git push
   ```

   A minute later, everyone who opens the GitHub Pages URL sees your edits and
   comments. (Local edits in a browser always take priority over the published
   file, so a collaborator with their own unsaved edits won't lose them — they
   can Reset to see the published version.)

Because `content.js` is never modified, the Compare tab always compares against
the true original.

---

## Customising

- **Change the original text** — edit `content.js`. Each block has a stable `id`;
  keep the ids the same so existing comments and change logs still line up.
- **Fonts** — the real site uses *Riforma* (a licensed font). This uses *Inter* and
  *IBM Plex Mono* from Google Fonts as the closest free substitutes; swap the
  `<link>` in `index.html` and the `--sans` / `--mono` variables in `styles.css`.
- **Colours** — all colours are CSS variables at the top of `styles.css`.
