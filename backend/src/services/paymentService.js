// Payment Service using Strategy Pattern

class BasePaymentStrategy {
  async processPayment(paymentDetails) {
    throw new Error('processPayment method must be implemented');
  }
}

class CashPaymentStrategy extends BasePaymentStrategy {
  async processPayment({ amountDue, amountPaid, transactionReference = null }) {
    if (amountPaid < amountDue) {
      throw new Error(`Số tiền khách đưa (${amountPaid}) không đủ thanh toán tổng tiền (${amountDue}).`);
    }
    const changeAmount = amountPaid - amountDue;
    return {
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      amountDue,
      amountPaid,
      changeAmount,
      transactionReference
    };
  }
}

class TransferPaymentStrategy extends BasePaymentStrategy {
  async processPayment({ amountDue, amountPaid, transactionReference = null }) {
    // Current transfer flow: Admin confirms receipt
    return {
      paymentMethod: 'TRANSFER',
      paymentStatus: 'PAID',
      amountDue,
      amountPaid: amountPaid || amountDue,
      changeAmount: 0,
      transactionReference: transactionReference || `TRANS_${Date.now()}`
    };
  }
}

class MoMoPaymentStrategy extends BasePaymentStrategy {
  async processPayment({ amountDue, amountPaid, transactionReference = null }) {
    // Architecture ready for MoMo API integration
    return {
      paymentMethod: 'MOMO',
      paymentStatus: 'PAID',
      amountDue,
      amountPaid: amountDue,
      changeAmount: 0,
      transactionReference: transactionReference || `MOMO_${Date.now()}`
    };
  }
}

const paymentStrategies = {
  CASH: new CashPaymentStrategy(),
  TRANSFER: new TransferPaymentStrategy(),
  MOMO: new MoMoPaymentStrategy()
};

class PaymentService {
  static getStrategy(method) {
    const normalized = (method || 'CASH').toUpperCase();
    const strategy = paymentStrategies[normalized];
    if (!strategy) {
      throw new Error(`Phương thức thanh toán không được hỗ trợ: ${method}`);
    }
    return strategy;
  }

  static async process(method, details) {
    const strategy = this.getStrategy(method);
    return await strategy.processPayment(details);
  }
}

module.exports = {
  PaymentService,
  CashPaymentStrategy,
  TransferPaymentStrategy,
  MoMoPaymentStrategy
};
