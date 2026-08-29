# platform

Runs against a real hosted Supabase Cloud project — no local Docker stack.

Setup (once):

    cp .env.example .env       # then fill in real values, see .env.example for where each comes from
    set -a; source .env; set +a
    npx supabase@latest link --project-ref "$SUPABASE_PROJECT_REF"

Every dev session:

    set -a; source .env; set +a
    npx supabase@latest db push --linked                                                          # applies any new migrations
    for f in supabase/tests/database/*.sql; do psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$f"; done   # runs pgTAP database/RLS tests
    cd supabase && deno task test                                                           # runs Edge Function unit tests

Required environment variables (see `.env.example`, values are set
per-environment, never committed): `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`,
`SUPABASE_ACCESS_TOKEN`, `STAFF_JWT_SECRET` (shared with every module
backend), `VMS_BACKEND_FUNCTIONS_URL` (vms/backend's Edge Functions base
URL, used to push organization syncs).