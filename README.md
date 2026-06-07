# AG Traders — Billing Portal

Local invoice generator for AG Traders (Tiruchengode). Generate GST invoices, download as PDF, share via WhatsApp / Email, and keep a record of every completed bill in the cloud database.

---

## Run on Mac (simple)

### 1. One-time setup

Install [Bun](https://bun.sh) (recommended) — open Terminal and paste:

```bash
curl -fsSL https://bun.sh/install | bash
```

Close & reopen Terminal after install completes.

### 2. Get the project on your Mac

If you have git:

```bash
git clone <your-repo-url> ag-traders-billing
cd ag-traders-billing
```

Or just download the project ZIP from Lovable, unzip it, and `cd` into the folder.

### 3. Install dependencies (one time)

```bash
bun install
```

### 4. Add the backend config

Make sure the `.env` file exists in the project root with these lines (already included in this project):

```
VITE_SUPABASE_URL=https://cuznulmolljbybohxocw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_r8Sx2yo-cN-AUzHc3z55ag_unVjzqei
VITE_SUPABASE_PROJECT_ID=cuznulmolljbybohxocw
```

### 5. Start the app

```bash
bun run dev
```

Open the URL it prints (usually <http://localhost:3000>) in your browser.

That's it. The app is now running on your Mac.

---

## Daily use

1. Fill in customer details, items, and rates.
2. **Save Bill** — saves the invoice record to the cloud database.
3. **Download PDF** — saves an A4 PDF of the invoice to your Downloads folder.
4. **WhatsApp / Email** — opens a pre-filled message with invoice summary.
5. **Print Invoice** — sends the invoice straight to your printer (or "Save as PDF" from the macOS print dialog).

---

## Tips

- The Description field auto-completes from your product catalog (`src/data/products.ts`). Picking a product auto-fills HSN, Unit, and Rate.
- To update the product list, edit `src/data/products.ts` (or re-import from a CSV).
- All saved bills are stored in the `bills` table — you can view them in the Lovable Cloud dashboard.

## Troubleshooting

- **Port already in use?** Run `bun run dev --port 4000` to use a different port.
- **PDF looks blurry?** It's rendered at 2× scale; should be crisp. Increase `scale: 2` in `src/routes/index.tsx` if needed.
- **Can't save bill?** Check internet connection — the cloud database needs network access.
