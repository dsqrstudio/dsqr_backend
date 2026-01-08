import Stripe from 'stripe'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../../.env') })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function testPermissions() {
  console.log('🔐 Testing Stripe Key Permissions...\n')
  console.log('Key type:', process.env.STRIPE_SECRET_KEY.substring(0, 7))
  console.log('')

  const tests = [
    {
      name: '📖 Read Products',
      fn: async () => {
        const products = await stripe.products.list({ limit: 1 })
        return `✅ SUCCESS - Found ${products.data.length} product(s)`
      },
    },
    {
      name: '📖 Read Prices',
      fn: async () => {
        const prices = await stripe.prices.list({ limit: 1 })
        return `✅ SUCCESS - Found ${prices.data.length} price(s)`
      },
    },
    {
      name: '📖 Read Customers',
      fn: async () => {
        const customers = await stripe.customers.list({ limit: 1 })
        return `✅ SUCCESS - Found ${customers.data.length} customer(s)`
      },
    },
    {
      name: '✏️ Create Customer',
      fn: async () => {
        const customer = await stripe.customers.create({
          email: 'test-permissions@example.com',
          name: 'Test User',
          metadata: { test: 'permission_test' },
        })
        // Clean up
        await stripe.customers.del(customer.id)
        return `✅ SUCCESS - Created and deleted customer ${customer.id}`
      },
    },
    {
      name: '✏️ Create Subscription',
      fn: async () => {
        // First, get a valid price ID
        const prices = await stripe.prices.list({ limit: 1, active: true })
        if (prices.data.length === 0) {
          return '⚠️ SKIPPED - No active prices found to test with'
        }

        const priceId = prices.data[0].id

        // Create a test customer
        const customer = await stripe.customers.create({
          email: 'test-sub@example.com',
          metadata: { test: 'subscription_test' },
        })

        try {
          // Try to create subscription
          const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: priceId }],
            metadata: { test: 'permission_test' },
          })

          // Clean up
          await stripe.subscriptions.cancel(subscription.id)
          await stripe.customers.del(customer.id)

          return `✅ SUCCESS - Created and cancelled subscription ${subscription.id}`
        } catch (error) {
          // Clean up customer
          await stripe.customers.del(customer.id)
          throw error
        }
      },
    },
  ]

  for (const test of tests) {
    try {
      console.log(`${test.name}...`)
      const result = await test.fn()
      console.log(`   ${result}`)
    } catch (error) {
      console.log(`   ❌ FAILED - ${error.message}`)
      if (error.type === 'StripePermissionError') {
        console.log('   ⚠️ This key does not have permission for this action')
      }
    }
    console.log('')
  }

  console.log('='.repeat(80))
  console.log('✅ Permission test completed!')
  console.log('='.repeat(80))
}

testPermissions().catch(console.error)
