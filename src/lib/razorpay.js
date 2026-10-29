import { billingApi } from '@/lib/api/billing'

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'
let loading = null

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHECKOUT_SRC
    script.onload = resolve
    script.onerror = () => { loading = null; reject(new Error('Couldn’t load the payment window. Check your connection and try again.')) }
    document.body.appendChild(script)
  })
  return loading
}

/**
 * Pay a subscription invoice with Razorpay Checkout (UPI, cards, net
 * banking). Resolves once the API has verified the payment; rejects with
 * `cancelled: true` if the person closes the window.
 */
export async function payInvoice(invoice) {
  const { data } = await billingApi.checkout(invoice.id)
  const order = data.data
  await loadCheckout()

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      prefill: order.prefill,
      theme: { color: '#2563eb' },
      handler: async (result) => {
        try {
          const res = await billingApi.verifyPayment(result)
          resolve(res.data)
        } catch (err) {
          reject(err)
        }
      },
      modal: { ondismiss: () => reject(Object.assign(new Error('Payment cancelled.'), { cancelled: true })) },
    })
    // Checkout stays open so the person can retry; just keep a record of the failure.
    checkout.on('payment.failed', (res) => {
      billingApi.paymentFailed({
        razorpay_order_id: order.order_id,
        razorpay_payment_id: res.error?.metadata?.payment_id,
        error: res.error?.description,
      }).catch(() => {})
    })
    checkout.open()
  })
}
