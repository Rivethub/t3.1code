# T3.1 Code builds (Rivethub)

Maintainer notes for cutting real artifacts from `Rivethub/t3.1code`. Upstream’s
full checklist stays in [release.md](./release.md); this page is the fork delta.

## Already done in this fork

- GitHub-hosted runners (no Blacksmith)
- Release / mobile / relay workflows accept `Rivethub/t3.1code`
- `PAUSE_NIGHTLY=true` so the schedule does not fire until you clear it
- `production` environment with `main` + `v*` deployment branch policies
- npm publish skipped here unless `ENABLE_NPM_PUBLISH=true` (upstream owns `t3`)
- AUR publish stays upstream-only
- Relay deploy and auto mobile/EAS jobs stay off until you set
  `ENABLE_RELAY_DEPLOY` / run them via `workflow_dispatch`

## First real desktop cut (unsigned is fine)

1. Fill the secrets/vars listed under “Need from a human” below that you care
   about. Preview needs almost none.
2. Prefer an idle Actions queue (a full CI run can saturate free concurrent
   jobs and leave Release sitting at `queued` with zero jobs).
3. From Actions → **Release** → Run workflow:
   - channel: `preview`
   - branch: `main`
4. Download artifacts from the GitHub prerelease it creates.

Preview reads Clerk/relay public ids from `.env.example` (no `production`
environment). Nightly/stable use the `production` environment.

## Need from a human

### Desktop signing (optional but needed for Gatekeeper / SmartScreen)

- Apple Developer team with Developer ID Application cert
- Secrets: `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_API_KEY`, `APPLE_API_KEY_ID`,
  `APPLE_API_ISSUER`, `MACOS_PROVISIONING_PROFILE`
- Var: `APPLE_TEAM_ID`
- Decide whether App ID stays `com.t3tools.t3code` or becomes a Rivethub id

- Azure Trusted Signing account
- Secrets: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`,
  `AZURE_TRUSTED_SIGNING_ENDPOINT`, `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`,
  `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME`,
  `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME`

### Stable version bumps

- GitHub App installed on `Rivethub/t3.1code` with contents write
- Secrets: `RELEASE_APP_ID`, `RELEASE_APP_PRIVATE_KEY`

### Mobile

- Expo org + EAS project (not `pingdotgg` / upstream `projectId`)
- New iOS/Android application ids if you want side-by-side installs
- Secrets: `EXPO_PREVIEW_TOKEN`, `EXPO_PRODUCTION_TOKEN`
- Optional: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `MOBILE_SOURCEMAPS_R2`,
  `T3_NATIVE_CLIENT_WRITE_TOKEN`

### T3 Connect / hosted web / marketing (only for cloud parity)

- Cloudflare, PlanetScale, Axiom, Clerk, APNS, FCM secrets and vars (see
  [release.md](./release.md#t3-connect-relay-deployment))
- Vercel: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, plus domain vars
- Optional: `OPENAI_API_KEY` (release notes), Discord webhook secrets

### npm launcher (optional)

- A package you own (do not publish over upstream `t3`) and OIDC trusted
  publisher for `.github/workflows/release.yml`
- Then set `ENABLE_NPM_PUBLISH=true` and change the launcher package name in
  code

### When ready for automatic nightlies

```bash
gh variable delete PAUSE_NIGHTLY -R Rivethub/t3.1code
# or: gh variable set PAUSE_NIGHTLY -b false -R Rivethub/t3.1code
```
