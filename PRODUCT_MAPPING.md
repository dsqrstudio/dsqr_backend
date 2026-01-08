# Product Mapping Guide

## Current Stripe Products (6 products):

1. **Premium Growth Plan** - $24.37 USD, $17.73 CAD - `price_1NegZqDNpdNzyHrcov3tu4wX`
2. **Standard Growth Plan** - $14.37 USD - `price_1NegZGDNpdNzyHrcwpHRRSPz`
3. **Trial Growth Plan** - $1.97 one-time - `price_1NegljDNpdNzyHrcb8fVmVFg`
4. **Premium Package** - $17.37 USD - `price_1NegIBDNpdNzyHrcQfpFRlR1`
5. **Standard Package** - $9.37 USD - `price_1NdxK7DNpdNzyHrcGeBUt0jJ`
6. **Trial Package** - $1.37 one-time - `price_1NdvvDDNpdNzyHrcZACAiskk`

## Code Expected Structure (21 products):

- **Graphic Plan**: 1, 2, 3 Active Requests × (Base, Fast Delivery) = 6 products
- **Video Plan**: 1, 2, 3 Active Requests × (Base, Fast Delivery) = 6 products
- **Both Plan**: 1, 2, 3 Active Requests × (Base, Fast Delivery) = 6 products
- **AI Plan**: 1, 2, 3 Active Requests × Base only = 3 products

## Questions for Your Client:

1. **Which product types do they actually offer?**

   - Do they have separate Graphic, Video, Both, and AI plans?
   - Or do they only have a few combined plans?

2. **What do the product names mean?**

   - Premium Growth Plan = Which plan type? (Graphic/Video/Both/AI)
   - Premium Growth Plan = How many active requests? (1/2/3)
   - Premium Growth Plan = Base or Fast delivery?

   Same questions for:

   - Standard Growth Plan
   - Premium Package
   - Standard Package

3. **Are the Trial products for the initial $1-2 trial period?**
   - Trial Growth Plan ($1.97)
   - Trial Package ($1.37)

## Recommended Approach:

**Option A - Map Existing Products** (if they only offer 6 product combinations):
Update code to use only the 6 products they have, instead of expecting 21.

**Option B - Create Missing Products** (if they need all 21):
Create the remaining 15 products in Stripe Dashboard with correct naming.

**Option C - Rename Existing Products** (easiest for automation):
Rename products in Stripe to match the expected pattern:

- "Graphic Plan - 2 Active Requests - Base"
- "Video Plan - 1 Active Request - Fast"
- etc.

Then the fetchStripePrices.js script will automatically generate the correct code.
