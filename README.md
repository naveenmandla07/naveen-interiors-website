# Naveen Interiors Website

Interior design gallery and enquiry website with a lightweight Node.js backend.

## Run locally

Requires Node.js 18 or newer. From the project root:

```sh
node backend/server.js
```

Open http://127.0.0.1:3000 in a browser.

Design enquiries are saved locally under `backend/data/`. That directory is excluded from Git because it contains visitor-submitted personal information.

## Deploy with Vercel, Supabase, and Resend

The `api/` directory contains Vercel serverless handlers. For production persistence and email notifications:

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor.
2. In Supabase project settings, copy the Project URL and the `service_role` API key. Keep the service-role key private.
3. Create a Resend account, add and verify a sending domain, and create an API key. Use a sender address on that verified domain.
4. In Vercel project settings, add these Environment Variables for Production (and Preview if needed):

	- `SUPABASE_URL`
	- `SUPABASE_SERVICE_ROLE_KEY`
	- `RESEND_API_KEY`
	- `RESEND_FROM_EMAIL` (for example, `Naveen Interiors <enquiries@your-verified-domain.com>`)
	- `NOTIFICATION_EMAIL` (the inbox where enquiries should arrive)

5. Redeploy the Vercel project after setting the variables.

Never add these values to source files or send them in chat. The service-role key bypasses Supabase row-level security; it is used only by the Vercel server functions. The public website does not access it directly.

The API saves each request to Supabase before sending its Resend notification. If email delivery is unavailable, the request remains saved and the API reports `notificationSent: false`.