# Windcast — 10-minute video script

**Target runtime:** 9:30–9:50 (hard limit 10:00).
**Format:** unlisted YouTube, 1080p, screen + voice. No face cam required.
**Live app:** https://windcast-pilot.vercel.app

---

## Before you record

- [ ] Close Slack, email and notifications. Turn on Do Not Disturb.
- [ ] Browser at 100% zoom, window ~1440 px wide. Hide bookmarks bar.
- [ ] Open four tabs, in this order:
  1. `https://windcast-pilot.vercel.app/` (Overview)
  2. `https://windcast-pilot.vercel.app/accuracy`
  3. `https://windcast-pilot.vercel.app/revisions`
  4. `https://windcast-pilot.vercel.app/method`
- [ ] Have a second window/tab ready with the GitHub repo:
  - `backend/app/services/analytics.py`
  - `backend/app/services/elexon.py`
  - `backend/app/api/routes.py`
  - `backend/tests/test_analytics.py`
- [ ] Test the mic for 15 seconds. Record a 20-second test clip and play it back.
- [ ] Say the numbers out loud once: **2,142 MW**, **1,669 MW**, **22.1%**,
      **4.3 GW**, **307.5 GWh**, **250.2 GWh**, **2,390 MW**, **581.3 GWh**.
- [ ] Keep the cursor still when you are not clicking. Move it off-screen during
      explanations.

---

# Part 1 — Client pitch (0:00–5:00)

## 0:00–0:30 — Hook

**Show:** Overview page, default state (31 Jan 2026, raw WINDFOR).

**Say:**

> "Every day, a GB energy utility has to buy power one day before it knows how
> windy it will be. Get it wrong and you either overpay for thermal generation or
> leave yourself short. Windcast is the decision screen for that moment: the
> latest forecast the desk could actually have used, and the error it should plan
> for."

## 0:30–1:10 — The two questions

**Show:** Point at the top strip: *Delivery 31 January 2026 · Gate closure 09:15 ·
Vintage 30 Jan 07:30 · No look-ahead*.

**Say:**

> "The desk needs two things at gate closure. First, the latest forecast that
> existed at that moment. Second, a quantified view of how wrong forecasts like
> it have been. Most dashboards show the newest forecast available *now* — which
> is hindsight. We don't. Every number here is selected from the vintage that was
> published before the 09:15 cut-off. The 09:30 run exists, but it is one hour
> and forty-five minutes too late."

## 1:10–2:05 — The raw picture

**Show:** KPI row and the forecast chart. Hover one hour to show the tooltip.

**Say:**

> "For 31 January, the usable forecast was 307.5 gigawatt-hours. Actual wind came
> in at 250.2. The mean miss is 2,390 megawatts, and nine hours in ten fall inside
> a 3.1-gigawatt error band. That is not a rounding error; it is the difference
> between a comfortable position and a very expensive one."

## 2:05–2:50 — The correction

**Show:** Click **Bias-corrected**. Point at the dashed raw line vs the solid
calibrated line, then the KPI row.

**Say:**

> "The raw WINDFOR series runs high against metered wind. We don't hide it. We
> measure the trailing fourteen-day bias using only prior days, and offer a
> corrected view. The corrected forecast is 258.7 gigawatt-hours; the P90 error
> drops to 1.2 gigawatts; the bias falls to 354 megawatts. The chart keeps the raw
> series as a dashed reference, so the customer can see exactly what changed."

## 2:50–3:45 — The accuracy evidence

**Show:** Accuracy tab. Point at the calibration-impact callout, then the daily
bars, the histogram, and the worst-days list.

**Say:**

> "Across the full month, 744 matched hours: raw MAE 2,142 megawatts; calibrated
> 1,669 — a 22 percent reduction. The distribution shows the problem clearly:
> most misses are positive. The worst day, 28 January, missed by 5.4 gigawatts.
> This is the evidence the desk needs to size a buffer, not just a prettier
> forecast."

## 3:45–4:30 — Auditability

**Show:** Revisions tab. Point at the used line, the late lines, the table, then
the *late-run trap* card.

**Say:**

> "A forecast is a sequence of guesses. This page replays all 24 publications for
> the day. The acid line is the 07:30 run — the last one available before gate
> closure. The coral dashed lines arrived too late. We keep them visible so the
> client can audit the rule, but they are never eligible. If we used the 09:30
> run, our accuracy would look better than the desk's reality. That is the one
> thing a forecast product must never do."

## 4:30–5:00 — Procurement and close

**Show:** Overview, scroll to **Sizing the thermal gap**. Drag demand from 35 to
42 GW. Point at the residual, buffer and after-buffer numbers.

**Say:**

> "At 35 gigawatts of demand, wind covers about 31 percent, leaving 581
> gigawatt-hours of thermal need. Holding the trailing P90 buffer — 2.8 gigawatts
> — covers nine hours in ten and brings the unhedged gap down to 513. At 42
> gigawatts it scales with the operator's assumption. This is the pilot: one
> screen, one rule, one auditable number. The next step is to run it live with
> demand, prices and interconnector flows."

---

# Part 2 — Technical review (5:00–10:00)

## 5:00–5:40 — Architecture

**Show:** Method tab, architecture panel; then the repo tree.

**Say:**

