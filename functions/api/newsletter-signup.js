const MAILERLITE_GROUP_ID = '196706107879589450'

export async function onRequestPost(context) {
  try {
    const body = await context.request.json()
    const email =
      typeof body?.email === 'string'
        ? body.email.trim().toLowerCase()
        : ''

    if (!isValidEmail(email)) {
      return json({ error: 'Enter a valid email address.' }, 400)
    }

    if (!context.env.MAILERLITE_API_TOKEN) {
      console.error('Missing MailerLite API token.')
      return json({ error: 'Signup is temporarily unavailable.' }, 500)
    }

    const response = await fetch(
      'https://connect.mailerlite.com/api/subscribers',
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${context.env.MAILERLITE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email,
          groups: [MAILERLITE_GROUP_ID],
        }),
      },
    )

    if (!response.ok) {
      const result = await response.json().catch(() => null)
      console.error('MailerLite signup error:', result)
      return json(
        { error: 'Unable to join updates right now.' },
        response.status >= 500 ? 502 : 400,
      )
    }

    return json({ joined: true })
  } catch (error) {
    console.error('Newsletter signup error:', error)
    return json({ error: 'Unable to join updates right now.' }, 500)
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
