import Stripe from 'stripe'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), '../../.env'),
})

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function fetchProductTaxCodes() {
  const products = await stripe.products.list({ limit: 100 })
  console.log('Product Name | Product ID | Tax Code')
  console.log('-------------------------------------')
  for (const product of products.data) {
    // Get all prices for this product
    const prices = await stripe.prices.list({ product: product.id, limit: 100 })
    for (const price of prices.data) {
      // Tax code is on the price object
      const taxCode = price.tax_code || 'none'
      console.log(`${product.name} | ${product.id} | ${taxCode}`)
    }
  }
}

fetchProductTaxCodes().catch(console.error)
