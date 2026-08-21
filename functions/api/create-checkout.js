const PRODUCTS = {
  'H-001': {
    printifyProductId: '6a85cbe6745617b4590506f5',
    name: 'Grumpy Vampire',
    imagePrefix: 'grumpy-vampire',
    variants: {

  white: {
    S: 12102,
    M: 12101,
    L: 12100,
    XL: 12103,
    '2XL': 12104,
    '3XL': 12105,
    '4XL': 24031,
    '5XL': 24164,
      },

      sportgrey: {
    S: 12072,
    M: 12071,
    L: 12070,
    XL: 12073,
    '2XL': 12074,
    '3XL': 12075,
    '4XL': 24021,
    '5XL': 24153,
      },

      militarygreen: {
    S: 12192,
    M: 12191,
    L: 12190,
    XL: 12193,
    '2XL': 12194,
    '3XL': 12195,
    '4XL': 24060,
    '5XL': 24194,
      },

      lightpink: {
    S: 11964,
    M: 11963,
    L: 11962,
    XL: 11965,
    '2XL': 11966,
    '3XL': 11967,
    '4XL': 23985,
    '5XL': 24118,
      },
    },
  },
  'H-002': {
    printifyProductId: '6a87432dbf90413b190ff870',
    name: 'No Pictures Please',
    imagePrefix: 'no-pics-pls',
    variants: {
      white: {
        S: 12102,
        M: 12101,
        L: 12100,
        XL: 12103,
        '2XL': 12104,
        '3XL': 12105,
        '4XL': 24031,
        '5XL': 24164,
      },
      lightpink: {
        S: 11964,
        M: 11963,
        L: 11962,
        XL: 11965,
        '2XL': 11966,
        '3XL': 11967,
        '4XL': 23985,
        '5XL': 24118,
      },
    },
  },
}

const COLOR_NAMES = {
  white: 'White',
  sportgrey: 'Sport Grey',
  militarygreen: 'Military Green',
  lightpink: 'Light Pink',
}

const SIZES = [
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
]

export async function onRequestPost(context) {
  try {
    const body = await context.request.json()
    const { items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: 'Your bag is empty.' }, 400)
    }

    if (items.length > 20) {
      return json(
        { error: 'Too many different items.' },
        400,
      )
    }

    const origin = new URL(context.request.url).origin

    const form = new URLSearchParams()

    form.append('mode', 'payment')
    form.append('billing_address_collection', 'required')

    form.append(
      'shipping_address_collection[allowed_countries][0]',
      'GB',
    )

    /*
     * {CHECKOUT_SESSION_ID} is a Stripe template placeholder — Stripe
     * substitutes it with the real session id when it redirects the
     * buyer back, so the success page can look the order up (via
     * /api/order-details) and show them the order id / total.
     */
    form.append(
      'success_url',
      `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    )

    form.append(
      'cancel_url',
      `${origin}/?checkout=cancelled`,
    )

    items.forEach((item, index) => {
      const selectedProduct = PRODUCTS[item.productId]

      if (!selectedProduct) {
        throw new Error('Invalid product.')
      }

      if (!selectedProduct.variants[item.color]) {
        throw new Error('Invalid colour.')
      }

      if (!SIZES.includes(item.size)) {
        throw new Error('Invalid size.')
      }

      const variantId =
        selectedProduct.variants[item.color][item.size]

      if (!variantId) {
        throw new Error('That colour/size combination is unavailable.')
      }

      const quantity = Math.max(
        1,
        Math.min(
          10,
          Number.parseInt(item.quantity, 10) || 1,
        ),
      )

      const amount = ['3XL', '4XL', '5XL'].includes(
        item.size,
      )
        ? 2699
        : 2499

      const colorName = COLOR_NAMES[item.color]

      const imageUrl =
        `${origin}/images/mockups/${selectedProduct.imagePrefix}_${item.color}${selectedProduct.imagePrefix === 'no-pics-pls' ? '-mockup.png' : '.jpg'}`

      form.append(
        `line_items[${index}][price_data][currency]`,
        'gbp',
      )

      form.append(
        `line_items[${index}][price_data][unit_amount]`,
        String(amount),
      )

      form.append(
        `line_items[${index}][price_data][product_data][name]`,
        selectedProduct.name,
      )

      form.append(
        `line_items[${index}][price_data][product_data][description]`,
        `${colorName} / ${item.size}`,
      )

      form.append(
        `line_items[${index}][price_data][product_data][images][0]`,
        imageUrl,
      )

      form.append(
        `line_items[${index}][quantity]`,
        String(quantity),
      )

      /*
       * Stripe line-item metadata is not available directly
       * on price_data, so the complete order mapping is stored
       * on the Checkout Session below.
       */
    })

    /*
     * Store the validated cart in Stripe metadata.
     *
     * This lets the webhook know exactly which Printify
     * variant was purchased after Stripe confirms payment.
     */
    const orderItems = items.map((item) => ({
      productId: PRODUCTS[item.productId].printifyProductId,
      variantId:
        PRODUCTS[item.productId].variants[item.color][item.size],
      color: item.color,
      size: item.size,
      quantity: Math.max(
        1,
        Math.min(
          10,
          Number.parseInt(item.quantity, 10) || 1,
        ),
      ),
    }))

    const orderJson = JSON.stringify(orderItems)

    /*
     * Stripe metadata values have a size limit, so refuse
     * an unexpectedly large cart rather than silently
     * truncating it.
     */
    if (orderJson.length > 450) {
      return json(
        {
          error:
            'Your bag is too large to process in one checkout.',
        },
        400,
      )
    }

    form.append(
      'metadata[printify_items]',
      orderJson,
    )

    form.append(
      'metadata[hossu_order]',
      'H-001',
    )

    const stripeResponse = await fetch(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',

        headers: {
          Authorization:
            `Bearer ${context.env.STRIPE_SECRET_KEY}`,

          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body: form,
      },
    )

    const session = await stripeResponse.json()

    if (!stripeResponse.ok) {
      console.error('Stripe error:', session)

      return json(
        {
          error:
            session?.error?.message ||
            'Unable to create checkout session.',
        },
        500,
      )
    }

    return json({
      url: session.url,
    })
  } catch (error) {
    console.error('Checkout error:', error)

    return json(
      {
        error:
          error?.message ||
          'Unable to create checkout session.',
      },
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
