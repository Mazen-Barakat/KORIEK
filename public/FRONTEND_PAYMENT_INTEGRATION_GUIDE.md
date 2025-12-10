# ?? Payment System Integration Guide for Frontend Team

## ?? Table of Contents
1. [Overview](#overview)
2. [Payment Flow](#payment-flow)
3. [API Endpoints](#api-endpoints)
4. [Request/Response Models](#requestresponse-models)
5. [Stripe Integration](#stripe-integration)
6. [Implementation Steps](#implementation-steps)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [Security Considerations](#security-considerations)

---

## ?? Overview

The payment system allows car owners to pay for workshop bookings using credit cards via Stripe. The system automatically:
- Calculates a **12% platform commission**
- Tracks workshop payouts
- Handles refunds
- Updates booking status automatically

### Key Features
- ? Secure Stripe payment processing
- ? Automatic commission calculation (12%)
- ? Real-time payment status updates
- ? Webhook support for payment confirmation
- ? Refund support (admin only)

---

## ?? Payment Flow

### User Journey: Car Owner Pays with Credit Card

```
???????????????????????????????????????????????????????????????????
? 1. Car Owner Creates Booking                                     ?
?    ??> POST /api/Booking                                         ?
?        Request Body:                                             ?
?        {                                                         ?
?          "appointmentDate": "2024-01-15T10:00:00",              ?
?          "issueDescription": "Engine check",                     ?
?          "paymentMethod": 1,  // 1 = CreditCard                 ?
?          "carId": 5,                                             ?
?          "workShopProfileId": 12,                                ?
?          "workshopServiceId": 8                                  ?
?        }                                                         ?
???????????????????????????????????????????????????????????????????
                              ?
???????????????????????????????????????????????????????????????????
? 2. Backend Creates Booking                                       ?
?    ??> Booking created with status: Pending                     ?
?    ??> PaymentStatus: Unpaid                                    ?
?    ??> Returns BookingId: 123                                   ?
???????????????????????????????????????????????????????????????????
                              ?
???????????????????????????????????????????????????????????????????
? 3. Frontend Initiates Payment                                    ?
?    ??> POST /api/Payment/create-payment-intent                  ?
?        Request Body:                                             ?
?        {                                                         ?
?          "bookingId": 123,                                       ?
?          "totalAmount": 100.00                                   ?
?        }                                                         ?
???????????????????????????????????????????????????????????????????
                              ?
???????????????????????????????????????????????????????????????????
? 4. Backend Creates Payment Intent                                ?
?    ??> Calculates amounts:                                      ?
?        • Total: $100.00                                          ?
?        • Commission (12%): $12.00                                ?
?        • Workshop Gets: $88.00                                   ?
?    ??> Creates Stripe PaymentIntent                             ?
?    ??> Saves Payment record in database                         ?
?    ??> Returns clientSecret                                     ?
???????????????????????????????????????????????????????????????????
                              ?
???????????????????????????????????????????????????????????????????
? 5. Frontend Shows Stripe Payment Form                            ?
?    ??> Use Stripe Elements with clientSecret                    ?
?    ??> Car owner enters card details                            ?
?    ??> Submit payment to Stripe                                 ?
???????????????????????????????????????????????????????????????????
                              ?
???????????????????????????????????????????????????????????????????
? 6. Stripe Processes Payment                                      ?
?    ??> Charges card                                             ?
?    ??> Sends webhook to backend                                 ?
?    ??> POST /api/Payment/webhook (automatic)                    ?
???????????????????????????????????????????????????????????????????
                              ?
???????????????????????????????????????????????????????????????????
? 7. Backend Updates Status (via Webhook)                          ?
?    ??> Payment status: Succeeded                                ?
?    ??> Booking status: Completed                                ?
?    ??> PaymentStatus: Paid                                      ?
?    ??> PaidAmount: $100.00                                      ?
???????????????????????????????????????????????????????????????????
                              ?
???????????????????????????????????????????????????????????????????
? 8. Frontend Shows Success Message                                ?
?    ??> Display confirmation to car owner                        ?
?    ??> Show receipt/booking details                             ?
???????????????????????????????????????????????????????????????????
```

---

## ?? API Endpoints

### Base URL
```
https://your-api-domain.com/api/Payment
```

### 1. Create Payment Intent
**Endpoint:** `POST /api/Payment/create-payment-intent`  
**Auth Required:** ? Yes (JWT Bearer Token)  
**Role:** Car Owner or Admin

#### Request Body
```json
{
  "bookingId": 123,
  "totalAmount": 100.00
}
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Payment intent created successfully.",
  "data": "pi_3AbCdEfGhIjKlMnO_secret_PqRsTuVwXyZ123456789"
}
```

**Note:** The `data` field contains the Stripe `clientSecret` needed for the payment form.

#### Error Responses
```json
// 400 Bad Request - Booking not found
{
  "success": false,
  "message": "Booking not found.",
  "data": null
}

// 400 Bad Request - Already paid
{
  "success": false,
  "message": "Booking already paid.",
  "data": null
}

// 401 Unauthorized
{
  "type": "https://tools.ietf.org/html/rfc7235#section-3.1",
  "title": "Unauthorized",
  "status": 401
}
```

---

### 2. Get Payment Details for Booking
**Endpoint:** `GET /api/Payment/booking/{bookingId}`  
**Auth Required:** ? Yes  
**Role:** Car Owner, Workshop Owner, or Admin

#### Example Request
```
GET /api/Payment/booking/123
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "id": 45,
    "bookingId": 123,
    "totalAmount": 100.00,
    "commissionAmount": 12.00,
    "workshopAmount": 88.00,
    "commissionRate": 0.12,
    "stripePaymentStatus": "Succeeded",
    "stripePaymentIntentId": "pi_3AbCdEfGhIjKlMnO",
    "isPaidOut": false,
    "payoutDate": null,
    "payoutMethod": null,
    "payoutReference": null,
    "payoutNotes": null,
    "createdAt": "2024-01-15T14:30:00Z",
    "paidAt": "2024-01-15T14:32:15Z"
  }
}
```

---

### 3. Refund Payment (Admin Only)
**Endpoint:** `POST /api/Payment/refund/{bookingId}`  
**Auth Required:** ? Yes  
**Role:** Admin only

#### Example Request
```
POST /api/Payment/refund/123
```

#### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Refund processed successfully.",
  "data": true
}
```

---

### 4. Stripe Webhook (Internal)
**Endpoint:** `POST /api/Payment/webhook`  
**Auth Required:** ? No (Stripe signature verification)

**Note:** This endpoint is called automatically by Stripe. Frontend doesn't need to interact with it.

---

## ?? Request/Response Models

### CreatePaymentDTO
```typescript
interface CreatePaymentDTO {
  bookingId: number;      // Required: ID of the booking to pay for
  totalAmount: number;    // Required: Total amount in USD (e.g., 100.00)
}
```

### PaymentDTO (Response)
```typescript
interface PaymentDTO {
  id: number;
  bookingId: number;
  totalAmount: number;           // Total charged to customer
  commissionAmount: number;      // Platform's 12% commission
  workshopAmount: number;        // Amount workshop will receive
  status: StripePaymentStatus;   // "Pending" | "Succeeded" | "Failed" | "Refunded"
  createdAt: string;             // ISO 8601 date
  paidAt: string | null;         // ISO 8601 date or null
  
  // Payout info (for workshop/admin)
  isPaidOut: boolean;
  payoutDate: string | null;
  payoutMethod: string | null;
  payoutReference: string | null;
}
```

### StripePaymentStatus (Enum)
```typescript
enum StripePaymentStatus {
  Pending = 0,     // Payment created, awaiting payment
  Succeeded = 1,   // Payment successful
  Failed = 2,      // Payment failed
  Refunded = 3     // Payment refunded
}
```

### PaymentMethod (Enum)
```typescript
enum PaymentMethod {
  Cash = 0,
  CreditCard = 1
}
```

---

## ?? Stripe Integration

### Prerequisites
1. Install Stripe.js library
2. Get Stripe publishable key from backend team

### Install Stripe
```bash
# Using npm
npm install @stripe/stripe-js

# Using yarn
yarn add @stripe/stripe-js
```

---

### React/Next.js Implementation

#### 1. Setup Stripe
```typescript
// lib/stripe.ts
import { loadStripe } from '@stripe/stripe-js';

// Get this from your environment variables
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;

export const stripePromise = loadStripe(stripePublishableKey);
```

#### 2. Create Payment Component
```typescript
// components/PaymentForm.tsx
import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from 'axios';

interface PaymentFormProps {
  bookingId: number;
  totalAmount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export const PaymentForm: React.FC<PaymentFormProps> = ({
  bookingId,
  totalAmount,
  onSuccess,
  onError
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      // Step 1: Create payment intent on your backend
      const response = await axios.post(
        '/api/Payment/create-payment-intent',
        {
          bookingId: bookingId,
          totalAmount: totalAmount
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const clientSecret = response.data.data;

      // Step 2: Confirm payment with Stripe
      const cardElement = elements.getElement(CardElement);
      
      const { error, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement!,
          }
        }
      );

      if (error) {
        onError(error.message || 'Payment failed');
        setProcessing(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        onSuccess();
      }

    } catch (error: any) {
      onError(error.response?.data?.message || 'Payment failed');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="payment-details">
        <h3>Payment Summary</h3>
        <p>Total Amount: ${totalAmount.toFixed(2)}</p>
      </div>

      <div className="card-element">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>

      <button 
        type="submit" 
        disabled={!stripe || processing}
        className="pay-button"
      >
        {processing ? 'Processing...' : `Pay $${totalAmount.toFixed(2)}`}
      </button>
    </form>
  );
};
```

#### 3. Wrap Component with Stripe Provider
```typescript
// pages/payment/[bookingId].tsx
import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { PaymentForm } from '@/components/PaymentForm';
import { useRouter } from 'next/router';

export default function PaymentPage() {
  const router = useRouter();
  const { bookingId, amount } = router.query;

  const handleSuccess = () => {
    alert('Payment successful!');
    router.push(`/bookings/${bookingId}`);
  };

  const handleError = (error: string) => {
    alert(`Payment failed: ${error}`);
  };

  return (
    <div className="payment-page">
      <h1>Complete Your Payment</h1>
      
      <Elements stripe={stripePromise}>
        <PaymentForm
          bookingId={Number(bookingId)}
          totalAmount={Number(amount)}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      </Elements>
    </div>
  );
}
```

---

### Vue.js Implementation

#### 1. Install Stripe for Vue
```bash
npm install @stripe/stripe-js
```

#### 2. Create Payment Component
```vue
<!-- components/PaymentForm.vue -->
<template>
  <div class="payment-form">
    <div class="payment-summary">
      <h3>Payment Summary</h3>
      <p>Total Amount: ${{ totalAmount.toFixed(2) }}</p>
    </div>

    <form @submit.prevent="handlePayment">
      <div id="card-element"></div>
      <div v-if="errorMessage" class="error">{{ errorMessage }}</div>
      
      <button 
        type="submit" 
        :disabled="processing"
        class="pay-button"
      >
        {{ processing ? 'Processing...' : `Pay $${totalAmount.toFixed(2)}` }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';

const props = defineProps<{
  bookingId: number;
  totalAmount: number;
}>();

const emit = defineEmits<{
  success: [];
  error: [message: string];
}>();

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
const processing = ref(false);
const errorMessage = ref('');
let cardElement: any = null;

onMounted(async () => {
  const stripe = await stripePromise;
  const elements = stripe!.elements();
  
  cardElement = elements.create('card', {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
  });
  
  cardElement.mount('#card-element');
});

const handlePayment = async () => {
  processing.value = true;
  errorMessage.value = '';

  try {
    const stripe = await stripePromise;

    // Step 1: Create payment intent
    const response = await axios.post(
      '/api/Payment/create-payment-intent',
      {
        bookingId: props.bookingId,
        totalAmount: props.totalAmount
      },
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );

    const clientSecret = response.data.data;

    // Step 2: Confirm payment
    const { error, paymentIntent } = await stripe!.confirmCardPayment(
      clientSecret,
      {
        payment_method: {
          card: cardElement,
        }
      }
    );

    if (error) {
      errorMessage.value = error.message || 'Payment failed';
      emit('error', errorMessage.value);
    } else if (paymentIntent.status === 'succeeded') {
      emit('success');
    }

  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || 'Payment failed';
    emit('error', errorMessage.value);
  } finally {
    processing.value = false;
  }
};
</script>

<style scoped>
#card-element {
  border: 1px solid #ccc;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.error {
  color: #e74c3c;
  margin-bottom: 16px;
}

.pay-button {
  width: 100%;
  padding: 12px;
  background-color: #5469d4;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
}

.pay-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

---

### Angular Implementation

#### 1. Install Stripe
```bash
npm install @stripe/stripe-js
```

#### 2. Create Payment Service
```typescript
// services/payment.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { loadStripe, Stripe, StripeElements } from '@stripe/stripe-js';
import { environment } from '../environments/environment';

interface CreatePaymentResponse {
  success: boolean;
  message: string;
  data: string; // clientSecret
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;

  constructor(private http: HttpClient) {
    this.initStripe();
  }

  private async initStripe() {
    this.stripe = await loadStripe(environment.stripePublishableKey);
  }

  createPaymentIntent(bookingId: number, totalAmount: number): Observable<CreatePaymentResponse> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    return this.http.post<CreatePaymentResponse>(
      `${environment.apiUrl}/api/Payment/create-payment-intent`,
      { bookingId, totalAmount },
      { headers }
    );
  }

  async confirmPayment(clientSecret: string, cardElement: any): Promise<any> {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }

    return await this.stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement
      }
    });
  }

  getElements() {
    if (!this.stripe) {
      throw new Error('Stripe not initialized');
    }
    return this.stripe.elements();
  }
}
```

#### 3. Create Payment Component
```typescript
// components/payment-form/payment-form.component.ts
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-payment-form',
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.css']
})
export class PaymentFormComponent implements OnInit {
  @Input() bookingId!: number;
  @Input() totalAmount!: number;
  @Output() success = new EventEmitter<void>();
  @Output() error = new EventEmitter<string>();

  processing = false;
  errorMessage = '';
  cardElement: any;

  constructor(private paymentService: PaymentService) {}

  async ngOnInit() {
    const elements = this.paymentService.getElements();
    
    this.cardElement = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#424770',
          '::placeholder': {
            color: '#aab7c4',
          },
        },
        invalid: {
          color: '#9e2146',
        },
      },
    });

    this.cardElement.mount('#card-element');
  }

  async handleSubmit() {
    this.processing = true;
    this.errorMessage = '';

    try {
      // Step 1: Create payment intent
      this.paymentService.createPaymentIntent(this.bookingId, this.totalAmount)
        .subscribe(async (response) => {
          if (!response.success) {
            this.errorMessage = response.message;
            this.error.emit(this.errorMessage);
            this.processing = false;
            return;
          }

          const clientSecret = response.data;

          // Step 2: Confirm payment
          const result = await this.paymentService.confirmPayment(
            clientSecret,
            this.cardElement
          );

          if (result.error) {
            this.errorMessage = result.error.message;
            this.error.emit(this.errorMessage);
          } else if (result.paymentIntent.status === 'succeeded') {
            this.success.emit();
          }

          this.processing = false;
        });

    } catch (err: any) {
      this.errorMessage = err.message || 'Payment failed';
      this.error.emit(this.errorMessage);
      this.processing = false;
    }
  }
}
```

```html
<!-- components/payment-form/payment-form.component.html -->
<div class="payment-form">
  <div class="payment-summary">
    <h3>Payment Summary</h3>
    <p>Total Amount: ${{ totalAmount.toFixed(2) }}</p>
  </div>

  <form (ngSubmit)="handleSubmit()">
    <div id="card-element"></div>
    <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>
    
    <button 
      type="submit" 
      [disabled]="processing"
      class="pay-button"
    >
      {{ processing ? 'Processing...' : 'Pay $' + totalAmount.toFixed(2) }}
    </button>
  </form>
</div>
```

---

## ??? Implementation Steps

### Step 1: User Creates Booking
When car owner selects "Credit Card" as payment method:

```typescript
const createBooking = async () => {
  const bookingData = {
    appointmentDate: "2024-01-15T10:00:00",
    issueDescription: "Engine check",
    paymentMethod: 1, // 1 = CreditCard
    carId: 5,
    workShopProfileId: 12,
    workshopServiceId: 8
  };

  const response = await axios.post('/api/Booking', bookingData, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const bookingId = response.data.data.id;
  
  // Redirect to payment page
  window.location.href = `/payment?bookingId=${bookingId}&amount=100.00`;
};
```

---

### Step 2: Display Payment Form
Show Stripe payment form with the booking details:

```typescript
// On payment page
const paymentPageData = {
  bookingId: 123,
  totalAmount: 100.00,
  workshopName: "ABC Auto Repair",
  serviceName: "Engine Diagnostic"
};

// Display payment form component
<PaymentForm {...paymentPageData} />
```

---

### Step 3: Handle Payment Success
After successful payment, redirect user to confirmation page:

```typescript
const handlePaymentSuccess = async () => {
  // Show success message
  toast.success('Payment successful!');
  
  // Optionally verify payment status
  const paymentDetails = await axios.get(
    `/api/Payment/booking/${bookingId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (paymentDetails.data.data.stripePaymentStatus === 'Succeeded') {
    // Redirect to booking details
    router.push(`/bookings/${bookingId}`);
  }
};
```

---

### Step 4: Display Payment Status
Show payment information on booking details page:

```typescript
interface BookingWithPayment {
  id: number;
  status: string;
  paymentStatus: string; // "Unpaid" | "Paid"
  paymentMethod: string; // "Cash" | "CreditCard"
  paidAmount: number | null;
  payment?: {
    totalAmount: number;
    commissionAmount: number;
    workshopAmount: number;
    stripePaymentStatus: string;
    paidAt: string;
  };
}

const BookingDetails = ({ booking }: { booking: BookingWithPayment }) => {
  return (
    <div>
      <h2>Booking #{booking.id}</h2>
      <div className="payment-info">
        <p>Status: {booking.status}</p>
        <p>Payment Status: {booking.paymentStatus}</p>
        
        {booking.payment && (
          <>
            <p>Amount Paid: ${booking.payment.totalAmount.toFixed(2)}</p>
            <p>Payment Date: {new Date(booking.payment.paidAt).toLocaleDateString()}</p>
            <p>Payment Method: Credit Card</p>
          </>
        )}
      </div>
    </div>
  );
};
```

---

## ?? Error Handling

### Common Errors and Solutions

#### 1. Booking Not Found (400)
```typescript
{
  "success": false,
  "message": "Booking not found.",
  "data": null
}
```
**Solution:** Verify the booking ID exists and belongs to the current user.

---

#### 2. Booking Already Paid (400)
```typescript
{
  "success": false,
  "message": "Booking already paid.",
  "data": null
}
```
**Solution:** Check payment status before showing payment form. Redirect to booking details if already paid.

---

#### 3. Card Declined
```typescript
{
  error: {
    message: "Your card was declined.",
    type: "card_error"
  }
}
```
**Solution:** Display clear message to user. Allow them to try a different card.

---

#### 4. Insufficient Funds
```typescript
{
  error: {
    message: "Your card has insufficient funds.",
    type: "card_error"
  }
}
```
**Solution:** Display clear message. Suggest alternative payment methods.

---

#### 5. Authentication Required (401)
```typescript
{
  "type": "https://tools.ietf.org/html/rfc7235#section-3.1",
  "title": "Unauthorized",
  "status": 401
}
```
**Solution:** Redirect to login page. Store intended payment URL to redirect back after login.

---

### Error Handling Example
```typescript
const handlePayment = async () => {
  try {
    // Create payment intent
    const response = await createPaymentIntent(bookingId, amount);
    
    // Confirm with Stripe
    const result = await stripe.confirmCardPayment(response.data, {
      payment_method: { card: cardElement }
    });

    if (result.error) {
      // Handle Stripe errors
      switch (result.error.code) {
        case 'card_declined':
          showError('Your card was declined. Please try another card.');
          break;
        case 'insufficient_funds':
          showError('Insufficient funds. Please use another payment method.');
          break;
        case 'expired_card':
          showError('Your card has expired. Please use a valid card.');
          break;
        default:
          showError(result.error.message || 'Payment failed. Please try again.');
      }
    } else {
      handleSuccess();
    }

  } catch (error: any) {
    // Handle API errors
    if (error.response?.status === 401) {
      redirectToLogin();
    } else if (error.response?.status === 400) {
      showError(error.response.data.message || 'Invalid payment request');
    } else {
      showError('An unexpected error occurred. Please try again.');
    }
  }
};
```

---

## ?? Testing

### Test Cards (Stripe Test Mode)

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 9995 | Declined (insufficient funds) |
| 4000 0000 0000 0002 | Declined (generic decline) |
| 4000 0025 0000 3155 | Requires authentication (3D Secure) |

**Use these test details:**
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

---

### Test Scenarios

#### ? Scenario 1: Successful Payment
1. Create booking with payment method = CreditCard
2. Navigate to payment page
3. Enter card: 4242 4242 4242 4242
4. Submit payment
5. Verify success message
6. Check booking status = Completed
7. Check payment status = Paid

---

#### ? Scenario 2: Declined Card
1. Create booking
2. Navigate to payment page
3. Enter card: 4000 0000 0000 9995
4. Submit payment
5. Verify error message displays
6. Booking remains Pending
7. Payment status remains Unpaid

---

#### ? Scenario 3: Already Paid
1. Create booking
2. Pay successfully
3. Try to access payment page again
4. Should show "Already paid" message or redirect

---

#### ? Scenario 4: Network Error
1. Create booking
2. Disable internet temporarily
3. Try to submit payment
4. Verify error handling
5. Verify payment form remains fillable after error

---

### Testing Checklist

```
Payment Flow
[ ] Can create booking with Credit Card payment method
[ ] Can access payment page with valid booking ID
[ ] Card form renders correctly
[ ] Can enter card details
[ ] Submit button disables during processing
[ ] Success message displays after payment
[ ] Redirects to booking details after success
[ ] Booking status updates to Completed
[ ] Payment status updates to Paid

Error Handling
[ ] Shows error for invalid card
[ ] Shows error for declined card
[ ] Shows error for expired card
[ ] Shows error for insufficient funds
[ ] Shows error for network issues
[ ] Shows error for unauthorized access
[ ] Shows error for already paid booking

UI/UX
[ ] Loading indicator shows during payment
[ ] Form fields are disabled during processing
[ ] Error messages are clear and helpful
[ ] Success confirmation is visible
[ ] Can retry after failed payment
[ ] Card input validates properly
[ ] Mobile responsive design

Security
[ ] JWT token included in requests
[ ] Card details never sent to your backend
[ ] HTTPS used for all requests
[ ] No sensitive data in console logs
[ ] No sensitive data in error messages
```

---

## ?? Security Considerations

### ? DO's

1. **Always use HTTPS**
   ```typescript
   // Ensure API base URL uses HTTPS
   const API_BASE_URL = 'https://api.yourdomain.com';
   ```

2. **Include JWT Token**
   ```typescript
   const headers = {
     'Authorization': `Bearer ${localStorage.getItem('token')}`,
     'Content-Type': 'application/json'
   };
   ```

3. **Never log sensitive data**
   ```typescript
   // ? DON'T
   console.log('Card details:', cardElement);
   
   // ? DO
   console.log('Payment initiated for booking:', bookingId);
   ```

4. **Validate amounts on frontend**
   ```typescript
   if (amount <= 0) {
     throw new Error('Invalid amount');
   }
   ```

5. **Use environment variables**
   ```typescript
   // .env.local
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   ```

---

### ? DON'Ts

1. **Never send card details to your backend**
   - Stripe handles all card data
   - Only send the Stripe token/PaymentIntent

2. **Never store card details**
   - Let Stripe handle card storage
   - Never cache or log card information

3. **Never hardcode API keys**
   ```typescript
   // ? DON'T
   const stripe = loadStripe('pk_test_hardcoded_key');
   
   // ? DO
   const stripe = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
   ```

4. **Never skip authentication**
   - Always include JWT token
   - Verify token is valid before payment

5. **Never expose client secret**
   - Only use it for the payment form
   - Don't log or store in local storage

---

## ?? Payment Status Flow Diagram

```
BOOKING STATUSES:
???????????    ?????????????    ??????????????    ??????????????
? Pending ????>? Confirmed ????>? InProgress ????>? Completed  ?
???????????    ?????????????    ??????????????    ??????????????
                                                           ?
PAYMENT STATUSES:                                          ?
??????????    ??????????????????????????????????????????? ?
? Unpaid ????>? Paid (triggers automatic completion)    ???
??????????    ???????????????????????????????????????????

PAYMENT INTENTS (Stripe):
???????????    ?????????????    ????????????
? Pending ????>? Succeeded ????>? Refunded ?
???????????    ?????????????    ????????????
     ?                ?
     ??????????????????????????> ? Failed ?
                                 ??????????
```

---

## ?? Amount Calculation

The backend automatically calculates commission. Here's the breakdown:

```
User Input:        $100.00

Calculations:
?? Total Amount:       $100.00  (charged to customer)
?? Commission (12%):   $ 12.00  (platform fee)
?? Workshop Amount:    $ 88.00  (workshop receives)

Database Storage:
{
  "totalAmount": 100.00,
  "commissionAmount": 12.00,
  "workshopAmount": 88.00,
  "commissionRate": 0.12
}
```

**Frontend doesn't need to calculate these values** - just pass the total amount.

---

## ?? Mobile Considerations

### React Native

Use `@stripe/stripe-react-native` instead of `@stripe/stripe-js`:

```bash
npm install @stripe/stripe-react-native
```

```typescript
import { CardField, useStripe } from '@stripe/stripe-react-native';

const PaymentScreen = () => {
  const { confirmPayment } = useStripe();

  const handlePayment = async () => {
    const response = await createPaymentIntent(bookingId, amount);
    
    const { error, paymentIntent } = await confirmPayment(
      response.data,
      {
        paymentMethodType: 'Card',
      }
    );

    if (error) {
      Alert.alert('Payment failed', error.message);
    } else if (paymentIntent) {
      Alert.alert('Success', 'Payment successful!');
    }
  };

  return (
    <View>
      <CardField
        postalCodeEnabled={false}
        onCardChange={(cardDetails) => {
          console.log('Card changed', cardDetails);
        }}
      />
      <Button title="Pay" onPress={handlePayment} />
    </View>
  );
};
```

---

## ?? UI/UX Best Practices

### Payment Form Design

1. **Show payment summary clearly**
   ```
   ???????????????????????????????????????
   ? Payment Summary                      ?
   ???????????????????????????????????????
   ? Workshop: ABC Auto Repair            ?
   ? Service: Engine Diagnostic           ?
   ? Date: January 15, 2024               ?
   ?                                      ?
   ? Amount: $100.00                      ?
   ? Platform Fee: $12.00                 ?
   ? ?????????????????????????????       ?
   ? Total: $100.00                       ?
   ???????????????????????????????????????
   ```

2. **Loading states**
   ```typescript
   {processing ? (
     <button disabled>
       <Spinner /> Processing...
     </button>
   ) : (
     <button>Pay Now</button>
   )}
   ```

3. **Error display**
   ```typescript
   {error && (
     <div className="error-banner">
       <Icon name="error" />
       <span>{error}</span>
       <button onClick={clearError}>×</button>
     </div>
   )}
   ```

4. **Success confirmation**
   ```typescript
   {success && (
     <div className="success-modal">
       <Icon name="checkmark" color="green" size={48} />
       <h2>Payment Successful!</h2>
       <p>Your booking is confirmed</p>
       <p>Booking ID: #{bookingId}</p>
       <button onClick={goToBooking}>View Booking</button>
     </div>
   )}
   ```

---

## ?? Related Endpoints

You may also need these endpoints for complete booking flow:

### Get Booking Details
```
GET /api/Booking/{id}
```

### Update Booking Status
```
PUT /api/Booking/{id}/status
```

### Get User's Bookings
```
GET /api/Booking/user
```

---

## ?? Support

### Backend Team Contact
- API Issues: backend-team@company.com
- Stripe Configuration: devops@company.com

### Stripe Documentation
- Stripe.js: https://stripe.com/docs/js
- Testing: https://stripe.com/docs/testing
- Payment Intents: https://stripe.com/docs/payments/payment-intents

### Questions?
Create an issue in the team's Slack channel: `#payment-integration`

---

## ?? Summary Checklist

Before starting implementation:
- [ ] Get Stripe publishable key from backend team
- [ ] Install Stripe library
- [ ] Set up environment variables
- [ ] Review API endpoints
- [ ] Understand payment flow
- [ ] Plan error handling

During implementation:
- [ ] Create payment form component
- [ ] Integrate Stripe Elements
- [ ] Handle create payment intent
- [ ] Handle confirm payment
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success handling

After implementation:
- [ ] Test with test cards
- [ ] Test error scenarios
- [ ] Test mobile responsiveness
- [ ] Verify booking status updates
- [ ] Verify payment status updates
- [ ] Document any issues
- [ ] Deploy to staging

---

## ?? Quick Start Code Snippet

Here's a minimal working example to get started quickly:

```typescript
import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { CardElement, Elements, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_YOUR_KEY');

function PaymentForm({ bookingId, amount, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Create intent
      const res = await fetch('/api/Payment/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ bookingId, totalAmount: amount })
      });
      
      const { data: clientSecret } = await res.json();

      // 2. Confirm payment
      const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: elements.getElement(CardElement) }
      });

      if (stripeError) {
        setError(stripeError.message);
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CardElement />
      {error && <div className="error">{error}</div>}
      <button disabled={!stripe || loading}>
        {loading ? 'Processing...' : `Pay $${amount}`}
      </button>
    </form>
  );
}

function App() {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm 
        bookingId={123} 
        amount={100} 
        onSuccess={() => alert('Payment successful!')}
      />
    </Elements>
  );
}

export default App;
```

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Maintained By:** Backend Team  

**Need help?** Contact the backend team or create an issue in the project repository.

Good luck with the integration! ??
