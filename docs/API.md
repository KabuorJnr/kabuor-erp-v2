# Kabuor ERP public API

For an online shop, a delivery app or an accountant's tool to work with one business's books. The business owner
makes a key in **Settings → Connections**; it is shown once. Base address: `https://<erp address>/api/v1`.
Every request sends the key in the `X-Api-Key` header. Money is in **cents** (KSh 650 = `65000`), VAT-inclusive.

## GET /items
Products and services on sale: `id`, `name`, `sku`, `unit`, `price`, `taxType`, and `inStock` (null for
services and anything not counted in stock).

## POST /orders
An order from another system, issued straight away as an invoice (signed with KRA eTIMS when the business is
VAT-registered).

```json
{
  "externalRef": "SHOP-1042",
  "customerName": "Achieng Otieno",
  "customerPhone": "0733 444 555",
  "lines": [{ "sku": "HNY500", "quantity": 2 }, { "description": "Delivery", "quantity": 1, "unitPrice": 20000 }],
  "mpesaReceipt": "TJK9XYZ001",
  "amountPaid": 150000,
  "notes": "Online order SHOP-1042"
}
```

- `externalRef` is your order number. **The same reference is only ever recorded once**: if a request times out,
  send it again; the second answer has `"alreadyRecorded": true`.
- Lines match products by `itemId` or `sku`; a line without a match needs `description` and `unitPrice`. Leave
  out `unitPrice` to use the business's own price (including the customer's price list).
- The customer is found by phone, or added.
- `mpesaReceipt` (already paid): the payment Safaricom reported is used, or recorded, and the invoice is paid.
  Without it the invoice is left to pay, and the customer's credit limit applies.
- Answer: `{ externalRef, invoice, status, total, paid, balance, etims, customer, alreadyRecorded }`.

## GET /orders/{externalRef}
The same answer, for checking status later.

## Errors
`401` no or wrong key · `402` the business's trial has ended (reading still works) · `400`/`409` the order can't be
recorded, with `{ "error": "<reason a person can read>" }`.

## Webhooks
Settings → Connections → add an `https://` address. Events, as `POST` with a JSON body:

| Event | When | `data` |
|---|---|---|
| `payment.received` | any money in (M-Pesa, cash, bank) | id, method, amount, reference, payerPhone, payerName, accountRef, receivedAt |
| `invoice.paid` | an invoice is paid in full | id, number, total, paid, externalRef (orders from the API), payment |

Body: `{ "id": "<event id>", "type": "invoice.paid", "createdAt": "…", "data": { … } }`.
Headers: `X-Kabuor-Event`, `X-Kabuor-Delivery` (unique per delivery), and `X-Kabuor-Signature: sha256=<hex>`,
the HMAC-SHA256 of the raw body with the endpoint's signing secret. Check it before trusting the message:

```js
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers['x-kabuor-signature']));
```

Answer any 2xx quickly. Anything else is retried after 1 min, 5 min, 30 min, 2 h, 6 h and 12 h, then given up
(the owner sees failing deliveries in Settings → Connections). The same event can arrive twice: use the event `id`.
