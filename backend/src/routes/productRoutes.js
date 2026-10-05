import express from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
const router = express.Router();

const parseQuantity = (value) => {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
};

// Get all products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch products",
      error: error.message,
    });
  }
});

// Add a product
router.post("/", async (req, res) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({
      message: "Failed to create product",
      error: error.message,
    });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const [products, dispatches, recentMovements] = await Promise.all([
      Product.find().sort({ name: 1 }),
      StockMovement.countDocuments({
        type: "DISPATCH",
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      StockMovement.find()
        .populate("product", "name sku")
        .sort({ createdAt: -1 })
        .limit(8),
    ]);

    res.json({
      totalProducts: products.length,
      totalStock: products.reduce((total, product) => total + product.stock, 0),
      lowStockProducts: products.filter(
        (product) => product.stock <= product.minimumStock
      ).length,
      todayDispatchCount: dispatches,
      recentMovements,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dashboard data" });
  }
});

// Receive stock
router.patch("/:id/receive", async (req, res) => {
  try {
    const { quantity } = req.body;
    const parsedQuantity = parseQuantity(quantity);

    if (!parsedQuantity) {
      return res.status(400).json({
        message: "Quantity must be greater than 0",
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { stock: parsedQuantity },
      },
      {
        new: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    // Record stock movement
    await StockMovement.create({
      product: product._id,
      type: "RECEIVE",
      quantity: parsedQuantity,
    });

    res.json({
      message: "Stock received successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to receive stock",
      error: error.message,
    });
  }
});

router.get("/movements/history", async (req, res) => {
  try {
    const movements = await StockMovement.find()
      .populate("product", "name sku")
      .sort({ createdAt: -1 });

    res.json(movements);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch stock history",
      error: error.message,
    });
  }
});

// Dispatch stock
router.patch("/:id/dispatch", async (req, res) => {
  try {
    const { quantity } = req.body;
    const parsedQuantity = parseQuantity(quantity);

    if (!parsedQuantity) {
      return res.status(400).json({
        message: "Quantity must be greater than 0",
      });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    if (product.stock < parsedQuantity) {
      return res.status(400).json({
        message: "Insufficient stock",
        availableStock: product.stock,
      });
    }

    product.stock -= parsedQuantity;
    await product.save();

    // Record dispatch movement
    await StockMovement.create({
      product: product._id,
      type: "DISPATCH",
      quantity: parsedQuantity,
    });

    res.json({
      message: "Stock dispatched successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to dispatch stock",
      error: error.message,
    });
  }
});

router.post("/dispatch/transaction", async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const client = req.body.client || {};

  if (
    !items.length ||
    !client.name?.trim() ||
    !client.phone?.trim() ||
    !client.address?.trim()
  ) {
    return res.status(400).json({
      message: "Client name, phone, address, and at least one item are required",
    });
  }

  const session = await mongoose.startSession();
  try {
    let updatedProducts = [];
    await session.withTransaction(async () => {
      for (const item of items) {
        const quantity = parseQuantity(item.quantity);
        if (!quantity) throw new Error("Every dispatch quantity must be a positive integer");

        const product = await Product.findOneAndUpdate(
          { _id: item.productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { new: true, session }
        );
        if (!product) throw new Error("A product is missing or has insufficient stock");

        await StockMovement.create(
          [{ product: product._id, type: "DISPATCH", quantity }],
          { session }
        );
        updatedProducts.push({ product, quantity });
      }
    });

    res.json({ message: "Dispatch completed successfully", products: updatedProducts });
  } catch (error) {
    const message = error.message || "";
    res.status(message.toLowerCase().includes("insufficient") || message.toLowerCase().includes("missing")
      ? 400
      : 500).json({ message: error.message || "Dispatch failed" });
  } finally {
    await session.endSession();
  }
});

export default router;