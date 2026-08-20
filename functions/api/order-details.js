/*
 * GET /api/order-details?session_id=cs_...
 *
 * Called by the success page (App.jsx) after Stripe redirects the buyer
 * back with ?checkout=success&session_id=... — looks the session up on
 * Stripe's side (server-to-server, using the secret key) and returns
 * just the bits the confirmation page needs. Never trust the session id
 * on its own; it's only used to fetch the session FROM Stripe, so
 * there's nothing for a visitor to fake here.
 */
export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url)
    const sessionId = url.searchParams.get('session_id')

    if (!sessionId || !sessionId.startsWith('cs_')) {
      return json({ error: 'Missing or invalid session id.' }, 400)
    }

    const stripeResponse = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(
        sessionId,
      )}?expand[]=customer_details`,
      {
        headers: {
          Authorization:
            `Bearer ${context.env.STRIPE_SECRET_KEY}`,
        },
      },
    )

    const session = await stripeResponse.json()

    if (!stripeResponse.ok) {
      console.error('Stripe error:', session)

      return json(
        { error: session?.error?.message || 'Order not found.' },
        stripeResponse.status === 404 ? 404 : 500,
      )
    }

    if (session.payment_status !== 'paid') {
      return json(
        { error: 'This order has not been paid for.' },
        409,
      )
    }

    return json({
      orderId: session.id,
      email:
        session.customer_details?.email ||
        session.customer_email ||
        null,
      total:
        typeof session.amount_total === 'number'
          ? session.amount_total / 100
          : null,
      currency: session.currency
        ? session.currency.toUpperCase()
        : null,
    })
  } catch (error) {
    console.error('Order lookup error:', error)

    return json(
      { error: 'Unable to load order details.' },
      500,
    )
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,

    headers: {
      'Content-Type': 'application/json',
    },
  })
}
