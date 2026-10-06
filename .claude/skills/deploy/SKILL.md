---
name: deploy
description: Ship a change to frauerica.org, and prove it landed. Covers which of the four deploy loops a change belongs to, the exact commands and the flags that are load-bearing, and how to verify the live site is actually serving what you think. Use whenever deploying, publishing, pushing a snapshot, or asking "is this live yet?"
---

# Deploying

Four loops. Picking the wrong one usually fails *silently* — the deploy
succeeds and the site serves something else.

## Step 0, always: are you on main?

```sh
git branch --show-current   # must be main
git status --short          # must be clean
git pull
```

`hosting/deploy-app.sh` runs `npm run build` against **whatever is
checked out**. It does not look at the branch, warn, or check against
the remote.

On 2026-10-05 it was run from `an/add-benjamin-akers` — a branch cut
before the author-link PR merged. The deploy worked perfectly and
published a site missing a merged feature. Everything looked right: the
bucket timestamp was current, the PRs were merged, `main` was correct.
The only symptom was a feature quietly absent.

Branches are the trap. Clear merged ones out:

```sh
git branch --merged main | grep -v '^\*\|main' | xargs git branch -d
```

## Which loop?

| What changed | Loop |
|---|---|
| Documents, galleries, lexicon, photos, persons | **1. Public content** |
| Keepers / recipes | **2. Cookbook** |
| `app/` code | **3. Frontend** |
| `api/` code or `template.yaml` | **4. API** |
| `hosting/*.yaml` | **5. Infra** (rare) |

A database edit is often **two** loops. Persons and Families reach the
site *both* ways: `persons.json` for public pages, and the S3 snapshot
for gated family pages. Adding a person needs loop 1 **and** the
snapshot push, or their family page won't show them even though the
deploy succeeded.

### 1. Public content

```sh
cd app && npm run export-data
git diff app/src/data/generated/      # review before committing
git add -A app && git commit
hosting/deploy-app.sh
```

### 2. Cookbook — no export, no commit, no frontend deploy

Keepers is gated, so it reaches the site through the API, not the
committed JSON. The snapshot push **is** the publish step:

```sh
~/scripts/frau-erica-backup.sh
```

### 3. Frontend

```sh
cd app && npm run ci
# commit, merge to main, then from main:
hosting/deploy-app.sh
```

### 4. API

```sh
cd api && npm run ci
sam build && sam deploy
```

### 5. Infra

```sh
cd hosting
sam deploy --config-env dns     # Route53 zone, SES identity, DKIM, MX
sam deploy --config-env site    # S3 + CloudFront + ACM
```

**`--config-env` is not optional and not cosmetic.** `samconfig.toml`
keeps its settings under named environments, so without it `sam deploy`
can't even find the stack name. Worse, if you supply `--stack-name` by
hand to get past that error, you lose the environment's
`parameter_overrides` — and `CloudFrontDomain` defaults to `""` in
`dns.yaml`. That parameter is the cutover switch. Deploying the dns
stack without it points the apex and www back at the legacy EC2 box
(52.22.167.47) and takes the live site down, in about five minutes at
the 300s TTL.

The api stack imports `FrauEricaEmailIssuesTopic` from the dns stack, so
**dns deploys before api** when both change.

## Verify it landed

Not optional, and not "load the page and see". Both failures this week
looked fine from the browser.

### The frontend, properly

Vite fingerprints by content, so a local build of `main` must produce
exactly the filenames the CDN serves:

```sh
cd app && npm run build
curl -s https://frauerica.org/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'
ls dist/assets | grep -E '^index-.*\.js$'
```

Those two must match. For certainty, compare bytes:

```sh
for f in $(ls dist/assets | grep -E '^(index|textDisplay|mockPersons)-.*\.js$'); do
  curl -s "https://frauerica.org/assets/$f" > /tmp/live-$f
  cmp -s /tmp/live-$f dist/assets/$f && echo "$f ok" || echo "$f MISMATCH"
done
```

A *partial* match is the signature of a wrong-branch deploy: one data
chunk current, the code chunks stale.

Beware: a missing asset returns **200**, not 404 — CloudFront maps both
403 and 404 to `index.html` for the SPA. A 1,242-byte "JavaScript file"
is the HTML fallback, meaning that chunk isn't there at all.

### The snapshot

Don't trust the timestamp. Query the file the Lambda actually reads:

```sh
aws s3 cp s3://frau-erica-db-backups/current/frau_erica.db /tmp/snap.db \
  --profile frau-erica-v2-deploy --quiet
sqlite3 /tmp/snap.db "SELECT ... ;"   # ask for the thing you just changed
```

### The API

```sh
aws lambda get-function-configuration \
  --function-name frau-erica-api-<Name>Function-<suffix> \
  --query LastModified --profile frau-erica-v2-deploy --region us-east-1
```

Note the **log group** and the **function** have different names:
`/aws/lambda/frau-erica-api-request-access` is the log group;
`frau-erica-api-RequestAccessFunction-Z0kbqkf4iupv` is the function.
Asking for one by the other's name returns ResourceNotFound.

For IAM changes, read the live policy back — a template that validates
is not a policy that works:

```sh
aws iam get-role-policy --role-name <role> --policy-name <policy> \
  --query 'PolicyDocument.Statement[?Sid==`<Sid>`]'
```

## The nightly job

`com.frauerica.backup` runs `frau-erica-backup.sh` at 20:00 daily. It
pushes the local iCloud database to S3 — meaning **the laptop's copy is
always authoritative**. Nothing that writes to the snapshot in the cloud
will survive it.

## Don't claim it's done until it's proved

Three times this week the configuration looked right and the thing
didn't work: a stale branch deploy, an IAM identity grant that still
couldn't send, and a configuration-set grant underneath it. Each was
caught by checking the live system — never by reading the diff.
