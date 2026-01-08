// backend/src/utils/stripeUtils.js

// 1. Install this first: npm install stripe
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
import Stripe from 'stripe'
// Use only the secret key for all Stripe API calls
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const stripePromo = stripe
// Use an environment variable for the key for security: process.env.STRIPE_SECRET_KEY

// --- LOCAL RECOMMENDATIONS MAPPING (replaces Stripe metadata lookup) ---
const LOCAL_RECOMMENDATIONS = {
  Both: {
    primary: {
      1: {
        title: 'Double your output',
        targetTier: 2,
      },
      2: {
        title: 'Get 3 active request',
        targetTier: 3,
      },
    },
    secondary: null, // No secondary for Both
  },
  Video: {
    primary: {
      1: {
        title: 'Double your output',
        targetTier: 2,
      },
      2: {
        title: 'Get 3 active request',
        targetTier: 3,
      },
    },
    secondary: {
      title: 'Add graphic design',
      targetPlan: 'Both',
    },
  },
  Graphic: {
    primary: null, // No tier-based primary for Graphic
    secondary: {
      title: 'Add video editing',
      targetPlan: 'Both',
    },
  },
  AI: {
    primary: {
      1: {
        title: 'Double your output',
        targetTier: 2,
      },
      2: {
        title: 'Get 3 active request',
        targetTier: 3,
      },
    },
    secondary: null, // No secondary for AI
  },
}

