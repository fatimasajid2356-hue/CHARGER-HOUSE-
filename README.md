# Charger House — Mobile Accessories Store

Hall Road, Khadim Centre, Shop B-28, Lahore — 0301-8400847

A self-hosted store: a product catalog with retail/sale pricing, a storefront
customers can order from, and an admin page for adding/editing products.
Checkout supports Cash on Delivery, with a slot ready for a real online
payment gateway. Data is stored in Postgres.

## Environment variables

- `DATABASE_URL` — your Postgres connection string (Render provides this
  automatically once you attach a Postgres database to this service).
- `ADMIN_PASSWORD` — the password for `/admin.html`. Set your own before
  going live; don't leave it as the default.

## Run it locally

```bash
npm install
DATABASE_URL=postgres://user:pass@host:5432/dbname ADMIN_PASSWORD=yourpassword npm start
```

The app creates its own tables on first run and seeds a starter catalog if
the products table is empty.

- Storefront: http://localhost:3000
- Admin panel: http://localhost:3000/admin.html

## Deploying on Render

1. Push this code to a GitHub repository.
2. In Render, create a Postgres database and note its Internal Database URL.
3. Create a Web Service from the repo:
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment variables: `DATABASE_URL` (from step 2), `ADMIN_PASSWORD`
     (your own password)
4. Deploy. Your storefront will be live at the URL Render gives you.

## Adding real online payment

Choosing "Pay online" at checkout currently records the order as
`awaiting_payment` — there's no live payment gateway wired in yet. Common
paths:

- **Stripe** — install the Stripe SDK, create a Checkout Session for
  `online` orders in `/api/orders`, redirect the customer, and use a webhook
  to mark the order `paid`.
- **JazzCash / Easypaisa** — sign up for a merchant account, then follow a
  similar create-request → redirect → webhook flow using their API docs.

Keep COD as a fallback either way — many accessory buyers prefer to inspect
the item before paying.

## Customizing the look

Colors, fonts, and spacing live in `public/css/style.css` as CSS variables
at the top of the file.
