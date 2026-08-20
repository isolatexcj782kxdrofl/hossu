import { useEffect, useRef, useState } from 'react'
import './App.css'

const product = {
  id: 'H-001',
  name: 'GRUMPY VAMPIRE',
  type: 'T-SHIRT',
  description: "It's just one of those days.",

  colours: [
    {
      name: 'White',
      key: 'white',
      image: '/images/mockups/grumpy-vampire_white.jpg',
    },
    {
      name: 'Sport Grey',
      key: 'sportgrey',
      image: '/images/mockups/grumpy-vampire_sportgrey.jpg',
    },
    {
      name: 'Military Green',
      key: 'militarygreen',
      image: '/images/mockups/grumpy-vampire_militarygreen.jpg',
    },
    {
      name: 'Light Pink',
      key: 'lightpink',
      image: '/images/mockups/grumpy-vampire_lightpink.jpg',
    },
  ],

  sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
}

const getPrice = (size) =>
  ['3XL', '4XL', '5XL'].includes(size) ? 26.99 : 24.99

// Triggers once, the first time the element scrolls into view — used to
// bring the archive and contact sections in gently instead of them just
// snapping into place.
function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current

    if (!node) {
      return undefined
    }

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(node)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  return [ref, visible]
}

// Reads ?checkout=success|cancelled and ?session_id=... from the URL once,
// on first load. Stripe (or whatever's building the success_url) appends
// session_id automatically if the URL template includes
// {CHECKOUT_SESSION_ID}.
function getCheckoutParams() {
  if (typeof window === 'undefined') {
    return { status: null, sessionId: null }
  }

  const params = new URLSearchParams(window.location.search)

  return {
    status: params.get('checkout'),
    sessionId: params.get('session_id'),
  }
}