// --- AUTHORITATIVE PRICING DATA (Source of Truth) ---
const AUTHORITATIVE_PRICES = {
  Graphic: {
    1: {
      base: { USD: 273, CAD: 373, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
      fast: { USD: 473, CAD: 573, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
    2: {
      base: { USD: 573, CAD: 773, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
      fast: { USD: 673, CAD: 873, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
    3: {
      base: { USD: 737, CAD: 973, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
      fast: { USD: 773, CAD: 1073, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
  },
  Video: {
    1: {
      base: { USD: 473, CAD: 573, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
      fast: { USD: 773, CAD: 1073, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
    2: {
      base: { USD: 673, CAD: 873, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
      fast: { USD: 1173, CAD: 1573, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
    3: {
      base: { USD: 873, CAD: 1173, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
      fast: { USD: 1573, CAD: 2173, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
  },
  Both: {
    1: {
      base: { USD: 637, CAD: 837, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
      fast: { USD: 1037, CAD: 1337, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
    2: {
      base: { USD: 1037, CAD: 1337, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
      fast: { USD: 1537, CAD: 2037, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
    3: {
      base: { USD: 1337, CAD: 1837, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
      fast: { USD: 1937, CAD: 2737, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
  },
  AI: {
    1: {
      base: { USD: 1773, CAD: 2473, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
    2: {
      base: { USD: 2773, CAD: 3773, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
    3: {
      base: { USD: 3773, CAD: 4973, priceId: 'price_1NegZGDNpdNzyHrcwpHRRSPz' },
    },
  },
}

function getExpectedPrice(plan, tier, delivery, currency) {
  const planData = AUTHORITATIVE_PRICES[plan]
  const tierData = planData?.[tier]
  if (!tierData) return null

  // AI plans ignore fast delivery and default to 'base' pricing
  const type = plan === 'AI' || delivery === 'base' ? 'base' : 'fast'

  const priceData = tierData[type]
  return priceData?.[currency.toUpperCase()] || null
}

// Helper function to determine payment method types based on currency
// Only includes payment methods that are commonly available without special activation
function getPaymentMethodTypes(currency) {
  const currencyUpper = currency.toUpperCase()

  // Region-specific payment methods (only commonly available ones)
  const regionMethods = {
    USD: ['card', 'link'], // US: Cards, Link (widely available)
    CAD: ['card', 'link'], // Canada: Cards, Link
    EUR: ['card', 'sepa_debit'], // Europe: Cards, SEPA (most common)
    GBP: ['card'], // UK: Cards
    AUD: ['card'], // Australia: Cards
    SGD: ['card'], // Singapore: Cards
    JPY: ['card'], // Japan: Cards
    INR: ['card'], // India: Cards
    MYR: ['card'], // Malaysia: Cards
    THB: ['card'], // Thailand: Cards
  }

  return regionMethods[currencyUpper] || ['card'] // Default to card only
}
// ----------------------------------------------------

const createStripeSession = async (req, res) => {
  try {
    const { price, currency, plan, tier, delivery } = req.body
    // logging removed in production

    const activeRequest = Number(tier)
    const requestedPrice = Number(price)
    const requestedCurrency = currency?.toUpperCase()

    // Basic request validation
    if (
      !requestedPrice ||
      !requestedCurrency ||
      !plan ||
      !activeRequest ||
      !delivery
    ) {
      return res
        .status(400)
        .json({ error: 'Missing or invalid request parameters.' })
    }

    // *** CRITICAL SECURITY CHECK ***
    const expectedPrice = getExpectedPrice(
      plan,
      activeRequest,
      delivery,
      requestedCurrency
    )

    if (!expectedPrice || requestedPrice !== expectedPrice) {
      // price mismatch (suppressed log)
      return res
        .status(403)
        .json({ error: 'Invalid price calculation. Contact support.' })
    }

    // Price is valid, proceed with Stripe session creation
    const amountInCents = Math.round(requestedPrice * 100)
    const productName = `${plan} - ${activeRequest} Active Request${
      activeRequest > 1 ? 's' : ''
    }${delivery === 'fast' ? ' (Fast)' : ''}`

    const sessionParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: requestedCurrency.toLowerCase(),
            unit_amount: amountInCents,
            product_data: {
              name: productName,
              images: [`${process.env.FRONTEND_URL}/images/Logo_DSQR.png`],
              description: `${plan} subscription with ${activeRequest} active request${
                activeRequest > 1 ? 's' : ''
              }. ${
                delivery === 'fast' ? 'Includes Lightning Fast Delivery.' : ''
              }`,
            },
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${
        process.env.FRONTEND_URL || 'http://localhost:3000'
      }/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${
        process.env.FRONTEND_URL || 'http://localhost:3000'
      }/pricing`,
      metadata: { plan, tier: activeRequest, delivery },
      custom_text: {
        submit: {
          message:
            'We will confirm your subscription and get started right away!',
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      custom_fields: [
        {
          key: 'company_name',
          label: { type: 'custom', custom: 'Company Name' },
          type: 'text',
          optional: true,
        },
      ],
    }

    // Automatic tax disabled - enable only after completing Stripe Tax setup in Dashboard
    // if (process.env.STRIPE_TAX_ENABLED === 'true') {
    //   sessionParams.automatic_tax = {
    //     enabled: true,
    //   }
    // }

    const session = await stripe.checkout.sessions.create(sessionParams)

    res.json({ url: session.url })
  } catch (error) {
    console.error('Stripe Session Error:', error)
    res.status(500).json({ error: 'Failed to create Stripe Checkout Session.' })
  }
}

// --- Payment Element flow: Create a PaymentIntent ---
// Validates price against AUTHORITATIVE_PRICES and returns clientSecret
const createPaymentIntent = async (req, res) => {
  try {
    const { price, currency, plan, tier, delivery, promoCode } = req.body

    const activeRequest = Number(tier)
    const requestedPrice = Number(price)
    const requestedCurrency = currency?.toUpperCase()

    if (!requestedCurrency || !plan || !activeRequest || !delivery) {
      return res
        .status(400)
        .json({ error: 'Missing or invalid request parameters.' })
    }

    const expectedPrice = getExpectedPrice(
      plan,
      activeRequest,
      delivery,
      requestedCurrency
    )

    // Use expectedPrice when client didn't send price; if they did send, ensure it matches
    const finalPrice = requestedPrice || expectedPrice
    if (
      !expectedPrice ||
      (requestedPrice && requestedPrice !== expectedPrice)
    ) {
      // price mismatch (suppressed log)
      return res
        .status(403)
        .json({ error: 'Invalid price calculation. Contact support.' })
    }

    let amountInCents = Math.round(finalPrice * 100)

    // Optionally apply promo code discount server-side
    if (promoCode) {
      try {
        const list = await stripePromo.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
          expand: ['data.coupon'],
        })
        let promo = list.data?.[0]
        if (
          promo &&
          ((typeof promo.coupon === 'string' && promo.coupon) ||
            (!promo.coupon && promo.coupon_id))
        ) {
          try {
            const couponId =
              typeof promo.coupon === 'string' ? promo.coupon : promo.coupon_id
            const coupon = await stripePromo.coupons.retrieve(couponId)
            promo.coupon = coupon
          } catch (e) {
            // promo coupon fetch failed (suppressed)
          }
        }
        // Handle nested coupon structure: promo.promotion.coupon
        if (promo && promo.promotion?.coupon && !promo.coupon) {
          try {
            const coupon = await stripePromo.coupons.retrieve(
              promo.promotion.coupon
            )
            promo.coupon = coupon
            // fetched coupon from promotion.coupon (suppressed)
          } catch (e) {
            // coupon fetch from promotion.coupon failed (suppressed)
          }
        }
        if (promo && !promo.coupon) {
          try {
            const retrievedPI = await stripePromo.promotionCodes.retrieve(
              promo.id,
              { expand: ['coupon'] }
            )
            if (retrievedPI?.coupon) {
              promo = retrievedPI
              // retrieve-expanded coupon obtained (suppressed)
            }
          } catch (e) {
            // retrieve with expand failed (suppressed)
          }
        }
        if (promo && promo.coupon && promo.coupon.valid) {
          const c = promo.coupon
          const min = promo.restrictions?.minimum_amount
          const minCurrency = promo.restrictions?.minimum_amount_currency
          const minOk =
            !min ||
            !minCurrency ||
            minCurrency.toUpperCase() === requestedCurrency
          if (minOk) {
            let discountCents = 0
            if (typeof c.percent_off === 'number') {
              discountCents += Math.round((amountInCents * c.percent_off) / 100)
            }
            if (
              typeof c.amount_off === 'number' &&
              (!c.currency || c.currency.toUpperCase() === requestedCurrency)
            ) {
              discountCents += Math.round(c.amount_off)
            }
            if (discountCents > amountInCents) discountCents = amountInCents
            amountInCents -= discountCents
          } else {
            // minimum amount not met or currency mismatch (suppressed)
          }
        } else {
          // promo not active/valid or coupon missing (suppressed)
        }
      } catch (err) {
        // server apply error (suppressed)
      }
    }
    // (cleaned) stray duplicated coupon discount block removed

    const paymentIntentParams = {
      amount: amountInCents,
      currency: requestedCurrency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      // Note: automatic_tax is not a valid parameter for PaymentIntent
      // Tax is calculated automatically when customer address is provided
      setup_future_usage: 'off_session', // Save payment method for future use
      metadata: {
        plan,
        tier: activeRequest,
        delivery,
        promoCode: promoCode || '',
      },
    }

    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams
    )

    return res.json({ clientSecret: paymentIntent.client_secret })
  } catch (error) {
    console.error('Create PaymentIntent Error:', error)
    return res.status(500).json({ error: 'Failed to create Payment Intent.' })
  }
}

// --- Update Payment Intent with billing address for tax calculation ---
const updatePaymentIntent = async (req, res) => {
  try {
    const { paymentIntentId, billingDetails } = req.body

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Missing paymentIntentId' })
    }

    // Get the current payment intent to get the amount and metadata
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    const amount = paymentIntent.amount
    const currency = paymentIntent.currency
    const plan = paymentIntent.metadata?.plan
    const tier = paymentIntent.metadata?.tier
    const delivery = paymentIntent.metadata?.delivery

    let taxAmount = 0
    let taxStatus = 'not_calculated'

    // Calculate tax using Stripe Tax Calculation API if address is provided
    if (billingDetails?.address?.country) {
      try {
        // Use the same tax code for all products
        const taxCode = 'txcd_20060055'
        const taxCalculation = await stripe.tax.calculations.create({
          currency: currency,
          line_items: [
            {
              amount: amount,
              reference: `${plan}-${tier}-${delivery}`,
              tax_code: taxCode,
            },
          ],
          customer_details: {
            address: {
              line1: billingDetails.address.line1 || undefined,
              line2: billingDetails.address.line2 || undefined,
              city: billingDetails.address.city || undefined,
              state: billingDetails.address.state || undefined,
              postal_code: billingDetails.address.postal_code || undefined,
              country: billingDetails.address.country,
            },
            address_source: 'billing',
          },
        })

        taxAmount = taxCalculation.tax_amount_exclusive || 0
        taxStatus = 'complete'

        console.log('💰 Tax calculated:', {
          subtotal: amount / 100,
          tax: taxAmount / 100,
          total: (amount + taxAmount) / 100,
          currency,
        })
      } catch (taxError) {
        console.error('Tax calculation error:', taxError.message)
        // Continue without tax if calculation fails
      }
    }

    return res.json({
      amount: amount,
      tax: taxAmount,
      taxStatus,
      total: amount + taxAmount,
      currency: currency,
    })
  } catch (error) {
    console.error('Update PaymentIntent Error:', error)
    return res.status(500).json({ error: 'Failed to update payment intent' })
  }
}

// --- Verify PaymentIntent status ---
const verifyPaymentIntent = async (req, res) => {
  try {
    const id = req.query.pi || req.query.payment_intent
    if (!id || typeof id !== 'string' || !id.startsWith('pi_')) {
      return res
        .status(400)
        .json({ error: 'Missing or invalid payment intent id' })
    }
    const pi = await stripe.paymentIntents.retrieve(id)
    return res.json({
      id: pi.id,
      status: pi.status,
      amount: pi.amount,
      currency: pi.currency,
      metadata: pi.metadata || {},
      valid: pi.status === 'succeeded',
    })
  } catch (err) {
    console.error('Verify PaymentIntent Error:', err)
    return res.status(500).json({ error: 'Failed to verify payment intent' })
  }
}

// --- Complete Payment: Create Customer, Subscription, and Save Card ---
const completePayment = async (req, res) => {
  try {
    const { paymentIntentId, email, name, businessDetails, agreedToTerms } =
      req.body

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Missing payment intent ID' })
    }

    // 1. Retrieve the PaymentIntent with expanded payment method to get full billing details
    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {
        expand: ['payment_method'],
      }
    )

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment has not succeeded yet' })
    }

    const paymentMethodId = paymentIntent.payment_method
    const { plan, tier, delivery, promoCode } = paymentIntent.metadata

    // Update PaymentIntent metadata with business details and consent
    const updatedMetadata = {
      ...paymentIntent.metadata,
      agreedToTerms: agreedToTerms ? 'true' : 'false',
      agreedToTermsDate: new Date().toISOString(),
    }

    if (businessDetails?.businessName) {
      updatedMetadata.businessName = businessDetails.businessName
      updatedMetadata.isBusiness = 'true'
    }
    if (businessDetails?.gstNumber) {
      updatedMetadata.gstNumber = businessDetails.gstNumber
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: updatedMetadata,
    })

    console.log(
      '✅ PaymentIntent metadata updated with business details and consent'
    )

    // Extract full billing details from PaymentMethod
    const paymentMethod =
      typeof paymentMethodId === 'object'
        ? paymentMethodId
        : await stripe.paymentMethods.retrieve(paymentMethodId)

    const billingDetails = paymentMethod.billing_details || {}

    // Get customer info from billing details or fallback to request body
    const customerEmail = billingDetails.email || email
    const customerName = billingDetails.name || name
    const customerPhone = billingDetails.phone
    const customerAddress = billingDetails.address

    // Log billing details for debugging
    console.log('📧 Billing Details Captured:', {
      email: customerEmail,
      name: customerName,
      phone: customerPhone,
      address: customerAddress,
      businessDetails: businessDetails || 'N/A',
      agreedToTerms: agreedToTerms || false,
    })

    if (!customerEmail) {
      return res.status(400).json({ error: 'Customer email is required' })
    }

    // 2. Create or retrieve customer with full billing details
    let customer
    const existingCustomers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    })

    // Prepare customer metadata
    const customerMetadata = {
      plan,
      tier,
      delivery,
      agreedToTerms: agreedToTerms ? 'true' : 'false',
      agreedToTermsDate: new Date().toISOString(),
    }

    // Add business details to metadata if provided
    if (businessDetails?.businessName) {
      customerMetadata.businessName = businessDetails.businessName
    }
    if (businessDetails?.gstNumber) {
      customerMetadata.gstNumber = businessDetails.gstNumber
      customerMetadata.isBusiness = 'true'
    }

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0]

      // Update customer with new billing details if provided
      await stripe.customers.update(customer.id, {
        name: customerName || customer.name,
        phone: customerPhone || customer.phone,
        address: customerAddress || customer.address,
        metadata: customerMetadata,
      })
    } else {
      // Create new customer with complete billing details
      customer = await stripe.customers.create({
        email: customerEmail,
        name: customerName || customerEmail.split('@')[0],
        phone: customerPhone,
        address: customerAddress,
        metadata: customerMetadata,
      })
    }

    // Add GST as Tax ID if provided
    if (businessDetails?.gstNumber) {
      try {
        // Check if tax ID already exists
        const existingTaxIds = await stripe.customers.listTaxIds(customer.id)
        const hasGST = existingTaxIds.data.some(
          (taxId) => taxId.value === businessDetails.gstNumber
        )

        if (!hasGST) {
          await stripe.customers.createTaxId(customer.id, {
            type: 'in_gst', // Indian GST
            value: businessDetails.gstNumber,
          })
          console.log('✅ GST Tax ID added to customer')
        }
      } catch (taxIdError) {
        console.error('❌ Tax ID creation error:', taxIdError.message)
        console.error(
          '⚠️  GST format must match: 22AAAAA0000A1Z5 (official Indian GST pattern)'
        )
        console.log(
          '✅ GST is still saved in Customer metadata (visible in Dashboard)'
        )
        // Continue even if tax ID creation fails
      }
    }

    // 3. Retrieve the payment method and attach it to customer if not already attached
    const pmId =
      typeof paymentMethodId === 'string'
        ? paymentMethodId
        : paymentMethodId?.id

    let attachedPaymentMethod = await stripe.paymentMethods.retrieve(pmId)

    // If not attached to this customer, attach it now
    if (attachedPaymentMethod.customer !== customer.id) {
      console.log('📎 Attaching PaymentMethod to customer...')
      attachedPaymentMethod = await stripe.paymentMethods.attach(pmId, {
        customer: customer.id,
      })
      console.log('✅ PaymentMethod attached to customer')
    } else {
      console.log('✅ PaymentMethod already attached to customer')
    }

    // 4. Set as default payment method
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: attachedPaymentMethod.id,
      },
    })

    console.log('✅ Set as default payment method')

    // 5. Find the appropriate price ID for the subscription
    const currency = paymentIntent.currency.toUpperCase()
    const expectedPrice = getExpectedPrice(
      plan,
      Number(tier),
      delivery,
      currency
    )

    if (!expectedPrice) {
      console.error('❌ Invalid plan configuration:', {
        plan,
        tier,
        delivery,
        currency,
      })
      return res.status(400).json({ error: 'Invalid plan configuration' })
    }

    // Get the Stripe price ID from AUTHORITATIVE_PRICES
    const planData = AUTHORITATIVE_PRICES[plan]
    const tierData = planData?.[Number(tier)]
    const type = plan === 'AI' || delivery === 'base' ? 'base' : 'fast'
    const priceData = tierData?.[type]
    const priceId = priceData?.priceId || priceData?.[currency]?.priceId

    console.log('🔍 Looking for Price ID:', {
      plan,
      tier,
      delivery,
      type,
      currency,
      priceId,
    })

    if (!priceId) {
      console.error('❌ Price ID not found:', {
        plan,
        tier,
        delivery,
        type,
        priceData,
      })
      return res.status(400).json({
        error: 'Price ID not found for this plan',
        details: `Plan: ${plan}, Tier: ${tier}, Delivery: ${delivery}, Currency: ${currency}`,
      })
    }

    // 6. Create subscription using the payment method
    const subscriptionMetadata = {
      plan,
      tier,
      delivery,
      promoCode: promoCode || '',
      agreedToTerms: agreedToTerms ? 'true' : 'false',
      agreedToTermsDate: new Date().toISOString(),
    }

    // Add business details to subscription metadata if provided
    if (businessDetails?.businessName) {
      subscriptionMetadata.businessName = businessDetails.businessName
    }
    if (businessDetails?.gstNumber) {
      subscriptionMetadata.gstNumber = businessDetails.gstNumber
      subscriptionMetadata.isBusiness = 'true'
    }

    const subscriptionParams = {
      customer: customer.id,
      items: [{ price: priceId }],
      default_payment_method: attachedPaymentMethod.id,
      metadata: subscriptionMetadata,
      automatic_tax: { enabled: true },
      // expand: ['latest_invoice.payment_intent'], // Disabled: Requires additional permissions
    }

    // Apply promo code if provided
    if (promoCode) {
      try {
        const promoCodes = await stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
        })
        if (promoCodes.data.length > 0) {
          subscriptionParams.promotion_code = promoCodes.data[0].id
        }
      } catch (promoError) {
        console.error('Promo code application error:', promoError)
        // Continue without promo if it fails
      }
    }

    console.log('🔄 Creating subscription with params:', {
      customer: customer.id,
      priceId,
      plan,
      tier,
      delivery,
    })

    const subscription = await stripe.subscriptions.create(subscriptionParams)

    console.log('✅ ============================================')
    console.log('✅ SUBSCRIPTION CREATED SUCCESSFULLY')
    console.log('✅ ============================================')
    console.log('👥 Customer ID:', customer.id)
    console.log('📝 Subscription ID:', subscription.id)
    console.log('✅ Subscription Status:', subscription.status)
    console.log('🧾 Invoice ID:', subscription.latest_invoice?.id)
    console.log('💰 Price ID:', priceId)
    console.log('📦 Plan:', plan)
    console.log('🔢 Tier:', tier)
    console.log('🚀 Delivery:', delivery)
    console.log('✅ ============================================')
    console.log('📧 Email:', customerEmail)
    console.log('👤 Name:', customerName)
    console.log('📱 Phone:', customerPhone || 'Not provided')
    console.log('📍 Address:', JSON.stringify(customerAddress, null, 2))
    if (businessDetails?.businessName) {
      console.log('🏢 Business Name:', businessDetails.businessName)
    }
    if (businessDetails?.gstNumber) {
      console.log('🔢 GST Number:', businessDetails.gstNumber)
      console.log('⚠️  NOTE: GST must be 15 characters for Tax ID creation')
    }
    console.log('✅ Agreed to Terms:', agreedToTerms ? 'Yes' : 'No')
    console.log('💳 Card saved as default payment method')
    console.log('👥 Customer ID:', customer.id)
    console.log('📝 Subscription ID:', subscription.id)
    console.log('🧾 Invoice ID:', subscription.latest_invoice?.id)
    console.log('✅ Status:', subscription.status)
    console.log('✅ ============================================')
    console.log("📋 WHAT'S SAVED IN STRIPE DASHBOARD:")
    console.log('✅ ============================================')
    console.log('👤 Customer Profile (Tab: "Details"):')
    console.log('   - Email:', customerEmail, '✓')
    console.log('   - Name:', customerName, '✓')
    console.log(
      '   - Phone:',
      customerPhone ? customerPhone + ' ✓' : '❌ Not provided'
    )
    console.log(
      '   - Address:',
      customerAddress ? JSON.stringify(customerAddress) + ' ✓' : '❌ Not saved'
    )
    console.log('')
    console.log('📋 Customer Metadata (Tab: "Metadata"):')
    console.log('   - plan:', paymentIntent.metadata.plan, '✓')
    console.log('   - tier:', paymentIntent.metadata.tier, '✓')
    console.log('   - delivery:', paymentIntent.metadata.delivery, '✓')
    if (businessDetails?.businessName) {
      console.log('   - businessName:', businessDetails.businessName, '✓')
    }
    if (businessDetails?.gstNumber) {
      console.log('   - gstNumber:', businessDetails.gstNumber, '✓')
      console.log('   - isBusiness: true ✓')
    }
    console.log('   - agreedToTerms:', agreedToTerms ? 'true ✓' : 'false')
    console.log('   - agreedToTermsDate:', new Date().toISOString(), '✓')
    console.log('')
    console.log('📝 Subscription Metadata (Subscription → Tab: "Metadata"):')
    console.log('   - Same as customer metadata ✓')
    console.log('')
    console.log('💳 Payment Method (Customer → Tab: "Payment methods"):')
    console.log('   - Card ending in ****', '✓')
    console.log('   - Set as default ✓')
    console.log('')
    if (businessDetails?.gstNumber) {
      if (businessDetails.gstNumber.length === 15) {
        console.log('🔢 Tax ID (Customer → Tab: "Tax IDs"):')
        console.log('   - Type: in_gst (Indian GST)')
        console.log('   - Value:', businessDetails.gstNumber)
        console.log('   - Status: Will be created if format is valid')
      } else {
        console.log('❌ Tax ID NOT created:')
        console.log('   - GST must be exactly 15 characters')
        console.log('   - But GST IS saved in Customer metadata ✓')
      }
    }
    console.log('✅ ============================================')
    console.log(`🔍 View in Stripe Dashboard:`)
    console.log(
      `   Customer: https://dashboard.stripe.com/customers/${customer.id}`
    )
    console.log(
      `   Subscription: https://dashboard.stripe.com/subscriptions/${subscription.id}`
    )
    console.log(
      `   Invoice: https://dashboard.stripe.com/invoices/${subscription.latest_invoice?.id}`
    )
    console.log('✅ ============================================')

    return res.json({
      success: true,
      customerId: customer.id,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      invoiceId: subscription.latest_invoice?.id,
      paymentMethodSaved: true,
    })
  } catch (error) {
    console.error('Complete Payment Error:', error)
    return res.status(500).json({
      error: 'Failed to complete payment setup',
      details: error.message,
    })
  }
}

// --- Verify Checkout Session status ---
const verifyCheckoutSession = async (req, res) => {
  try {
    const id = req.query.session_id || req.query.cs
    if (!id || typeof id !== 'string' || !id.startsWith('cs_')) {
      return res.status(400).json({ error: 'Missing or invalid session id' })
    }
    const session = await stripe.checkout.sessions.retrieve(id)
    return res.json({
      id: session.id,
      payment_status: session.payment_status,
      status: session.status,
      amount_total: session.amount_total,
      currency: session.currency,
      metadata: session.metadata || {},
      valid: session.payment_status === 'paid',
    })
  } catch (err) {
    console.error('Verify Checkout Session Error:', err)
    return res.status(500).json({ error: 'Failed to verify checkout session' })
  }
}

export {
  createStripeSession,
  createPaymentIntent,
  updatePaymentIntent,
  verifyPaymentIntent,
  completePayment,
  verifyCheckoutSession,
}

// --- Validate Promotion Code against Stripe ---
// Accepts { code, currency } and returns coupon details if valid/active
const validatePromoCode = async (req, res) => {
  try {
    const { code, currency } = req.body || {}
    if (!code) return res.status(400).json({ error: 'Missing promo code' })

    // promo code received (suppressed)
    // Only using STRIPE_SECRET_KEY now; no restricted/promo key

    const list = await stripePromo.promotionCodes.list({
      code,
      active: true,
      limit: 1,
      expand: ['data.coupon'],
    })

    // promo API response (suppressed)

    if (list.data.length === 0) {
      // no active match (suppressed)
    }

    let promo = list.data?.[0]
    if (promo) {
      // active match details (suppressed)
    }

    // Handle nested coupon structure: promo.promotion.coupon contains the coupon ID
    if (promo && promo.promotion?.coupon && !promo.coupon) {
      const couponId = promo.promotion.coupon
      // fetching coupon from promotion.coupon (suppressed)
      try {
        const coupon = await stripePromo.coupons.retrieve(couponId)
        promo.coupon = coupon
        // fetched coupon details (suppressed)
      } catch (err) {
        console.error('❌ Failed to fetch coupon:', err.message)
      }
    }

    if (!promo || !promo.coupon) {
      // Try again without the `active: true` filter to detect inactive/expired codes
      const listAny = await stripePromo.promotionCodes.list({
        code,
        limit: 5,
        expand: ['data.coupon'],
      })
      if (listAny.data?.length) {
        const found = listAny.data[0]
        // fallback found id (suppressed)

        // Handle nested coupon structure in fallback
        if (found.promotion?.coupon && !found.coupon) {
          const couponId = found.promotion.coupon
          // fallback fetching coupon (suppressed log)
          try {
            const coupon = await stripePromo.coupons.retrieve(couponId)
            found.coupon = coupon
            // fallback fetched coupon (suppressed log)
          } catch (err) {
            console.error('❌ Fallback failed to fetch coupon:', err.message)
          }
        }

        // If promo is active and we have a valid coupon, treat it as valid
        if (found.active && found.coupon && found.coupon.valid) {
          const coupon = found.coupon
          const response = {
            valid: true,
            id: found.id,
            code: found.code,
            percentOff: coupon.percent_off || null,
            amountOff: coupon.amount_off || null,
            amountOffCurrency: coupon.currency || null,
            duration: coupon.duration,
            durationInMonths: coupon.duration_in_months || null,
            maxRedemptions: coupon.max_redemptions || null,
            timesRedeemed: coupon.times_redeemed || null,
            firstTimeTransaction:
              found.restrictions?.first_time_transaction || false,
            minimumAmount: found.restrictions?.minimum_amount || null,
            minimumAmountCurrency:
              found.restrictions?.minimum_amount_currency || null,
          }

          if (
            response.amountOff &&
            response.amountOffCurrency &&
            currency &&
            response.amountOffCurrency.toUpperCase() !== currency.toUpperCase()
          ) {
            response.applicable = false
            response.reason = 'amount_off currency mismatch'
          } else {
            response.applicable = true
          }

          return res.json(response)
        }

        // Otherwise return detailed diagnostic info (suppressed log)
        // diagnostic details: { code: found.code, promoActive: found.active, couponValid: found.coupon?.valid, timesRedeemed: found.coupon?.times_redeemed, maxRedemptions: found.coupon?.max_redemptions, duration: found.coupon?.duration, durationInMonths: found.coupon?.duration_in_months }
        return res.status(400).json({
          valid: false,
          error: 'Promo code exists but is not active or coupon not readable',
          details: {
            code: found.code,
            promoActive: found.active,
            couponValid: found.coupon?.valid ?? null,
            timesRedeemed: found.coupon?.times_redeemed ?? null,
            maxRedemptions: found.coupon?.max_redemptions ?? null,
            duration: found.coupon?.duration ?? null,
            durationInMonths: found.coupon?.duration_in_months ?? null,
          },
        })
      }

      // promo not found (suppressed)
      return res
        .status(404)
        .json({ valid: false, error: 'The code is invalid' })
    }

    const coupon = promo.coupon
    if (!coupon.valid) {
      return res.status(400).json({ valid: false, error: 'Coupon not valid' })
    }

    // Build normalized response
    const response = {
      valid: true,
      id: promo.id,
      code: promo.code,
      percentOff: coupon.percent_off || null,
      amountOff: coupon.amount_off || null, // in cents
      amountOffCurrency: coupon.currency || null,
      duration: coupon.duration,
      durationInMonths: coupon.duration_in_months || null,
      maxRedemptions: coupon.max_redemptions || null,
      timesRedeemed: coupon.times_redeemed || null,
      firstTimeTransaction: promo.restrictions?.first_time_transaction || false,
      minimumAmount: promo.restrictions?.minimum_amount || null,
      minimumAmountCurrency:
        promo.restrictions?.minimum_amount_currency || null,
    }

    // Optional currency gate: if coupon has fixed amount in a currency, ensure it matches current currency
    if (
      response.amountOff &&
      response.amountOffCurrency &&
      currency &&
      response.amountOffCurrency.toUpperCase() !== currency.toUpperCase()
    ) {
      // The fixed discount is in a different currency; mark not applicable
      response.applicable = false
      response.reason = 'amount_off currency mismatch'
    } else {
      response.applicable = true
    }

    return res.json(response)
  } catch (err) {
    console.error('Validate Promo Error:', err)
    return res.status(500).json({ error: 'Failed to validate promo code' })
  }
}

// --- Recommendations from Local Mapping ---
// Returns recommendations based on current plan/tier using LOCAL_RECOMMENDATIONS
const getRecommendations = async (req, res) => {
  try {
    const { plan, tier, currency, delivery } = req.query || {}
    // recommendations input (suppressed)

    if (!plan || !tier || !currency) {
      return res.status(400).json({ error: 'Missing plan, tier, or currency' })
    }

    const currentTier = Number(tier)
    const currentDelivery = delivery || 'base'
    const currentCurrency = currency.toUpperCase()

    const recommendations = []
    const mapping = LOCAL_RECOMMENDATIONS[plan]

    if (!mapping) {
      // no mapping for plan (suppressed)
      return res.json({ items: [] })
    }

    // Primary recommendation (tier upgrade)
    if (mapping.primary && mapping.primary[currentTier]) {
      const rec = mapping.primary[currentTier]
      const targetTier = rec.targetTier
      const targetPrice = getExpectedPrice(
        plan,
        targetTier,
        currentDelivery,
        currentCurrency
      )

      if (targetPrice) {
        const currentPrice = getExpectedPrice(
          plan,
          currentTier,
          currentDelivery,
          currentCurrency
        )
        const additionalPrice = targetPrice - currentPrice

        recommendations.push({
          id: `primary-${plan}-${targetTier}`,
          title: rec.title,
          price: additionalPrice,
          currency: currentCurrency,
          features: [
            currentDelivery === 'fast' ? 'Fast Delivery®' : 'Standard Delivery',
            plan === 'Both' ? 'Video + Graphics' : plan,
          ],
          activeReq: targetTier,
          targetPlan: plan,
          targetTier,
        })
      }
    }

    // Secondary recommendation (plan upgrade)
    if (mapping.secondary) {
      const rec = mapping.secondary
      const targetPlan = rec.targetPlan
      const targetPrice = getExpectedPrice(
        targetPlan,
        currentTier,
        currentDelivery,
        currentCurrency
      )

      if (targetPrice) {
        const currentPrice = getExpectedPrice(
          plan,
          currentTier,
          currentDelivery,
          currentCurrency
        )
        const additionalPrice = targetPrice - currentPrice

        recommendations.push({
          id: `secondary-${targetPlan}-${currentTier}`,
          title: rec.title,
          price: additionalPrice,
          currency: currentCurrency,
          features: [
            currentDelivery === 'fast' ? 'Fast Delivery®' : 'Standard Delivery',
            'Video + Graphics',
          ],
          activeReq: currentTier,
          targetPlan,
          targetTier: currentTier,
        })
      }
    }

    // recommendations returning count (suppressed)
    return res.json({ items: recommendations })
  } catch (err) {
    console.error('[recommendations] error:', err)
    return res.status(500).json({ error: 'Failed to fetch recommendations' })
  }
}

export { validatePromoCode, getRecommendations }
