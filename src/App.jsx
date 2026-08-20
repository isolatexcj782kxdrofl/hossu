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
      {
        threshold: 0.15,
        rootMargin: '0px 0px -60px 0px',
      },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [])

  return [ref, visible]
}

function App() {
  const checkoutParams = new URLSearchParams(
    window.location.search,
  )

  const checkoutStatus = checkoutParams.get('checkout')
  const checkoutSession = checkoutParams.get('session_id')

  const [view, setView] = useState(
    checkoutStatus === 'success'
      ? 'success'
      : checkoutStatus === 'cancelled'
        ? 'cancelled'
        : 'home',
  )

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

      return Array.isArray(parsedBag) ? parsedBag : []
    } catch {
      return []
    }
  })

  const [message, setMessage] = useState('')
  const [addedToBag, setAddedToBag] = useState(false)
  const [checkoutLoading, setCheckoutLoading] =
    useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [bagBump, setBagBump] = useState(false)

  const [archiveRef, archiveVisible] = useReveal()
  const [gridRef, gridVisible] = useReveal()
  const [contactRef, contactVisible] = useReveal()

  useEffect(() => {
    try {
      localStorage.setItem(
        'hossu-bag',
        JSON.stringify(bag),
      )
    } catch {
      console.error('Unable to save Hossu bag.')
    }
  }, [bag])

  /*
   * Once Stripe has redirected the customer back to Hossu
   * after a successful payment, clear the local shopping bag.
   */
  useEffect(() => {
    if (checkoutStatus === 'success') {
      setBag([])
    }
  }, [checkoutStatus])

  const clearCheckoutUrl = () => {
    window.history.replaceState(
      {},
      document.title,
      window.location.pathname,
    )
  }

  const openView = (nextView) => {
    setView(nextView)
    setMessage('')
    setCheckoutError('')

    if (
      nextView !== 'success' &&
      nextView !== 'cancelled'
    ) {
      clearCheckoutUrl()
    }

    window.scrollTo({
      top: 0,
      behavior: 'instant',
    })
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
        ?.scrollIntoView({
          behavior: 'smooth',
        })
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
        error?.message ||
          'Something went wrong. Please try again.',
      )

      setCheckoutLoading(false)
    }
  }

  const retryCheckout = () => {
    clearCheckoutUrl()
    setView('bag')
    setCheckoutError('')
    window.scrollTo({
      top: 0,
      behavior: 'instant',
    })
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
                  archiveVisible
                    ? 'is-visible'
                    : ''
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
                  gridVisible
                    ? 'is-visible'
                    : ''
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
                      src={
                        product.colours[0].image
                      }
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
                contactVisible
                  ? 'is-visible'
                  : ''
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
                      checkoutLoading
                        ? 'is-loading'
                        : ''
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

        {view === 'success' && (
          <section className="checkout-result success-result">
            <div className="checkout-result-inner">
              <span className="checkout-result-mark">
                ✓
              </span>

              <span className="label">
                ORDER / CONFIRMED
              </span>

              <h1>
                THANK
                <br />
                <span>YOU.</span>
              </h1>

              <p className="checkout-result-copy">
                YOUR ORDER HAS BEEN RECEIVED.
                THANK YOU FOR SUPPORTING HOSSU.
                WE'LL TAKE CARE OF THE REST.
              </p>

              {checkoutSession && (
                <div className="order-reference">
                  <span>ORDER REFERENCE</span>
                  <strong>
                    {checkoutSession}
                  </strong>
                </div>
              )}

              <div className="checkout-result-actions">
                <button
                  type="button"
                  className="result-primary-button"
                  onClick={() =>
                    openView('home')
                  }
                >
                  CONTINUE SHOPPING →
                </button>
              </div>
            </div>
          </section>
        )}

        {view === 'cancelled' && (
          <section className="checkout-result cancelled-result">
            <div className="checkout-result-inner">
              <span className="checkout-result-mark">
                ×
              </span>

              <span className="label">
                CHECKOUT / CANCELLED
              </span>

              <h1>
                PAYMENT
                <br />
                <span>FAILED.</span>
              </h1>

              <p className="checkout-result-copy">
                YOUR PAYMENT WAS NOT COMPLETED.
                YOUR ITEMS ARE STILL IN YOUR BAG,
                SO NOTHING HAS BEEN LOST.
              </p>

              <div className="checkout-result-actions">
                <button
                  type="button"
                  className="result-primary-button"
                  onClick={retryCheckout}
                >
                  RETRY PURCHASE →
                </button>

                <button
                  type="button"
                  className="result-secondary-button"
                  onClick={() =>
                    openView('home')
                  }
                >
                  BACK TO SHOPPING
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