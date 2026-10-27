# Launch checklist

## 1. Record the walkthrough

Use [`video-script.md`](video-script.md). Target 9:30–9:50 total.

- [ ] 1080p screen recording with a clear microphone.
- [ ] Part 1: client pitch, max 5 minutes.
- [ ] Part 2: technical review, max 5 minutes.
- [ ] Total runtime ≤ 10:00.
- [ ] Upload to YouTube as **Unlisted**.
- [ ] Title: `Windcast — day-ahead wind forecast intelligence (pilot demo)`.
- [ ] Description includes the live URL and the public repo URL.
- [ ] Open the YouTube link in an incognito window and confirm it plays.

## 2. Verify the deployment

- [ ] `https://windcast-pilot.vercel.app/` loads the dashboard.
- [ ] `/accuracy` loads the monthly accuracy view.
- [ ] `/revisions` loads the vintage ledger.
- [ ] `/method` loads the method page.
- [ ] `/api/health` returns `{"status":"ok",...}`.
- [ ] A CSV export downloads: `/api/export/accuracy.csv`.
- [ ] Dark and light themes both render; the toggle persists after refresh.
- [ ] No Vercel login wall and no 404.
- [ ] No console errors in the browser dev tools.

## 3. Verify the repository

- [ ] https://github.com/subhajitlucky/kjhwr is public.
- [ ] `data/windcast.db` is present (2.5 MB).
- [ ] `README.md` renders with both screenshots.
- [ ] The live app URL in the README is correct.
- [ ] `.env.local`, Vercel tokens and local virtualenvs are not committed.
- [ ] Incognito: the repo and the deployed app are accessible without login.
- [ ] Incognito: the YouTube link is playable.

## 4. Hand-off

- Live app: `https://windcast-pilot.vercel.app`
- Repository: `https://github.com/subhajitlucky/kjhwr`
- Walkthrough: the unlisted YouTube link
- Share the same links in the hand-off note.