function App() {
  const initialCheckout = useRef(getCheckoutParams()).current

  const [view, setView] = useState(() => {
    if (initialCheckout.status === 'success') return 'order-success'
    if (initialCheckout.status === 'cancelled') return 'order-cancelled'
    return 'home'
  })
  const [selectedColour, setSelectedColour] = useState(
    product.colours[0],
  )
  const [selectedSize, setSelectedSize] = useState('')
  const [bag, setBag] = useState(() => {
    try {
      const savedBag = localStorage.getItem('hossu-bag')

      if (!savedBag) {
        return []
      }

      const parsedBag = JSON.parse(savedBag)

      return Array.isArray(parsedBag)
        ? parsedBag
        : []
    } catch {
      return []
    }
  })
  const [message, setMessage] = useState('')
  const [addedToBag, setAddedToBag] = useState(false)
  const [checkoutLoading, setCheckoutLoading] =
    useState(false)
  const [checkoutError, setCheckoutError] =
    useState('')
  const [bagBump, setBagBump] = useState(false)

  const [orderId, setOrderId] = useState(
    initialCheckout.sessionId,
  )
  const [orderDetails, setOrderDetails] = useState(null)
  const [orderLoading, setOrderLoading] = useState(
    Boolean(initialCheckout.sessionId),
  )

  const [archiveRef, archiveVisible] = useReveal()
  const [gridRef, gridVisible] = useReveal()
  const [contactRef, contactVisible] = useReveal()

  // Save the bag whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(
        'hossu-bag',
        JSON.stringify(bag),
      )
    } catch {
      console.error(
        'Unable to save Hossu bag.',
      )
    }
  }, [bag])

  // Runs once on load if we landed here from Stripe. Clears the bag on a
  // successful order, strips the ?checkout=... query string so a refresh
  // doesn't replay the same state, and (if a session id is present) asks
  // the backend for the order details to show on the confirmation page.
  useEffect(() => {
    if (!initialCheckout.status) {
      return
    }

    if (initialCheckout.status === 'success') {
      setBag([])
    }

    window.history.replaceState(
      {},
      '',
      window.location.pathname,
    )

    if (
      initialCheckout.status === 'success' &&
      initialCheckout.sessionId
    ) {
      fetch(
        `/api/order-details?session_id=${encodeURIComponent(
          initialCheckout.sessionId,
        )}`,
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error('Unable to load order details.')
          }
          return response.json()
        })
        .then((data) => {
          setOrderDetails(data)
          if (data?.orderId) {
            setOrderId(data.orderId)
          }
        })
        .catch(() => {
          // No backend endpoint yet, or it failed — the confirmation
          // page still works fine with just the session id.
        })
        .finally(() => {
          setOrderLoading(false)
        })
    } else {
      setOrderLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openView = (nextView) => {
    setView(nextView)
    setMessage('')
    setCheckoutError('')
    window.scrollTo(0, 0)
  }

  const goToPieces = (event) => {
    if (view === 'home') {
      return
    }

    event.preventDefault()
    openView('home')

    requestAnimationFrame(() => {
      document
        .getElementById('archive')
        ?.scrollIntoView({ behavior: 'smooth' })
    })
  }

  const openProduct = () => {
    setAddedToBag(false)
    setSelectedSize('')
    setSelectedColour(product.colours[0])
    openView('product')
  }

  const addToBag = () => {
    if (!selectedSize) {
      setMessage('SELECT A SIZE')
      return
    }

    const existingItem = bag.find(
      (item) =>
        item.productId === product.id &&
        item.colour.key === selectedColour.key &&
        item.size === selectedSize,
    )

    if (existingItem) {
      setBag(
        bag.map((item) =>
          item.productId === product.id &&
          item.colour.key === selectedColour.key &&
          item.size === selectedSize
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        ),
      )
    } else {
      setBag([
        ...bag,
        {
          productId: product.id,
          name: product.name,
          price: getPrice(selectedSize),
          colour: selectedColour,
          size: selectedSize,
          quantity: 1,
        },
      ])
    }

    setMessage('ADDED TO BAG')
    setAddedToBag(true)

    setBagBump(true)
    setTimeout(() => {
      setBagBump(false)
    }, 500)

    setTimeout(() => {
      setMessage('')
    }, 1800)
  }

  const changeQuantity = (index, amount) => {
    setBag((currentBag) =>
      currentBag
        .map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                quantity: Math.max(
                  0,
                  item.quantity + amount,
                ),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  const checkout = async () => {
    if (bag.length === 0) {
      return
    }

    setCheckoutLoading(true)
    setCheckoutError('')

    try {
      const items = bag.map((item) => ({
        productId: item.productId,
        color: item.colour.key,
        size: item.size,
        quantity: item.quantity,
      }))

      const response = await fetch(
        '/api/create-checkout',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items }),
        },
      )

      const data = await response.json()

      if (!response.ok || !data.url) {
        throw new Error(
          data.error ||
            'Unable to start checkout.',
        )
      }

      window.location.href = data.url
    } catch (error) {
      console.error(error)

      setCheckoutError(
        error.message ||
          'Something went wrong. Please try again.',
      )

      setCheckoutLoading(false)
    }
  }

  const bagCount = bag.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  const subtotal = bag.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0,
  )

  return (
    <div className="site">
      <header className="header">
        <button
          className="logo"
          type="button"
          onClick={() => openView('home')}
          aria-label="Back to Hossu home"
        >
          <img
            src="/images/hossu-icon.png"
            alt="Hossu"
          />
        </button>

        <nav className="nav">
          <button
            type="button"
            onClick={() => openView('home')}
          >
            Archive
          </button>

          <a href="#archive" onClick={goToPieces}>
            Pieces
          </a>
        </nav>

        <button
          className={`bag ${bagBump ? 'bump' : ''}`}
          type="button"
          onClick={() => openView('bag')}
        >
          Bag [{bagCount}]
        </button>
      </header>

      <main id="top">
        {view === 'home' && (
          <>
            <section className="hero">
              <div className="hero-meta">
                <span>HSS / 2026</span>
                <span>ARCHIVE_001</span>
              </div>

              <div className="hero-title">
                <img
                  src="/images/hossu-logo.png"
                  alt="Hossu"
                />
              </div>

              <div className="hero-bottom">
                <p>
                  INDEPENDENT CLOTHING
                  <br />
                  / DIGITAL ARCHIVE
                </p>

                <a
                  href="#archive"
                  className="enter"
                >
                  ENTER ARCHIVE <span>↓</span>
                </a>

                <p className="coordinates">
                  51°30' N
                  <br />
                  0°07' W
                </p>
              </div>
            </section>

            <section
              className="archive"
              id="archive"
            >
              <div
                className={`archive-header reveal ${
                  archiveVisible ? 'is-visible' : ''
                }`}
                ref={archiveRef}
              >
                <div>
                  <span className="label">
                    ARCHIVE / 001
                  </span>

                  <h2>SELECTED PIECES</h2>
                </div>

                <span>01 OBJECT</span>
              </div>

              <div
                className={`product-grid reveal reveal-delay ${
                  gridVisible ? 'is-visible' : ''
                }`}
                ref={gridRef}
              >
                <button
                  type="button"
                  className="product product-card"
                  onClick={openProduct}
                >
                  <div className="product-image">
                    <img
                      src={product.colours[0].image}
                      alt={product.name}
                    />

                    <span className="product-index">
                      {product.id}
                    </span>

                    <span className="view">
                      VIEW →
                    </span>
                  </div>

                  <div className="product-info">
                    <div>
                      <span>{product.id}</span>

                      <h3>{product.name}</h3>

                      <p className="product-type">
                        {product.type}
                      </p>
                    </div>

                    <span>
                      FROM £24.99
                    </span>
                  </div>
                </button>
              </div>
            </section>

            <section
              className={`contact reveal ${
                contactVisible ? 'is-visible' : ''
              }`}
              id="contact"
              ref={contactRef}
            >
              <div className="contact-label">
                CONTACT / 002
              </div>

              <h2>
                SAY
                <br />
                <span>HELLO.</span>
              </h2>

              <a
                href="mailto:hossuclothing@gmail.com"
                className="email"
              >
                hossuclothing@gmail.com
              </a>
            </section>
          </>
        )}

        {view === 'product' && (
          <section className="product-page">
            <button
              type="button"
              className="back-button"
              onClick={() => openView('home')}
            >
              ← BACK TO ARCHIVE
            </button>

            <div className="product-page-grid">
              <div className="product-page-image">
                <img
                  src={selectedColour.image}
                  alt={`${product.name} - ${selectedColour.name}`}
                />

                <span className="product-page-index">
                  {product.id}
                </span>
              </div>

              <div className="product-page-info">
                <div className="product-page-heading">
                  <span className="label">
                    {product.id}
                  </span>

                  <h1>{product.name}</h1>

                  <p className="product-page-type">
                    {product.type}
                  </p>

                  <p className="product-page-price">
                    £
                    {getPrice(
                      selectedSize,
                    ).toFixed(2)}
                  </p>
                </div>

                <p className="description">
                  {product.description}
                </p>

                <div className="option-group">
                  <div className="option-heading">
                    <span>COLOUR</span>

                    <span>
                      {selectedColour.name}
                    </span>
                  </div>

                  <div className="colour-options">
                    {product.colours.map(
                      (colour) => (
                        <button
                          key={colour.key}
                          type="button"
                          className={`colour-button ${
                            selectedColour.key ===
                            colour.key
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() => {
                            setSelectedColour(
                              colour,
                            )
                            setMessage('')
                          }}
                        >
                          <span
                            className={`colour-swatch ${colour.key}`}
                          />

                          <span>
                            {colour.name}
                          </span>
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div className="option-group">
                  <div className="option-heading">
                    <span>SIZE</span>

                    <span>
                      {selectedSize ||
                        'SELECT'}
                    </span>
                  </div>

                  <div className="size-options">
                    {product.sizes.map(
                      (size) => (
                        <button
                          key={size}
                          type="button"
                          className={`size-button ${
                            selectedSize ===
                            size
                              ? 'selected'
                              : ''
                          }`}
                          onClick={() => {
                            setSelectedSize(
                              size,
                            )
                            setMessage('')
                          }}
                        >
                          {size}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="add-button"
                  onClick={addToBag}
                >
                  <span>
                    {message || 'ADD TO BAG'}
                  </span>

                  <span>→</span>
                </button>

                {addedToBag &&
                  bagCount > 0 && (
                    <div className="after-add">
                      <div className="after-add-message">
                        <span>✓</span>
                        ITEM IN BAG
                      </div>

                      <button
                        type="button"
                        className="proceed-button"
                        onClick={() =>
                          openView('bag')
                        }
                      >
                        <span>
                          VIEW BAG / PROCEED
                          TO CHECKOUT
                        </span>

                        <span>→</span>
                      </button>
                    </div>
                  )}
              </div>
            </div>
          </section>
        )}

        {view === 'bag' && (
          <section className="bag-page">
            <div className="bag-page-header">
              <div>
                <p className="label">
                  YOUR SELECTION
                </p>

                <h1>BAG</h1>
              </div>

              <span className="bag-number">
                {bagCount
                  .toString()
                  .padStart(2, '0')}{' '}
                ITEMS
              </span>
            </div>

            {bag.length === 0 ? (
              <div className="empty-bag">
                <p>
                  YOUR BAG IS CURRENTLY EMPTY.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    openView('home')
                  }
                >
                  RETURN TO ARCHIVE →
                </button>
              </div>
            ) : (
              <div className="bag-layout">
                <div className="bag-items">
                  {bag.map((item, index) => (
                    <div
                      className="bag-item"
                      key={`${item.productId}-${item.colour.key}-${item.size}`}
                      style={{
                        animationDelay: `${index * 0.06}s`,
                      }}
                    >
                      <div className="bag-item-image">
                        <img
                          src={item.colour.image}
                          alt={item.name}
                        />
                      </div>

                      <div className="bag-item-info">
                        <div>
                          <span className="label">
                            {item.productId}
                          </span>

                          <h2>{item.name}</h2>

                          <p>
                            {item.colour.name} /{' '}
                            {item.size}
                          </p>
                        </div>

                        <div className="quantity">
                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(
                                index,
                                -1,
                              )
                            }
                          >
                            −
                          </button>

                          <span>
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(
                                index,
                                1,
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="bag-item-price">
                        £
                        {(
                          item.price *
                          item.quantity
                        ).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>

                <aside className="checkout">
                  <span className="label">
                    ORDER SUMMARY
                  </span>

                  <div className="checkout-line">
                    <span>SUBTOTAL</span>

                    <span>
                      £{subtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="checkout-line muted">
                    <span>SHIPPING</span>

                    <span>
                      CALCULATED AT CHECKOUT
                    </span>
                  </div>

                  <div className="checkout-total">
                    <span>TOTAL</span>

                    <span>
                      £{subtotal.toFixed(2)}
                    </span>
                  </div>

                  {checkoutError && (
                    <p className="checkout-error">
                      {checkoutError}
                    </p>
                  )}

                  <button
                    type="button"
                    className={`checkout-button ${
                      checkoutLoading ? 'is-loading' : ''
                    }`}
                    onClick={checkout}
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading
                      ? 'OPENING CHECKOUT...'
                      : 'CHECKOUT →'}
                  </button>

                  <button
                    type="button"
                    className="continue-shopping"
                    onClick={() =>
                      openView('home')
                    }
                    disabled={checkoutLoading}
                  >
                    CONTINUE SHOPPING
                  </button>
                </aside>
              </div>
            )}
          </section>
        )}

        {view === 'order-success' && (
          <section className="order-page">
            <div className="order-card">
              <span className="order-status-icon success">
                ✓
              </span>

              <span className="label">
                ORDER CONFIRMED
              </span>

              <h1>THANK YOU.</h1>

              <p className="order-copy">
                Your order's in — we'll get it packed
                and shipped shortly. A confirmation
                email is on its way to you.
              </p>

              {orderLoading ? (
                <p className="order-loading">
                  LOADING ORDER DETAILS...
                </p>
              ) : (
                <div className="order-details">
                  {orderId && (
                    <div className="order-detail-line">
                      <span>ORDER ID</span>
                      <span>{orderId}</span>
                    </div>
                  )}

                  {orderDetails?.email && (
                    <div className="order-detail-line">
                      <span>EMAIL</span>
                      <span>{orderDetails.email}</span>
                    </div>
                  )}

                  {orderDetails?.total && (
                    <div className="order-detail-line">
                      <span>TOTAL</span>
                      <span>
                        £
                        {Number(
                          orderDetails.total,
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {!orderId && !orderDetails && (
                    <p className="order-loading">
                      Check your inbox — your receipt
                      has the full order details.
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                className="add-button order-button"
                onClick={() => openView('home')}
              >
                <span>CONTINUE SHOPPING</span>
                <span>→</span>
              </button>
            </div>
          </section>
        )}

        {view === 'order-cancelled' && (
          <section className="order-page">
            <div className="order-card">
              <span className="order-status-icon failed">
                ✕
              </span>

              <span className="label">
                PURCHASE NOT COMPLETED
              </span>

              <h1>CHECKOUT CANCELLED.</h1>

              <p className="order-copy">
                Your payment didn't go through and you
                haven't been charged. Your bag is still
                saved if you'd like to try again.
              </p>

              <div className="order-page-actions">
                <button
                  type="button"
                  className="add-button order-button"
                  onClick={() => openView('bag')}
                >
                  <span>RETRY PURCHASE</span>
                  <span>→</span>
                </button>

                <button
                  type="button"
                  className="continue-shopping order-button-secondary"
                  onClick={() => openView('home')}
                >
                  CLOSE / BACK TO SHOPPING
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>© HOSSU 2026</span>
        <span>ALL RIGHTS RESERVED</span>
        <span>HSS_ARCHIVE_001</span>
      </footer>
    </div>
  )
}

export default App
