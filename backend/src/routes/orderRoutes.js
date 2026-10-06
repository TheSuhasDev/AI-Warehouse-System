import express from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { DEFAULT_ADVANCE_PERCENTAGE } from "../config/orderSettings.js";

const router = express.Router();
const statuses = ["PROCESSING", "ADVANCE_RECEIVED", "PACKED", "DISPATCHED", "CANCELLED"];
const isId = (value) => mongoose.isValidObjectId(value);
const positiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;
const positiveAmount = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

const orderError = (res, status, message) => res.status(status).json({ success: false, message });

const getOrder = async (id, res) => {
  if (!isId(id)) {
    orderError(res, 400, "Invalid order id");
    return null;
  }
  const order = await Order.findById(id).populate("items.product", "name sku");
  if (!order) orderError(res, 404, "Order not found");
  return order;
};

router.post("/", async (req, res) => {
  try {
    const { client = {}, items } = req.body;
    if (!client.name?.trim() || !client.phone?.trim() || !client.address?.trim() || !Array.isArray(items) || !items.length) {
      return orderError(res, 400, "Client name, phone, address, and at least one item are required");
    }

    const quantities = new Map();
    for (const item of items) {
      const productKey = item.productId || item.product || item.sku;
      if ((!isId(productKey) && typeof productKey !== "string") || !positiveInteger(item.quantity)) {
        return orderError(res, 400, "Each item must contain a valid product id or SKU and positive integer quantity");
      }
      const key = isId(productKey) ? `id:${productKey}` : `sku:${productKey.trim()}`;
      quantities.set(key, (quantities.get(key) || 0) + Number(item.quantity));
    }

    const ids = [...quantities.keys()].filter((key) => key.startsWith("id:")).map((key) => key.slice(3));
    const skus = [...quantities.keys()].filter((key) => key.startsWith("sku:")).map((key) => key.slice(4));
    const products = await Product.find({ $or: [{ _id: { $in: ids } }, { sku: { $in: skus } }] });
    const productMap = new Map(products.flatMap((product) => [[`id:${product.id}`, product], [`sku:${product.sku}`, product]]));
    const missing = [...quantities.keys()].find((key) => !productMap.has(key));
    if (missing) return orderError(res, 400, `Product ${missing.replace(/^(id:|sku:)/, "")} not found`);

    const orderItems = [...quantities.entries()].map(([productId, quantity]) => {
      const product = productMap.get(productId);
      if (quantity > product.stock) throw new Error(`${product.name} has only ${product.stock} units available`);
      return { product: product._id, name: product.name, sku: product.sku, quantity, unitPrice: product.sellingPrice };
    });
    const totalAmount = orderItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
    const order = await Order.create({
      orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`,
      client: { ...client, name: client.name.trim(), phone: client.phone.trim(), address: client.address.trim() },
      items: orderItems,
      totalAmount,
      advancePercentage: DEFAULT_ADVANCE_PERCENTAGE,
      advanceRequired: Math.round(totalAmount * DEFAULT_ADVANCE_PERCENTAGE) / 100,
    });
    return res.status(201).json({ success: true, order });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || "Failed to create order" });
  }
});

router.get("/", async (req, res) => {
  try {
    const filter = req.query.status && statuses.includes(req.query.status) ? { status: req.query.status } : {};
    const orders = await Order.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, orders });
  } catch (error) {
    return res.status(500).json({ message: "Unable to load orders", error: error.message });
  }
});

router.get("/payments/history", async (req, res) => {
  try {
    const payments = await Payment.find().populate("order", "orderNumber client").sort({ createdAt: -1 });
    return res.json(payments);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load payment history", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const order = await getOrder(req.params.id, res);
    if (order) {
      const payments = await Payment.find({ order: order._id }).sort({ createdAt: -1 });
      return res.json({ ...order.toObject(), payments });
    }
  } catch (error) {
    return res.status(500).json({ message: "Unable to load order", error: error.message });
  }
});

router.get("/:id/payments", async (req, res) => {
  try {
    const order = await getOrder(req.params.id, res);
    if (!order) return;
    return res.json(await Payment.find({ order: order._id }).sort({ createdAt: -1 }));
  } catch (error) {
    return res.status(500).json({ message: "Unable to load payments", error: error.message });
  }
});

router.post("/:id/payments", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { amount, method, paymentType, notes } = req.body;
    const normalizedReference = typeof req.body.reference === "string" ? req.body.reference.trim() : "";
    if (!positiveAmount(amount)) return orderError(res, 400, "Payment amount must be greater than 0");
    if (!["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"].includes(method)) return orderError(res, 400, "Invalid payment method");
    if (!["ADVANCE", "FULL", "PARTIAL"].includes(paymentType)) return orderError(res, 400, "Invalid payment type");
    if (!isId(req.params.id)) return orderError(res, 400, "Invalid order id");

    let payment;
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw new Error("Order not found");
      if (["DISPATCHED", "CANCELLED"].includes(order.status)) throw new Error("Payments cannot be recorded for this order");
      const paymentAmount = Number(amount);
      if (order.totalPaid + paymentAmount > order.totalAmount) throw new Error("Payment exceeds the order balance");
      const paymentData = { order: order._id, amount: paymentAmount, method, paymentType, notes };
      if (normalizedReference) paymentData.reference = normalizedReference;
      [payment] = await Payment.create([paymentData], { session });
      order.totalPaid += paymentAmount;
      order.advanceAmount = Math.min(order.advanceRequired, order.totalPaid);
      if (order.status === "PROCESSING" && order.totalPaid >= order.advanceRequired) order.status = "ADVANCE_RECEIVED";
      await order.save({ session });
    });
    return res.status(201).json(payment);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.reference) {
      return orderError(res, 409, "Payment reference already exists");
    }
    return orderError(res, error.message === "Order not found" ? 404 : 400, error.message);
  } finally {
    await session.endSession();
  }
});

const transition = (from, to, action, validation) => async (req, res) => {
  try {
    const order = await getOrder(req.params.id, res);
    if (!order) return;
    if (order.status !== from) return orderError(res, 409, `Order must be ${from} to ${action}`);
    if (validation) {
      const validationMessage = validation(order);
      if (validationMessage) return orderError(res, 400, validationMessage);
    }
    order.status = to;
    await order.save();
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: `Failed to ${action}`, error: error.message });
  }
};

router.patch("/:id/pack", transition("ADVANCE_RECEIVED", "PACKED", "pack order", (order) => (
  order.totalPaid < order.advanceRequired ? `Advance of ${order.advanceRequired} is required before packing` : ""
)));
router.patch("/:id/confirm-payment", transition("PROCESSING", "ADVANCE_RECEIVED", "confirm advance", (order) => (
  order.totalPaid < order.advanceRequired ? `Advance of ${order.advanceRequired} is required` : ""
)));
router.patch("/:id/start-packing", transition("ADVANCE_RECEIVED", "PACKED", "pack order"));
router.patch("/:id/complete-packing", transition("ADVANCE_RECEIVED", "PACKED", "pack order"));
router.patch("/:id/ready", transition("PACKED", "PACKED", "keep order packed"));
router.patch("/:id/ready-for-dispatch", transition("PACKED", "PACKED", "keep order packed"));
router.patch("/:id/cancel", async (req, res) => {
  try {
    const order = await getOrder(req.params.id, res);
    if (!order) return;
    if (["DISPATCHED", "CANCELLED"].includes(order.status)) return orderError(res, 409, "Order cannot be cancelled");
    order.status = "CANCELLED";
    order.cancelledAt = new Date();
    await order.save();
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: "Failed to cancel order", error: error.message });
  }
});

router.patch("/:id/dispatch", async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let dispatchedOrder;
    await session.withTransaction(async () => {
      const order = await Order.findById(req.params.id).session(session);
      if (!order) throw new Error("Order not found");
      if (order.status !== "PACKED") throw new Error("Order must be PACKED to dispatch");
      if (order.paymentStatus !== "FULLY_PAID") throw new Error("Order must be FULLY_PAID to dispatch");
      const quantities = new Map();
      order.items.forEach((item) => quantities.set(item.product.toString(), (quantities.get(item.product.toString()) || 0) + item.quantity));
      for (const [productId, quantity] of quantities) {
        const result = await Product.updateOne({ _id: productId, stock: { $gte: quantity } }, { $inc: { stock: -quantity } }, { session });
        if (result.modifiedCount !== 1) throw new Error("Insufficient stock for dispatch");
        await StockMovement.create([{ product: productId, type: "DISPATCH", quantity }], { session });
      }
      order.status = "DISPATCHED";
      order.dispatchedAt = new Date();
      dispatchedOrder = await order.save({ session });
    });

    return res.json(dispatchedOrder);
  } catch (error) {
    const status = ["Order not found", "Insufficient stock for dispatch"].includes(error.message) ? (error.message === "Order not found" ? 404 : 409) : 400;
    return orderError(res, status, error.message);
  } finally {
    await session.endSession();
  }
});

export default router;
