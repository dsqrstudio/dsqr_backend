import Stripe from 'stripe'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../../.env') })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function testAutomaticTax() {
  console.log('🧪 Testing Automatic Tax with Restricted Key...\n')
  console.log('Key type:', process.env.STRIPE_SECRET_KEY.substring(0, 7))
  console.log('')

  try {
    // Test 1: Create PaymentIntent with automatic_tax
    console.log('1️⃣ Testing PaymentIntent with automatic_tax...')
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // $10.00
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      automatic_tax: { enabled: true },
    })
    console.log('   ✅ PaymentIntent created:', paymentIntent.id)
    console.log(
      '   Tax status:',
      paymentIntent.automatic_tax?.status || 'not_set'
    )
    console.log('')

    // Test 2: Create Subscription with automatic_tax
    console.log('2️⃣ Testing Subscription with automatic_tax...')

    // Get a price
    const prices = await stripe.prices.list({ limit: 1, active: true })
    if (prices.data.length === 0) {
      console.log('   ⚠️ No active prices found, skipping subscription test')
      return
    }
    const priceId = prices.data[0].id

    // Create test customer
    const customer = await stripe.customers.create({
      email: 'test-tax@example.com',
      name: 'Tax Test User',
    })
    console.log('   ✅ Customer created:', customer.id)

    try {
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        automatic_tax: { enabled: true },
      })
      console.log('   ✅ Subscription created:', subscription.id)
      console.log(
        '   Tax status:',
        subscription.automatic_tax?.status || 'not_set'
      )

      // Cleanup
      await stripe.subscriptions.cancel(subscription.id)
      console.log('   🗑️ Subscription cancelled')
    } catch (subError) {
      console.log('   ❌ Subscription creation failed:', subError.message)
      if (subError.type === 'StripePermissionError') {
        console.log(
          '   ⚠️ Permission Error - Restricted key does not have access'
        )
      }
    }

    // Cleanup customer
    await stripe.customers.del(customer.id)
    console.log('   🗑️ Customer deleted')
    console.log('')

    console.log('='.repeat(80))
    console.log('✅ Test completed!')
    console.log('='.repeat(80))
  } catch (error) {
    console.log('❌ Test failed:', error.message)
    if (error.type === 'StripePermissionError') {
      console.log(
        '⚠️ Permission Error - The restricted key does not have required permissions'
      )
      console.log('Required permissions:', error.raw?.message)
    }
  }
}

testAutomaticTax().catch(console.error)
