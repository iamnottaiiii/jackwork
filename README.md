# Jackwork

Jackwork is a web app for Liberia that connects people who need a service
with people who can do the work. Post a job in a few taps, or find work near
you. One profile per person, used both to post jobs and to accept them.
Sign in is name plus phone number plus a one-time code, no password.

Live at https://jackwork.bjvfi.com

## How it runs

- `web/` is the static client build, built from the `source/` snapshot.
  It talks to the backend by POSTing `{action, args}` JSON to `./actions`
  on the same host.
- `worker/worker.js` is ONE Cloudflare Worker. It serves the static build
  and answers every action call (profiles, sign-in codes, jobs, ratings)
  from a Cloudflare D1 database, with the schema in `worker/schema.sql`.
  Uploaded photos (profile pictures, ID documents) are stored in a `blobs`
  table in the same database and served by the worker under `/blobs/`.
  The same worker serves a separate view-only admin page at `/admin`
  (`worker/admin.html`), gated to the owner's own phone number through
  the same sign-in code flow. Nothing in the user app links to it.
- `tools/` holds the deploy scripts used from the Muse workspace. They
  talk to the Cloudflare API through the owner's connected account and are
  kept here so the setup can be maintained and redeployed.
- `source/` is the original Space source (React client and server actions)
  that the live build was made from, kept for reference and future work.

## Known test-launch gaps

- Sign-in codes are shown on screen, because no SMS texting line is
  connected yet. This is test behavior, not the final sign-in.
- Mobile Money is on hold by the owner's decision. The job flow rehearses
  the approved structure with taps only (poster marks the money sent,
  Jackwork shows it held, completion shows a payout message), but no real
  money moves through the app and no merchant number exists yet.
- Brewerville's communities are in the place data but Brewerville itself
  has no surveyed town point in the source dataset, so it cannot be picked
  yet. Nothing was invented to fill that gap.
