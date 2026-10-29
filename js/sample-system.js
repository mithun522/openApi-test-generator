/* Sample 4-service shop for the "Load sample system" button. One string with "---" separators,
   so it also exercises multi-contract paste. Covers every link type the docs mode understands. */
"use strict";

const SAMPLE_SYSTEM = `openapi: 3.0.3
info:
  title: Customer Service
  version: 1.4.0
  description: Owns customer profiles and their saved addresses.
servers:
  - url: https://api.shop.example.com/customers/v1
security:
  - bearerAuth: []
paths:
  /customers:
    post:
      tags: [customers]
      operationId: createCustomer
      summary: Register a customer
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NewCustomer' }
      responses:
        "201":
          description: Customer created
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Customer' }
        "400": { description: Invalid customer data }
        "409": { description: Email already registered }
  /customers/{customerId}:
    parameters:
      - { name: customerId, in: path, required: true, schema: { type: string, format: uuid } }
    get:
      tags: [customers]
      operationId: getCustomer
      summary: Get a customer
      responses:
        "200":
          description: The customer
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Customer' }
        "404": { description: No customer with that ID }
    patch:
      tags: [customers]
      operationId: updateCustomer
      summary: Update a customer
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NewCustomer' }
      responses:
        "200":
          description: Customer updated
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Customer' }
        "400": { description: Invalid customer data }
        "404": { description: No customer with that ID }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
  schemas:
    NewCustomer:
      type: object
      required: [name, email]
      properties:
        name: { type: string, minLength: 1, maxLength: 120, example: Ada Lovelace }
        email: { type: string, format: email }
        address: { $ref: '#/components/schemas/Address' }
    Customer:
      allOf:
        - $ref: '#/components/schemas/NewCustomer'
        - type: object
          required: [customerId]
          properties:
            customerId: { type: string, format: uuid, readOnly: true }
            createdAt: { type: string, format: date-time, readOnly: true }
    Address:
      type: object
      required: [line1, city, country]
      properties:
        line1: { type: string, example: 12 Analytical Row }
        city: { type: string, example: London }
        postcode: { type: string, example: N1 9GU }
        country: { type: string, minLength: 2, maxLength: 2, example: GB, description: ISO 3166-1 alpha-2 code }
---
openapi: 3.0.3
info:
  title: Order Service
  version: 2.1.0
  description: Takes orders, charges them through Payment Service and announces them to the rest of the system.
servers:
  - url: https://api.shop.example.com/orders/v2
security:
  - bearerAuth: []
paths:
  /orders:
    post:
      tags: [orders]
      operationId: placeOrder
      summary: Place an order
      x-calls:
        - Payment Service POST /payments
      x-publishes: [order.created]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NewOrder' }
      responses:
        "201":
          description: Order placed and paid
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Order' }
        "400": { description: Invalid order }
        "402": { description: Payment declined }
    get:
      tags: [orders]
      operationId: listOrders
      summary: List a customer's orders
      parameters:
        - { name: customerId, in: query, required: true, schema: { type: string, format: uuid } }
        - { name: status, in: query, schema: { type: string, enum: [pending, paid, cancelled] } }
      responses:
        "200":
          description: Orders, newest first
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/Order' }
        "400": { description: customerId missing or malformed }
  /orders/{orderId}:
    parameters:
      - { name: orderId, in: path, required: true, schema: { type: string, format: uuid } }
    get:
      tags: [orders]
      operationId: getOrder
      summary: Get an order
      responses:
        "200":
          description: The order
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Order' }
        "404": { description: No order with that ID }
    delete:
      tags: [orders]
      operationId: cancelOrder
      summary: Cancel an order
      x-calls:
        - service: Payment Service
          operation: POST /payments/{paymentId}/refunds
          description: refunds the full amount
      x-publishes: [order.cancelled]
      responses:
        "204": { description: Order cancelled and refunded }
        "404": { description: No order with that ID }
        "409": { description: Order already shipped }
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
  schemas:
    NewOrder:
      type: object
      required: [customerId, items, shippingAddress]
      properties:
        customerId: { type: string, format: uuid }
        items:
          type: array
          minItems: 1
          items: { $ref: '#/components/schemas/OrderItem' }
        shippingAddress: { $ref: '#/components/schemas/Address' }
    OrderItem:
      type: object
      required: [sku, quantity]
      properties:
        sku: { type: string, pattern: '^[A-Z]{3}-[0-9]{4}$', example: BOK-0042 }
        quantity: { type: integer, minimum: 1, maximum: 99 }
        unitPrice: { type: number, minimum: 0, readOnly: true }
    Order:
      allOf:
        - $ref: '#/components/schemas/NewOrder'
        - type: object
          properties:
            orderId: { type: string, format: uuid, readOnly: true }
            status: { type: string, enum: [pending, paid, cancelled], readOnly: true }
            total: { type: number, readOnly: true }
            paymentId: { type: string, format: uuid, readOnly: true }
    Address:
      type: object
      required: [line1, city, country]
      properties:
        line1: { type: string }
        city: { type: string }
        country: { type: string, minLength: 2, maxLength: 2 }
---
openapi: 3.0.3
info:
  title: Payment Service
  version: 1.0.3
  description: Charges cards and issues refunds. Internal only.
servers:
  - url: https://payments.internal.shop.example.com/v1
security:
  - internalKey: []
paths:
  /payments:
    post:
      tags: [payments]
      operationId: createPayment
      summary: Charge a payment
      x-publishes: [payment.captured]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NewPayment' }
      responses:
        "201":
          description: Payment captured
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Payment' }
        "400": { description: Invalid payment request }
        "402": { description: Card declined }
  /payments/{paymentId}:
    get:
      tags: [payments]
      operationId: getPayment
      summary: Get a payment
      parameters:
        - { name: paymentId, in: path, required: true, schema: { type: string, format: uuid } }
      responses:
        "200":
          description: The payment
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Payment' }
        "404": { description: No payment with that ID }
  /payments/{paymentId}/refunds:
    post:
      tags: [payments]
      operationId: refundPayment
      summary: Refund a payment
      x-publishes: [payment.refunded]
      parameters:
        - { name: paymentId, in: path, required: true, schema: { type: string, format: uuid } }
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [amount]
              properties:
                amount: { type: number, minimum: 0.01 }
                reason: { type: string, maxLength: 200 }
      responses:
        "201":
          description: Refund issued
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Refund' }
        "404": { description: No payment with that ID }
        "409": { description: Payment already refunded }
components:
  securitySchemes:
    internalKey: { type: apiKey, in: header, name: X-Internal-Key }
  schemas:
    NewPayment:
      type: object
      required: [orderId, amount, currency, cardToken]
      properties:
        orderId: { type: string, format: uuid }
        amount: { type: number, minimum: 0.01 }
        currency: { type: string, enum: [EUR, GBP, USD] }
        cardToken: { type: string, writeOnly: true }
    Payment:
      type: object
      properties:
        paymentId: { type: string, format: uuid }
        orderId: { type: string, format: uuid }
        amount: { type: number }
        currency: { type: string, enum: [EUR, GBP, USD] }
        status: { type: string, enum: [captured, declined, refunded] }
        capturedAt: { type: string, format: date-time }
    Refund:
      type: object
      properties:
        refundId: { type: string, format: uuid }
        paymentId: { type: string, format: uuid }
        amount: { type: number }
        createdAt: { type: string, format: date-time }
---
swagger: "2.0"
info:
  title: Notification Service
  version: 0.9.0
  description: Emails customers when their orders change.
host: api.shop.example.com
basePath: /notifications/v1
schemes: [https]
x-subscribes: [order.created, order.cancelled, payment.refunded]
securityDefinitions:
  basicAuth: { type: basic }
security:
  - basicAuth: []
paths:
  /notifications:
    get:
      operationId: listNotifications
      summary: List notifications sent to a customer
      parameters:
        - { name: customerId, in: query, required: true, type: string, format: uuid }
      responses:
        "200":
          description: Notifications, newest first
          schema:
            type: array
            items: { $ref: '#/definitions/Notification' }
  /notifications/{notificationId}:
    get:
      operationId: getNotification
      summary: Get a notification
      parameters:
        - { name: notificationId, in: path, required: true, type: string }
      responses:
        "200":
          description: The notification
          schema: { $ref: '#/definitions/Notification' }
        "404": { description: No notification with that ID }
definitions:
  Notification:
    type: object
    properties:
      notificationId: { type: string }
      customerId: { type: string, format: uuid }
      channel: { type: string, enum: [email, sms] }
      template: { type: string, example: order-confirmation }
      sentAt: { type: string, format: date-time }
`;
