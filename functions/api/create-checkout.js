export async function onRequestPost(context) {
  try {
    const { items } = await context.request.json()

    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: 'Your bag is empty.' }, 400)
    }

    if (items.length > 20) {
      return json({ error: 'Too many different items.' }, 400)
    }

    const allowedColors = {
      white: 'White',
      sportgrey: 'Sport Grey',
      militarygreen: 'Military Green',
      lightpink: 'Light Pink',
    }

    const allowedSizes = [
      'S',
      'M',
      'L',
      'XL',
      '2XL',
      '3XL',
      '4XL',
      '5XL',
    ]

    const origin = new URL(context.request.url).origin

    const form = new URLSearchParams()

    form.append('mode', 'payment')
    form.append('billing_address_collection', 'required')

    form.append(
      'shipping_address_collection[allowed_countries][0]',
      'GB',
    )

    form.append(
      'success_url',
      `${origin}/?checkout=success`,
    )

    form.append(
      'cancel_url',
      `${origin}/?checkout=cancelled`,
    )

    items.forEach((item, index) => {
      if (item.productId !== 'H-001') {
        throw new Error('Invalid product.')
      }

      if (!allowedColors[item.color]) {
        throw new Error('Invalid colour.')
      }

      if (!allowedSizes.includes(item.size)) {
        throw new Error('Invalid size.')
      }

      const quantity = Math.max(
        1,
        Math.min(10, Number.parseInt(item.quantity, 10) || 1),
      )

      const amount = ['3XL', '4XL', '5XL'].includes(item.size)
        ? 2699
        : 2499

      const colorName = allowedColors[item.color]

      const imageUrl =
        `${origin}/images/mockups/grumpy-vampire_${item.color}.jpg`

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
        'Grumpy Vampire',
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
    })

    const stripeResponse = await fetch(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${context.env.STRIPE_SECRET_KEY}`,
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