import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import './App.css'

const product = {
  id: 'H-001',
  name: 'Grumpy Vampire',
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

const catalogProducts = [
  product,
  {
    id: 'H-002',
    name: 'No Pictures Please',
    type: 'T-SHIRT',
    description: 'Please respect the archive.',
    available: true,
    colours: [
      {
        name: 'White',
        key: 'white',
        image: '/images/mockups/no-pics-pls_white-mockup.png',
      },
      {
        name: 'Light Pink',
        key: 'lightpink',
        image: '/images/mockups/no-pics-pls_lightpink-mockup.png',
      },
    ],
    sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],
  },
]

const getPrice = (size) =>
  ['3XL', '4XL', '5XL'].includes(size) ? 26.99 : 24.99


const preventImageInteraction = (event) => {
  if (event.target?.tagName === 'IMG') {
    event.preventDefault()
  }
}

// Triggers once, the first time the element scrolls into view — used to
// bring the archive and contact sections in gently instead of them just
// snapping into place.
function useReveal() {
  // Holding the node in state (instead of a plain ref) means the effect
  // below reruns whenever the element actually mounts — including cases
  // where the section wasn't in the page yet on first load (e.g. when
  // the app opens straight into the order-success/cancelled view) and
  // only appears later once the person navigates back to the archive.
  // A plain useRef would only ever see the node from the very first
  // render, so if it was null then, the observer would never attach.
  const [node, setNode] = useState(null)
  const [visible, setVisible] = useState(false)

  const ref = useCallback((element) => {
    setNode(element)
  }, [])

  useEffect(() => {
    if (!node) {
      return undefined
    }

    if (typeof IntersectionObserver === 'undefined') {
      const timer = setTimeout(() => {
        setVisible(true)
      }, 0)

      return () => clearTimeout(timer)
    }

    if (visible) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(node)
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [node, visible])

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

function ProductPreview({ selectedProduct, selectedColour }) {
  const [visibleColour, setVisibleColour] = useState(selectedProduct.colours[0].key)
  const [failedColour, setFailedColour] = useState('')

  useEffect(() => {
    let cancelled = false
    const preview = new Image()
    preview.src = selectedColour.image

    // Keep the previous colour visible until the next photo is decoded.
    preview.decode()
      .then(() => {
        if (!cancelled) {
          setVisibleColour(selectedColour.key)
          setFailedColour('')
        }
      })
      .catch(() => {
        if (!cancelled) setFailedColour(selectedColour.key)
      })

    return () => { cancelled = true }
  }, [selectedColour.image, selectedColour.key])

  const visibleIndex = selectedProduct.colours.findIndex(
    (colour) => colour.key === visibleColour,
  )

  return (
    <div className="product-page-image">
      {selectedProduct.colours.map((colour) => (
        <img
          key={colour.key}
          src={colour.image}
          alt={colour.key === visibleColour ? `${selectedProduct.name} — ${colour.name}` : ''}
          aria-hidden={colour.key !== visibleColour}
          className={colour.key === visibleColour ? 'is-active' : ''}
          decoding="async"
        />
      ))}
      <span className="product-page-index">{selectedProduct.id}</span>
      <div className="product-image-caption" aria-hidden="true">
        <span>{selectedProduct.colours[visibleIndex].name}</span>
        <span>{String(visibleIndex + 1).padStart(2, '0')} / {String(selectedProduct.colours.length).padStart(2, '0')}</span>
      </div>
      {failedColour === selectedColour.key && (
        <p className="preview-error" role="status">This colour preview couldn't load. Please try again.</p>
      )}
    </div>
  )
}

function App() {
  const [initialCheckout] = useState(getCheckoutParams)

  const [view, setView] = useState(() => {
    if (initialCheckout.status === 'success') return 'order-success'
    if (initialCheckout.status === 'cancelled') return 'order-cancelled'
    return 'home'
  })
  const [selectedColour, setSelectedColour] = useState(
    product.colours[0],
  )
  const [selectedProduct, setSelectedProduct] =
    useState(product)
  const [selectedSize, setSelectedSize] = useState('')
  const [bag, setBag] = useState(() => {
    if (initialCheckout.status === 'success') {
      return []
    }

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
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('top')
  const viewTransition = useRef(null)
  const bagBumpTimer = useRef(null)
  const messageTimer = useRef(null)

  const [orderId, setOrderId] = useState(
    initialCheckout.sessionId,
  )
  const [orderDetails, setOrderDetails] = useState(null)
  const [orderLoading, setOrderLoading] = useState(
    Boolean(initialCheckout.sessionId),
  )
  const [newsletterEmail, setNewsletterEmail] =
    useState('')
  const [newsletterStatus, setNewsletterStatus] =
    useState('idle')
  const [newsletterError, setNewsletterError] =
    useState('')

  const [archiveRef, archiveVisible] = useReveal()
  const [gridRef, gridVisible] = useReveal()
  const [contactRef, contactVisible] = useReveal()

  useEffect(() => {
    let frame
    const updateHeader = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24)
        if (view === 'home') {
          const archive = document.getElementById('archive')
          setActiveSection(
            archive && archive.getBoundingClientRect().top < window.innerHeight * 0.45
              ? 'archive'
              : 'top',
          )
        }
      })
    }

    updateHeader()
    window.addEventListener('scroll', updateHeader, { passive: true })
    window.addEventListener('resize', updateHeader)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateHeader)
      window.removeEventListener('resize', updateHeader)
    }
  }, [view])

  useEffect(() => () => {
    clearTimeout(bagBumpTimer.current)
    clearTimeout(messageTimer.current)
    viewTransition.current?.skipTransition()
  }, [])

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openView = (nextView, targetId = 'top') => {
    const update = () => {
      flushSync(() => {
        setView(nextView)
        setMessage('')
        setCheckoutError('')
        if (nextView === 'home') setActiveSection(targetId)
      })
      const target = document.getElementById(targetId)
      if (targetId === 'archive') {
        target?.scrollIntoView({ behavior: 'instant' })
      } else {
        window.scrollTo({ top: 0, behavior: 'instant' })
      }
      target?.focus({ preventScroll: true })
    }

    viewTransition.current?.skipTransition()
    if (
      nextView !== view &&
      typeof document.startViewTransition === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const transition = document.startViewTransition(update)
      viewTransition.current = transition
      transition.finished.finally(() => {
        if (viewTransition.current === transition) viewTransition.current = null
      }).catch(() => {})
    } else {
      update()
    }
  }

  const joinNewsletter = async (event) => {
    event.preventDefault()
    setNewsletterStatus('submitting')
    setNewsletterError('')

    try {
      const response = await fetch(
        '/api/newsletter-signup',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: newsletterEmail,
          }),
        },
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'Unable to join updates.',
        )
      }

      setNewsletterStatus('success')
    } catch (error) {
      setNewsletterStatus('error')
      setNewsletterError(
        error.message ||
          'Unable to join updates. Please try again.',
      )
    }
  }

  const goToPieces = (event) => {
    if (view === 'home') {
      return
    }

    event.preventDefault()
    openView('home', 'archive')
  }

  const openProduct = (nextProduct = product) => {
    setAddedToBag(false)
    setSelectedSize('')
    setSelectedProduct(nextProduct)
    setSelectedColour(nextProduct.colours[0])
    openView('product')
  }

  const addToBag = () => {
    if (!selectedSize) {
      setMessage('SELECT A SIZE')
      return
    }

    const existingItem = bag.find(
      (item) =>
        item.productId === selectedProduct.id &&
        item.colour.key === selectedColour.key &&
        item.size === selectedSize,
    )

    if (existingItem) {
      setBag(
        bag.map((item) =>
          item.productId === selectedProduct.id &&
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
          productId: selectedProduct.id,
          name: selectedProduct.name,
          price: getPrice(selectedSize),
          colour: selectedColour,
          size: selectedSize,
          quantity: 1,
        },
      ])
    }

    setMessage('ADDED TO BAG')
    setAddedToBag(true)

    clearTimeout(bagBumpTimer.current)
    clearTimeout(messageTimer.current)
    setBagBump(true)
    bagBumpTimer.current = setTimeout(() => {
      setBagBump(false)
    }, 450)

    messageTimer.current = setTimeout(() => {
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
    <div
      className="site"
      onContextMenu={preventImageInteraction}
      onDragStart={preventImageInteraction}
    >
      <a className="skip-link" href="#top">SKIP TO CONTENT</a>
      <header className={`header ${scrolled || view !== 'home' ? 'is-scrolled' : ''}`}>
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

        <nav className="nav" aria-label="Main navigation">
          <button
            type="button"
            onClick={() => openView('home')}
            aria-current={view === 'home' && activeSection === 'top' ? 'page' : undefined}
          >
            Home
          </button>

          <a href="#archive" onClick={goToPieces} aria-current={view === 'home' && activeSection === 'archive' ? 'location' : undefined}>
            Pieces
          </a>
        </nav>

        <button
          className={`bag ${bagBump ? 'bump' : ''}`}
          type="button"
          onClick={() => openView('bag')}
          aria-label={`Bag, ${bagCount} ${bagCount === 1 ? 'item' : 'items'}`}
          aria-current={view === 'bag' ? 'page' : undefined}
        >
          Bag <span className="bag-count" aria-hidden="true">{bagCount}</span>
        </button>
      </header>

      <main id="top" tabIndex={-1}>
        {view === 'home' && (
          <>
            <section className="hero">
              <div className="hero-meta">
                <span><span className="archive-dot" aria-hidden="true" />HSS / 2026</span>
                <span>ARCHIVE_001</span>
              </div>

              <h1 className="hero-title">
                <img
                  src="/images/hossu-logo.png"
                  alt="Hossu"
                  fetchPriority="high"
                  decoding="async"
                />
              </h1>

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
              tabIndex={-1}
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

                <span>{String(catalogProducts.length).padStart(2, '0')} OBJECTS</span>
              </div>

              <div
                className={`product-grid ${gridVisible ? 'is-visible' : ''}`}
                ref={gridRef}
              >
                {catalogProducts.map((catalogProduct, index) => (
                  <button
                    key={catalogProduct.id}
                    style={{ '--reveal-delay': `${index * 110}ms` }}
                    type="button"
                    className={`product product-card ${
                      catalogProduct.available === false
                        ? 'is-unavailable'
                        : ''
                    }`}
                    onClick={
                      catalogProduct.available === false
                        ? undefined
                        : () => openProduct(catalogProduct)
                    }
                    disabled={catalogProduct.available === false}
                  >
                    <div className="product-image">
                      <div className="product-cutout">
                        <img
                          src={catalogProduct.colours[0].image}
                          alt={catalogProduct.name}
                          loading="lazy"
                          decoding="async"
                          width={1200}
                          height={1200}
                        />
                      </div>

                      <span className="product-index">
                        {catalogProduct.id}
                      </span>

                      <span className="view">
                        {catalogProduct.available === false ? 'COMING SOON' : <>VIEW PIECE <span aria-hidden="true">↗</span></>}
                      </span>
                    </div>

                    <div className="product-info">
                      <div>
                        <span>{catalogProduct.id}</span>

                        <h3>{catalogProduct.name}</h3>

                        <p className="product-type">
                          {catalogProduct.type}
                        </p>
                      </div>

                      <span className="product-card-price">
                        {catalogProduct.available === false
                          ? 'NOT YET AVAILABLE'
                          : 'FROM £24.99'}
                      </span>
                    </div>
                    <div className="product-card-bottom">
                      <span className="product-colours" aria-hidden="true">
                        {catalogProduct.colours.map((colour) => (
                          <span key={colour.key} className={`colour-swatch ${colour.key}`} title={colour.name} />
                        ))}
                      </span>
                      <span>{String(catalogProduct.colours.length).padStart(2, '0')} COLOURS</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section
              className={`contact contact-combined reveal ${
                contactVisible ? 'is-visible' : ''
              }`}
              id="contact"
              ref={contactRef}
            >
              <div className="newsletter-content">
                {newsletterStatus === 'success' ? (
                  <div className="newsletter-success" role="status">
                    <span className="label">YOU'RE IN</span>
                    <h2>THANK YOU.</h2>
                    <p>
                      Check your inbox for a confirmation from
                      Hossu.
                    </p>
                  </div>
                ) : (
                  <form
                    className="newsletter-form"
                    onSubmit={joinNewsletter}
                  >
                    <span className="label">STAY IN THE LOOP</span>
                    <h2>JOIN US</h2>
                    <p>Get exclusive offers and news.</p>

                    <div className="newsletter-input-row">
                      <input
                        type="email"
                        value={newsletterEmail}
                        onChange={(event) =>
                          setNewsletterEmail(event.target.value)
                        }
                        placeholder="YOUR EMAIL"
                        aria-label="Email address"
                        autoComplete="email"
                        required
                        disabled={newsletterStatus === 'submitting'}
                      />
                      <button
                        type="submit"
                        disabled={newsletterStatus === 'submitting'}
                      >
                        {newsletterStatus === 'submitting'
                          ? '...'
                          : 'JOIN →'}
                      </button>
                    </div>

                    <small>
                      By joining, you agree to receive Hossu updates.
                    </small>

                    {newsletterStatus === 'error' && (
                      <p className="newsletter-error" role="alert">
                        {newsletterError}
                      </p>
                    )}
                  </form>
                )}
              </div>

              <div className="contact-details">
                <span className="contact-label">CONTACT / 002</span>
                <div className="contact-emails">
                  <a href="mailto:info@hossu.top" className="email">
                    info@hossu.top
                  </a>
                  <a href="mailto:support@hossu.top" className="email">
                    support@hossu.top
                  </a>
                </div>
              </div>
            </section>
          </>
        )}

        {view === 'product' && (
          <section className="product-page">
            <button
              type="button"
              className="back-button"
              onClick={() => openView('home', 'archive')}
            >
              ← BACK TO ARCHIVE
            </button>

            <div className="product-page-grid">
              <ProductPreview
                key={selectedProduct.id}
                selectedProduct={selectedProduct}
                selectedColour={selectedColour}
              />

              <div className="product-page-info">
                <div className="product-page-heading">
                  <span className="label">
                    {selectedProduct.id}
                  </span>

                  <h1>{selectedProduct.name}</h1>

                  <p className="product-page-type">
                    {selectedProduct.type}
                  </p>

                  <p className="product-page-price">
                    £
                    {getPrice(
                      selectedSize,
                    ).toFixed(2)}
                  </p>
                </div>

                <p className="description">
                  {selectedProduct.description}
                </p>

                <div className="option-group">
                  <div className="option-heading">
                    <span>COLOUR</span>

                    <span>
                      {selectedColour.name}
                    </span>
                  </div>

                  <div className="colour-options">
                    {selectedProduct.colours.map(
                      (colour) => (
                        <button
                          key={colour.key}
                          type="button"
                          aria-pressed={selectedColour.key === colour.key}
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
                            setAddedToBag(false)
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

                <div className={`option-group ${message === 'SELECT A SIZE' ? 'has-error' : ''}`}>
                  <div className="option-heading">
                    <span>SIZE</span>

                    <span>
                      {selectedSize ||
                        'SELECT'}
                    </span>
                  </div>

                  <div className="size-options">
                    {selectedProduct.sizes.map(
                      (size) => (
                        <button
                          key={size}
                          type="button"
                          aria-pressed={selectedSize === size}
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
                            setAddedToBag(false)
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

                  <span aria-hidden="true">→</span>
                </button>
                <span className="sr-only" role="status" aria-live="polite">{message}</span>

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
                    openView('home', 'archive')
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
                            aria-label={`Decrease quantity of ${item.name}`}
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
                            aria-label={`Increase quantity of ${item.name}`}
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
                    <p className="checkout-error" role="alert">
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