> "The stack is React and TypeScript with Vite on the front, FastAPI and SQLite
> on the back, and a Python ingest pipeline. The same container serves the API
> and the built SPA. There are three layers: a cached Elexon client, a cleaning
> and snapshot layer, and a vintage-aware analytics service. The frontend has no
> chart library; the SVG charts are hand-built so the error band, tooltip and
> revision encoding are exactly what the product needs."

## 5:40–6:40 — Data and the vintage rule

**Show:** `backend/app/services/elexon.py` (chunking/caching), then
`backend/app/services/analytics.py` around `_selected_forecasts`.

**Say:**

> "Elexon caps a query at seven days, so the client chunks by six days, retries
> with backoff, and caches every raw response as gzipped JSON. The ingest filters
> FUELHH to WIND, deduplicates half-hours, and drops WINDFOR rows published after
> delivery. The critical query is a window function: partition by delivery hour,
> order by publish time descending, and only consider publications at or before
> the cut-off. That is the look-ahead guard in one place."

## 6:40–7:40 — Calibration and tests

**Show:** `calibration_for_day` and `accuracy_bundle`, then run `make test` in a
terminal (or show the passing output).

**Say:**

> "Calibration is deliberately simple and explainable: the mean signed error over
> the previous fourteen days, with a minimum of 48 matched hours. No future data.
> The accuracy endpoint returns both raw and calibrated summaries, so the
> comparison is always visible. The test suite covers the vintage rule, the
> half-hour-to-hour aggregation, the calibration, API contracts and ingest
> cleaning. Sixteen tests, all passing."

## 7:40–8:30 — Frontend and API contract

**Show:** `frontend/src/pages/Overview.tsx`, `components/charts/ForecastChart.tsx`,
and the API docs at `/docs` if available.

**Say:**

> "The frontend is URL-driven: date, cut-off and calibration live in the query
> string, so every view is shareable and reproducible. The API returns typed JSON
> with the selected vintage, the raw series and the corrected series. The charts
> are responsive SVG with custom tooltips; no heavy chart dependency. The design
> is intentionally a control-room aesthetic: dark, high-contrast, tabular numbers
> and one accent colour for the number that matters."

## 8:30–9:15 — Deployment and operations

**Show:** `Dockerfile`, `vercel.json`, and the live URL.

**Say:**

> "Locally, Docker Compose builds the React app, copies the SQLite snapshot and
> runs Uvicorn. The production image is multi-stage and runs as a non-root user.
> On Vercel, the FastAPI framework support builds the frontend and bundles the
> snapshot inside the static mount. The function opens it with SQLite
> `mode=ro&immutable=1`, which is required because Vercel's filesystem is
> read-only. That was the one non-obvious deployment fix."

## 9:15–9:45 — Trade-offs and next steps

**Show:** Method page, limitations section.

**Say:**

> "Three honest limitations. First, FUELHH and WINDFOR are not perfectly
> like-for-like, so the measured bias includes scope and curtailment; the app
> says so and keeps both views. Second, demand is not in the dataset — the slider
> is an explicit assumption, not a measurement. Third, this is a fixed January
> snapshot; production needs a scheduler, freshness checks and late-publication
> alerts. Next I would add embedded wind, day-ahead prices and a probabilistic
> calibration by regime."

## 9:45–10:00 — Close

**Show:** Overview page, final state.

**Say:**

> "The repo has the Docker setup, the Vercel config, the tests and the README. The
> live link is in the video description. The one-line summary: Windcast shows the
> forecast you had, and the error you should plan for. Thank you."

---

## Demo click path (cheat sheet)

1. Overview → point at vintage strip → hover chart at 12:00.
2. Overview → **Bias-corrected** toggle → point at P90 and bias.
3. Accuracy tab → calibration impact → daily bars → histogram → worst days.
4. Revisions tab → chart → ledger → *late-run trap*.
5. Overview → demand slider 35 → 42 → point at residual/after buffer.
6. Method tab → architecture → limitations.

## Numbers to keep straight

| Number | Meaning |
|---|---|
| **307.5 GWh** | Raw forecast energy, 31 Jan |
| **250.2 GWh** | Actual wind energy, 31 Jan |
| **2,390 MW** | Raw bias on 31 Jan |
| **258.7 GWh** | Bias-corrected forecast energy |
| **1.2 GW** | Calibrated P90 for 31 Jan |
| **2,142 MW** | Raw MAE for January |
| **1,669 MW** | Calibrated MAE for January |
| **22.1%** | MAE reduction |
| **4.3 GW** | Raw P90 for January |
| **3.6 GW** | Calibrated P90 for January (approx.) |
| **581.3 GWh** | Thermal gap at 35 GW demand |
| **512.9 GWh** | Gap after P90 buffer |

## Delivery notes

- Do not read the script word for word; use it as a spine. The best takes sound
  like you are showing a colleague.
- Pause for one beat when you switch pages. Let the chart load.
- If you make a mistake, restart the section, not the whole video.
- Keep Part 1 under 5:00 and Part 2 under 5:00. The total is what is evaluated.
- Upload as **Unlisted**, title: `Windcast — day-ahead wind forecast intelligence
  (pilot demo)`. Put the live URL and repo URL in the description.
- Test the YouTube link in incognito before submitting.
