import Stripe from 'stripe'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env from backend directory
dotenv.config({ path: join(__dirname, '../../.env') })

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY not found in .env file')
  process.exit(1)
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function fetchAllPricesAndGenerateCode() {
  try {
    console.log('🔍 Fetching all products and prices from Stripe...\n')

    // Fetch all products with their prices
    const products = await stripe.products.list({
      limit: 100,
      active: true,
      expand: ['data.default_price'],
    })

    // Fetch all prices
    const prices = await stripe.prices.list({
      limit: 100,
      active: true,
      expand: ['data.product'],
    })

    console.log(`✅ Found ${products.data.length} products`)
    console.log(`✅ Found ${prices.data.length} prices\n`)

    // Organize by product name
    const pricesByProduct = {}

    for (const price of prices.data) {
      const product =
        typeof price.product === 'string'
          ? products.data.find((p) => p.id === price.product)
          : price.product

      if (!product) continue

      const productName = product.name
      const priceId = price.id
      const amount = price.unit_amount / 100
      const currency = price.currency.toUpperCase()
      const interval = price.recurring?.interval || 'one_time'

      if (!pricesByProduct[productName]) {
        pricesByProduct[productName] = []
      }

      pricesByProduct[productName].push({
        priceId,
        amount,
        currency,
        interval,
        productId: product.id,
      })
    }

    // Display all products and prices
    console.log('📋 ALL PRODUCTS AND PRICES:\n')
    console.log('='.repeat(80))

    for (const [productName, priceList] of Object.entries(pricesByProduct)) {
      console.log(`\n📦 ${productName}`)
      console.log('   Product ID:', priceList[0].productId)
      console.log('   Prices:')
      for (const price of priceList) {
        console.log(
          `      - ${price.currency} $${price.amount}/${price.interval} → ${price.priceId}`
        )
      }
    }

    console.log('\n' + '='.repeat(80))

    // Generate AUTHORITATIVE_PRICES code
    console.log('\n\n🔧 COPY THIS CODE TO stripeUtils.js:\n')
    console.log('='.repeat(80))
    console.log(generateAuthoritativePrices(pricesByProduct))
    console.log('='.repeat(80))
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

function generateAuthoritativePrices(pricesByProduct) {
  // Initialize structure
  const structure = {
    Graphic: { 1: {}, 2: {}, 3: {} },
    Video: { 1: {}, 2: {}, 3: {} },
    Both: { 1: {}, 2: {}, 3: {} },
    AI: { 1: {}, 2: {}, 3: {} },
  }

  // Parse product names and organize
  // Expected format: "Plan Name - X Active Request(s) - Base/Fast"
  // Example: "Both Plan - 2 Active Requests - Base"

  for (const [productName, priceList] of Object.entries(pricesByProduct)) {
    const nameLower = productName.toLowerCase()

    // Determine plan type
    let plan = null
    if (nameLower.includes('both')) plan = 'Both'
    else if (nameLower.includes('graphic')) plan = 'Graphic'
    else if (nameLower.includes('video')) plan = 'Video'
    else if (nameLower.includes('ai')) plan = 'AI'

    if (!plan) continue

    // Determine tier (1, 2, or 3)
    let tier = null
    if (nameLower.includes('1 active request')) tier = 1
    else if (nameLower.includes('2 active request')) tier = 2
    else if (nameLower.includes('3 active request')) tier = 3

    if (!tier) continue

    // Determine delivery type (base or fast)
    let deliveryType = 'base'
    if (nameLower.includes('fast')) deliveryType = 'fast'

    // Initialize the delivery type object if not exists
    if (!structure[plan][tier][deliveryType]) {
      structure[plan][tier][deliveryType] = {}
    }

    // Add prices for each currency
    for (const price of priceList) {
      structure[plan][tier][deliveryType][price.currency] = Math.round(
        price.amount
      )
      // Store priceId (we'll use the first one found as default)
      if (!structure[plan][tier][deliveryType].priceId) {
        structure[plan][tier][deliveryType].priceId = price.priceId
      }
    }
  }

  // Generate code string
  let code = 'const AUTHORITATIVE_PRICES = {\n'

  for (const [plan, tiers] of Object.entries(structure)) {
    code += `  ${plan}: {\n`
    for (const [tier, deliveryTypes] of Object.entries(tiers)) {
      if (Object.keys(deliveryTypes).length === 0) continue
      code += `    ${tier}: {\n`
      for (const [deliveryType, data] of Object.entries(deliveryTypes)) {
        if (Object.keys(data).length === 0) continue
        code += `      ${deliveryType}: { `
        const entries = []
        for (const [key, value] of Object.entries(data)) {
          if (key === 'priceId') {
            entries.push(`priceId: '${value}'`)
          } else {
            entries.push(`${key}: ${value}`)
          }
        }
        code += entries.join(', ')
        code += ' },\n'
      }
      code += '    },\n'
    }
    code += '  },\n'
  }

  code += '}\n'

  return code
}

// Run the script
fetchAllPricesAndGenerateCode()
