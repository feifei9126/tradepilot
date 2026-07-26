import type { OrderPaymentStatus, PaymentAttemptStatus, PaymentRequestStatus, RefundStatus } from "./types";

export function reducePaymentStatus(current: PaymentRequestStatus, next: PaymentRequestStatus): PaymentRequestStatus {
  if (current === next) return current;
  if (current === "paid" && next === "pending") return current;
  if (current === "cancelled" || current === "expired") return current;
  if (current === "paid" && next === "failed") return current;
  return next;
}

export function reduceAttemptStatus(current: PaymentAttemptStatus, next: PaymentAttemptStatus): PaymentAttemptStatus {
  if (current === "paid" && next !== "paid") return current;
  if (current === "cancelled" || current === "expired") return current;
  return next;
}

export function reduceRefundStatus(current: RefundStatus, next: RefundStatus): RefundStatus {
  if (current === "succeeded" && next !== "succeeded") return current;
  if (current === "cancelled") return current;
  return next;
}

export function aggregateOrderPaymentStatus(totalMinor: number, paidMinor: number, refundedMinor: number): OrderPaymentStatus {
  if (refundedMinor >= paidMinor && paidMinor > 0) return "refunded";
  if (refundedMinor > 0) return "partially_refunded";
  if (paidMinor <= 0) return "unpaid";
  if (paidMinor >= totalMinor) return "paid";
  return "partial";
}
