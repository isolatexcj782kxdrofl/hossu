const PRINTIFY_SHOP_ID = '28638401'
const PRINTIFY_PRODUCT_ID =
  '6a85cbe6745617b4590506f5'

export async function onRequestPost(context) {
  try {
    const signature =
      context.request.headers.get(
        'stripe-signature',
      )

    if (!signature) {
      return new Response(
        'Missing Stripe signature.',
        { status: 400 },
      )
    }

    const rawBody =
      await context.request.text()

    const valid = await verifyStripeSignature(
      rawBody,
      signature,
      context.env.STRIPE_WEBHOOK_SECRET,
    )

    if (!valid) {
      return new Response(
        'Invalid Stripe signature.',
        { status: 400 },
      )
    }

    const event = JSON.parse(rawBody)

    /*
     * Only create a Printify order after Stripe has
     * confirmed the Checkout Session is paid.
     */
    if (
      event.type !==
      'checkout.session.completed'
    ) {
      return json({
        received: true,
      })
    }

    const session = event.data.object

    if (session.payment_status !== 'paid') {
      return json({
        received: true,
        skipped: 'Payment not completed.',
      })
    }

    const printifyItems =
      session.metadata?.printify_items

    if (!printifyItems) {
      console.error(
        'Missing Printify metadata.',
      )

      return new Response(
        'Missing order metadata.',
        { status: 500 },
      )
    }

    const items = JSON.parse(printifyItems)

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        'Invalid Printify items.',
        { status: 500 },
      )
    }

    for (const item of items) {
      if (
        item.productId !==
        PRINTIFY_PRODUCT_ID
      ) {
        return new Response(
          'Invalid Printify product.',
          { status: 500 },
        )
      }
    }

    /*
     * Stripe Checkout collects the shipping address.
     */
    const shipping =
      session.shipping_details

    if (!shipping?.address) {
      return new Response(
        'Missing shipping address.',
        { status: 500 },
      )
    }

    const address = shipping.address

    const customerName =
      shipping.name ||
      session.customer_details?.name ||
      ''

    const nameParts =
      customerName.trim().split(/\s+/)

    const firstName =
      nameParts.shift() || 'Hossu'

    const lastName =
      nameParts.join(' ') || 'Customer'

    const lineItems = items.map(
      (item, index) => ({
        product_id: item.productId,
        variant_id: Number(item.variantId),
        quantity: Number(item.quantity),
        external_id:
          `${session.id}-${index + 1}`,
      }),
    )

    const printifyOrder = {
      external_id: session.id,

      label:
        `HOSSU-${session.id}`,

      line_items: lineItems,

      /*
       * 1 = standard shipping.
       */
      shipping_method: 1,

      send_shipping_notification: true,

      address_to: {
        first_name: firstName,
        last_name: lastName,

        email:
          session.customer_details?.email ||
          '',

        phone:
          session.customer_details?.phone ||
          '',

        country:
          address.country || 'GB',

        region:
          address.state || '',

        address1:
          address.line1 || '',

        address2:
          address.line2 || '',

        city:
          address.city || '',

        zip:
          address.postal_code || '',
      },
    }

    /*
     * Create the Printify order.
     */
    const printifyResponse =
      await fetch(
        `https://api.printify.com/v1/shops/${PRINTIFY_SHOP_ID}/orders.json`,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${context.env.PRINTIFY_TOKEN}`,

            'Content-Type':
              'application/json',

            'User-Agent':
              'Hossu/1.0',
          },

          body:
            JSON.stringify(printifyOrder),
        },
      )

    const printifyResult =
      await printifyResponse.json()

    if (!printifyResponse.ok) {
      console.error(
        'Printify order error:',
        printifyResult,
      )

      return new Response(
        'Printify order creation failed.',
        { status: 500 },
      )
    }

    console.log(
      'Printify order created:',
      printifyResult?.id,
    )

    return json({
      received: true,
      printifyOrderId:
        printifyResult?.id || null,
    })
  } catch (error) {
    console.error(
      'Stripe webhook error:',
      error,
    )

    return new Response(
      'Webhook processing failed.',
      { status: 500 },
    )
  }
}

/*
 * Stripe signs:
 *
 * timestamp + "." + raw request body
 *
 * using HMAC-SHA256.
 */
async function verifyStripeSignature(
  payload,
  signatureHeader,
  secret,
) {
  try {
    const parts =
      signatureHeader.split(',')

    const timestampPart =
      parts.find((part) =>
        part.startsWith('t='),
      )

    const signaturePart =
      parts.find((part) =>
        part.startsWith('v1='),
      )

    if (
      !timestampPart ||
      !signaturePart
    ) {
      return false
    }

    const timestamp =
      timestampPart.slice(2)

    const receivedSignature =
      signaturePart.slice(3)

    const timestampNumber =
      Number(timestamp)

    if (
      !Number.isFinite(
        timestampNumber,
      )
    ) {
      return false
    }

    /*
     * Reject signatures older than 5 minutes.
     */
    const age =
      Math.abs(
        Math.floor(
          Date.now() / 1000,
        ) - timestampNumber,
      )

    if (age > 300) {
      return false
    }

    const signedPayload =
      `${timestamp}.${payload}`

    const keyData =
      new TextEncoder().encode(secret)

    const cryptoKey =
      await crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'HMAC',
          hash: 'SHA-256',
        },
        false,
        ['sign'],
      )

    const signature =
      await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        new TextEncoder().encode(
          signedPayload,
        ),
      )

    const expectedSignature =
      [...new Uint8Array(signature)]
        .map((byte) =>
          byte
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')

    return timingSafeEqual(
      expectedSignature,
      receivedSignature,
    )
  } catch {
    return false
  }
}

function timingSafeEqual(
  a,
  b,
) {
  if (a.length !== b.length) {
    return false
  }

  let result = 0

  for (let i = 0; i < a.length; i++) {
    result |=
      a.charCodeAt(i) ^
      b.charCodeAt(i)
  }

  return result === 0
}

function json(
  data,
  status = 200,
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        'Content-Type':
          'application/json',
      },
    },
  )
}