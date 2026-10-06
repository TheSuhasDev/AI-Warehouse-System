import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentType: { type: String, enum: ["ADVANCE", "FULL", "PARTIAL"], required: true },
    method: { type: String, enum: ["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"], required: true },
    reference: { type: String, trim: true },
    status: { type: String, enum: ["COMPLETED", "FAILED", "REFUNDED"], default: "COMPLETED" },
    notes: { type: String, trim: true },
  },
  { timestamps: true, autoIndex: false }
);

paymentSchema.index({ reference: 1 }, { unique: true, sparse: true });

const Payment = mongoose.model("Payment", paymentSchema);

export const ensurePaymentIndexes = async () => {
  const indexes = await Payment.collection.indexes();
  const referenceIndex = indexes.find((index) => index.name === "reference_1");

  if (referenceIndex) {
    await Payment.collection.dropIndex("reference_1");
  }

  const blankReferenceFilter = { reference: { $in: ["", null] } };
  const blankReferences = await Payment.collection.countDocuments(blankReferenceFilter);
  if (blankReferences > 0) {
    await Payment.collection.updateMany(blankReferenceFilter, { $unset: { reference: 1 } });
  }

  await Payment.collection.createIndex(
    { reference: 1 },
    { name: "reference_1", unique: true, sparse: true }
  );
};

export default Payment;
