# CSV to Webhook

Take a CSV export from Tally, and call a webhook.
This script is a best-effort attempt at recreating the request that Tally would send to the webhook.

## Use case
You have set up a webhook to receive form responses from Tally (e.g. via Pipedream), but the Tally form contains existing data that needs to pass through the webhook too.

## Limitations
If a field has an "options" key, it is only populated with the values that were selected. The form may have other options than those available in the "options" list of the webhook payload (not exhaustive).

## Usage
1. Make the `ts-node` command available in your shell: `npm install -g ts-node`
2. Configure the `.env` file
3. Configure the `tally-webhook-mapping.ts` file to fit your data
4. Run the script: `ts-node tally-webhook.ts data/exported-form-data.csv`

Tally names your form by default like `[form name]_Submissions_[date of export]`.
This script assumes the same naming convention and will extract the form name from the file name.

If you grab the form id (e.g. `3E56oX` from `https://tally.so/forms/3E56oX/submissions`) and append it to the file name
(i.e. `[form name]_Submissions_[date of export]_[form id]`), then this script will also extract it and use it
in the webhook request (instead of `UNKNOWN`).

