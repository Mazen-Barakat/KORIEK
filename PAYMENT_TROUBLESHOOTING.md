# Payment Processing Troubleshooting Guide

## Issue: Payment Stuck on "Processing Payment" Screen

### What Was Fixed

1. **Enhanced error logging** - Added detailed console logs at every step of the payment process
2. **Better error handling** - Improved error messages and status checking
3. **Payment status monitoring** - Added `checkPaymentStatus()` to verify payment if it's stuck processing
4. **Explicit handle actions** - Added `handleActions: true` to properly handle 3D Secure challenges

### How to Debug

#### Step 1: Open Browser Developer Tools

1. Press `F12` to open DevTools
2. Click on the **Console** tab
3. Attempt to make a payment

#### Step 2: Watch for These Log Messages

**Good Flow (Payment Should Succeed):**

```
💳 Starting payment process for booking: 123
📤 Creating payment intent...
✅ Payment intent created: pi_1234567890
🔐 Confirming payment with Stripe...
📊 Payment intent status: succeeded
✅ Payment succeeded!
```

**Problem Areas to Watch:**

### Common Issues & Solutions

#### Issue 1: "Failed to create payment intent on backend"

```
❌ HTTP Error creating payment intent: {
  status: 401,
  statusText: "Unauthorized",
  message: "..."
}
```

**Solution:**

- Check if token is expired: `localStorage.getItem('token')`
- Try logging out and back in
- Verify user has permission to make payments

#### Issue 2: "Payment stuck at 'Creating payment intent'"

```
📤 Creating payment intent...
(nothing after this for 10+ seconds)
```

**Solution:**

- Backend endpoint might be down
- Check backend is running: `https://localhost:44316/api/Payment/create-payment-intent`
- Check network tab in DevTools for failed requests
- Look for CORS errors in console

#### Issue 3: "Payment stuck at 'Confirming payment with Stripe'"

```
🔐 Confirming payment with Stripe...
(nothing after this for 10+ seconds)
```

**Solution:**

- Stripe.js might not be loaded properly
- Check if `pk_test_` key is valid
- Try invalid card first: `4000 0000 0000 0002` (should fail immediately)
- Check network tab for Stripe API calls

#### Issue 4: Stripe Error

```
❌ Payment error from Stripe: {
  message: "Your card was declined",
  code: "card_declined"
}
```

**Solution - Test Cards:**

- ✅ Success: `4242 4242 4242 4242`
- ❌ Decline: `4000 0000 0000 0002`
- 🔐 3D Secure: `4000 0025 0000 3155`
- Use any future expiry date and any 3-digit CVC

### Backend Requirements

Your backend endpoint `https://localhost:44316/api/Payment/create-payment-intent` MUST:

1. **Accept POST request:**

```json
{
  "bookingId": 123,
  "totalAmount": 500.0
}
```

2. **Return success response:**

```json
{
  "success": true,
  "data": "pi_1234567890abcdef",
  "message": "Payment intent created successfully"
}
```

3. **Return error response:**

```json
{
  "success": false,
  "data": null,
  "message": "Booking not found or already paid"
}
```

### Testing Checklist

- [ ] Browser console shows "Starting payment process"
- [ ] Backend creates payment intent successfully
- [ ] Stripe receives the payment confirm request
- [ ] Test card is valid (use `4242 4242 4242 4242`)
- [ ] Payment modal shows "success" step with checkmark

### Quick Test Commands

**In browser console, check if Stripe is loaded:**

```javascript
window.Stripe; // Should show Stripe function
console.log(window.Stripe);
```

**Check if payment service is available:**

```javascript
// Navigate to payment modal and check console for messages
```

### If Payment Still Doesn't Work

1. **Screenshot the console errors** and share them
2. **Check backend logs** for the payment intent creation endpoint
3. **Verify CORS settings** allow requests from frontend URL
4. **Test with Stripe's test card**: `4242 4242 4242 4242`, exp: 12/25, CVC: 123

### Recent Changes Made

- ✅ Added comprehensive logging throughout payment flow
- ✅ Added `handleActions: true` for 3D Secure support
- ✅ Added payment status checking if stuck at "processing"
- ✅ Improved error messages with HTTP status details
- ✅ Added `checkPaymentStatus()` method for status verification

All changes maintain backward compatibility with your existing backend.
