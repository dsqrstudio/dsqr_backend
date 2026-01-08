// backend/src/routes/checkout.js
import express from 'express'
const router = express.Router()
import {
  createStripeSession,
  createPaymentIntent,
  validatePromoCode,
  getRecommendations,
  updatePaymentIntent,
  verifyPaymentIntent,
  completePayment,
  verifyCheckoutSession,
} from '../utils/stripeUtils.js'

// Defines the public endpoint: /api/checkout/create-checkout-session
router.post('/create-checkout-session', createStripeSession)
// Payment Element flow
router.post('/create-payment-intent', createPaymentIntent)
// Validate promo code (reads from Stripe using restricted or secret key)
router.post('/validate-promo', validatePromoCode)
// Recommendations from Stripe
router.get('/recommendations', getRecommendations)
// Update payment intent for tax calculation
router.post('/update-payment-intent', updatePaymentIntent)

// Verify endpoints
router.get('/verify-payment-intent', verifyPaymentIntent)
router.get('/verify-checkout-session', verifyCheckoutSession)

// Complete payment: create customer, subscription, save card
router.post('/complete-payment', completePayment)

export default router
