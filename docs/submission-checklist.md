# Submission checklist

## The deliverable

- [x] React frontend
- [x] Python backend
- [x] Docker
- [x] Deployed app: https://windcast-pilot.vercel.app
- [x] README with file map, run instructions and app link
- [ ] Unlisted YouTube walkthrough
- [ ] Public anonymous GitHub repository
- [ ] Submission form

Submission form: **https://forms.cloud.microsoft/r/Ljmf1aWESK**

## 1. Record the video

Use [`docs/video-script.md`](video-script.md). Target 9:30–9:50.

- [ ] 1080p screen recording, clear microphone.
- [ ] Part 1: client pitch, max 5 minutes.
- [ ] Part 2: technical review, max 5 minutes.
- [ ] Total runtime ≤ 10:00.
- [ ] Upload to YouTube as **Unlisted**.
- [ ] Title: `Windcast — day-ahead wind forecast intelligence (pilot demo)`.
- [ ] Description includes the live URL and the public repo URL.
- [ ] Open the YouTube link in an incognito window and confirm it plays.

## 2. Publish the repository

The repository name must be anonymous / random, e.g. `kjhwr`, `wndcst-7f3a`, not
the candidate's name or the company name.

```bash
cd /home/subhajit/project/windcast
git add -A
git commit -m "feat: windcast day-ahead wind forecast pilot"
gh repo create <anonymous-name> --public --source=. --remote=origin --push
```

Then:

- [ ] Open the GitHub repo in incognito and confirm it is public.
- [ ] Confirm `data/windcast.db` is present (2.5 MB) and `README.md` renders.
- [ ] Confirm `docs/screenshots/` images render.
- [ ] Copy the repo URL into the README if it is not already there.
- [ ] Add the repo URL to the submission form.

## 3. Incognito checks

Open each URL in a private window with no login:

- [ ] `https://windcast-pilot.vercel.app/` loads the dashboard.
- [ ] `/accuracy` loads the 31-day accuracy view.
- [ ] `/revisions` loads the vintage ledger.
- [ ] `/method` loads the method page.
- [ ] `/api/health` returns `{"status":"ok",...}`.
- [ ] A CSV export downloads: `/api/export/accuracy.csv`.
- [ ] No Vercel login wall and no 404.
- [ ] The GitHub repo is public.
- [ ] The YouTube video is playable.

## 4. Fill the form

Have these ready:

- Full name, email, phone (as requested by the form).
- Live app URL: `https://windcast-pilot.vercel.app`
- Public repo URL: `<anonymous repo>`
- Unlisted YouTube URL: `<video>`
- A one-paragraph summary if the form asks for one:

> Windcast is a vintage-aware day-ahead wind forecast dashboard for a GB energy
> utility. It selects only the WINDFOR publication that existed at 09:15 gate
> closure, quantifies raw and trailing-bias-corrected error (MAE 2,142 → 1,669
> MW), and translates the forecast into a thermal procurement gap with an
> empirical P90 buffer. React + FastAPI + Docker, deployed on Vercel; the January
> 2026 snapshot and 16 tests are in the repo.

- [ ] Submit the form.
- [ ] Keep a copy of the confirmation.

## 5. Final sanity pass

- [ ] README says how to run the app.
- [ ] README lists the files and directories.
- [ ] README links the live app.
- [ ] README discloses AI assistance.
- [ ] The video covers both parts and is under 10 minutes.
- [ ] The repo name is anonymous.
- [ ] The deployed app works in incognito.
