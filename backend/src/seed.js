import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/database.js";
import Product from "./models/Product.js";
import StockMovement from "./models/StockMovement.js";

dotenv.config();

const products = [
  {
    name: "Drill",
    sku: "DRL001",
    purchasePrice: 1200,
    sellingPrice: 1500,
    stock: 10,
    minimumStock: 3,
    location: "Rack A - Shelf 01",
  },
  {
    name: "Hammer",
    sku: "HAM001",
    purchasePrice: 250,
    sellingPrice: 350,
    stock: 20,
    minimumStock: 5,
    location: "Rack A - Shelf 02",
  },
  {
    name: "Pliers",
    sku: "PLR001",
    purchasePrice: 200,
    sellingPrice: 300,
    stock: 15,
    minimumStock: 5,
    location: "Rack B - Shelf 01",
  },
  {
    name: "Screwdriver",
    sku: "SCR001",
    purchasePrice: 100,
    sellingPrice: 150,
    stock: 25,
    minimumStock: 5,
    location: "Rack B - Shelf 02",
  },
  {
    name: "Wrench",
    sku: "WRC001",
    purchasePrice: 300,
    sellingPrice: 450,
    stock: 15,
    minimumStock: 5,
    location: "Rack C - Shelf 01",
  },
];

const seedProducts = async () => {
  try {
    await connectDB();

    // Clear old products and movement history
    await StockMovement.deleteMany({});
    await Product.deleteMany({});

    // Insert new products
    await Product.insertMany(products);

    console.log("5 warehouse products added successfully");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  }
};

seedProducts();