import Stripe from 'stripe'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../../.env') })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function checkSubscriptionCreated() {
  console.log('🔍 Checking if subscription was created...\n')

  // Check the latest customer
  const customerEmail = 'sutharpavanuo989153@gmail.com'

  try {
    // Find customer by email
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    })

    if (customers.data.length === 0) {
      console.log('❌ No customer found with email:', customerEmail)
      return
    }

    const customer = customers.data[0]
    console.log('✅ Found Customer:', customer.id)
    console.log('📧 Email:', customer.email)
    console.log('👤 Name:', customer.name)
    console.log('')

    // Check subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 10,
    })

    console.log(`📋 Total Subscriptions: ${subscriptions.data.length}`)
    console.log('')

    if (subscriptions.data.length === 0) {
      console.log('❌ NO SUBSCRIPTIONS FOUND')
      console.log(
        '   The payment went through but subscription was NOT created!'
      )
    } else {
      console.log('✅ SUBSCRIPTIONS FOUND:')
      console.log('='.repeat(80))

      subscriptions.data.forEach((sub, index) => {
        console.log(`\n${index + 1}. Subscription ID: ${sub.id}`)
        console.log(`   Status: ${sub.status}`)
        console.log(
          `   Created: ${new Date(sub.created * 1000).toLocaleString()}`
        )
        console.log(
          `   Current Period: ${new Date(
            sub.current_period_start * 1000
          ).toLocaleDateString()} - ${new Date(
            sub.current_period_end * 1000
          ).toLocaleDateString()}`
        )
        console.log(`   Price ID: ${sub.items.data[0]?.price?.id}`)
        console.log(
          `   Amount: $${(sub.items.data[0]?.price?.unit_amount / 100).toFixed(
            2
          )} ${sub.items.data[0]?.price?.currency.toUpperCase()}`
        )
        console.log(
          `   Interval: ${sub.items.data[0]?.price?.recurring?.interval}`
        )

        if (sub.metadata) {
          console.log(`   Metadata:`, sub.metadata)
        }
      })
      console.log('\n' + '='.repeat(80))
    }

    // Check payment intents
    console.log('\n💳 Recent PaymentIntents:')
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customer.id,
      limit: 5,
    })

    paymentIntents.data.forEach((pi, index) => {
      console.log(`\n${index + 1}. PaymentIntent: ${pi.id}`)
      console.log(`   Status: ${pi.status}`)
      console.log(
        `   Amount: $${(pi.amount / 100).toFixed(
          2
        )} ${pi.currency.toUpperCase()}`
      )
      console.log(`   Created: ${new Date(pi.created * 1000).toLocaleString()}`)
      if (pi.metadata?.plan) {
        console.log(
          `   Plan: ${pi.metadata.plan} - ${pi.metadata.tier} Active Request(s) - ${pi.metadata.delivery}`
        )
      }
    })
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkSubscriptionCreated().catch(console.error)
