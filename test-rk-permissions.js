/**
 * Test if rk_live key has the required permissions
 * Run: node test-rk-permissions.js
 */

import 'dotenv/config'
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function testKeyPermissions() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║        Testing Restricted Key Permissions                 ║')
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  )

  const keyPrefix = process.env.STRIPE_SECRET_KEY?.substring(0, 20) || 'NOT_SET'
  console.log(`Using key: ${keyPrefix}...\n`)

  let hasRequiredPermissions = true

  // Test 1: Can we create a PaymentIntent? (REQUIRED)
  console.log('🔑 Test 1: PaymentIntents - Write Permission')
  console.log('─'.repeat(60))
  try {
    const pi = await stripe.paymentIntents.create({
      amount: 100,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    })
    console.log('✅ SUCCESS - PaymentIntents: Write is ENABLED')
    console.log(`   Created test Payment Intent: ${pi.id}`)
    console.log(`   Client Secret: ${pi.client_secret.substring(0, 30)}...`)

    // Clean up
    await stripe.paymentIntents.cancel(pi.id)
    console.log(`   ✓ Cleaned up test Payment Intent\n`)
  } catch (err) {
    console.log('❌ FAILED - PaymentIntents: Write is MISSING')
    console.log(`   Error: ${err.message}`)
    console.log(`   This permission is REQUIRED for your integration!\n`)
    hasRequiredPermissions = false
  }

  // Test 2: Can we create a Checkout Session? (Optional but used in your code)
  console.log('🛒 Test 2: Checkout Sessions - Write Permission')
  console.log('─'.repeat(60))
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 1000,
            product_data: { name: 'Test Product' },
          },
          quantity: 1,
        },
      ],
      success_url: 'https://example.com/success',
      cancel_url: 'https://example.com/cancel',
    })
    console.log('✅ SUCCESS - Checkout Sessions: Write is ENABLED')
    console.log(`   Created test session: ${session.id}\n`)
  } catch (err) {
    console.log('⚠️  OPTIONAL - Checkout Sessions: Write is MISSING')
    console.log(`   Error: ${err.message}`)
    console.log(`   Only needed if using /create-checkout-session endpoint\n`)
  }

  // Summary
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║                         RESULT                             ║')
  console.log(
    '╚════════════════════════════════════════════════════════════╝\n'
  )

  if (hasRequiredPermissions) {
    console.log('✅ Your rk_live key has the REQUIRED permissions!')
    console.log('   Your integration should work correctly.\n')
  } else {
    console.log('❌ Your rk_live key is MISSING required permissions!\n')
    console.log('📋 SOLUTION:')
    console.log('─'.repeat(60))
    console.log('Ask your client to recreate the restricted key with:')
    console.log('\n1. Go to: https://dashboard.stripe.com/apikeys')
    console.log('2. Click "Create restricted key"')
    console.log('3. Name: "Payment Integration - Server Key"')
    console.log('4. Find "PaymentIntents" → Toggle "Write" to ON')
    console.log('5. (Optional) Find "Checkout Sessions" → Toggle "Write" to ON')
    console.log('6. Leave ALL other permissions OFF')
    console.log('7. Click "Create key"')
    console.log('8. Copy the new rk_live_... key\n')
    console.log('Then update your backend/.env file with the new key.')
    console.log('─'.repeat(60) + '\n')
  }
}

testKeyPermissions().catch((err) => {
  console.error('\n🔴 Critical Error:', err.message)
  process.exit(1)
})
