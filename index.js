const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

/* =====================
   CORS & MIDDLEWARE
===================== */
app.use(cors({
  origin: [
    "http://localhost:5173",  // local dev
    "https://superb-palmier-53c23d.netlify.app", // your deployed site
    "https://beamish-starburst-1296f3.netlify.app" // if new Netlify link
  ],
  credentials: true
}));


app.use(express.json());

/* =====================
   MONGODB CONNECTION
===================== */
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

let isConnected = false;

let usersCollection;
let mealsCollection;
let reviewsCollection;
let favoritesCollection;
let ordersCollection;
let paymentsCollection;
let requestsCollection;

async function run() {
  try {
    if (!isConnected) {
      await client.connect();
      isConnected = true;
      console.log("✅ MongoDB connected");
    }

    const db = client.db("localChefBazaar");

    usersCollection = db.collection("users");
    mealsCollection = db.collection("meals");
    reviewsCollection = db.collection("reviews");
    favoritesCollection = db.collection("favorites");
    ordersCollection = db.collection("orders");
    paymentsCollection = db.collection("payments");
    requestsCollection = db.collection("requests");

  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
  }
}

run();

/* =====================
   ROUTES
===================== */

app.get("/", (req, res) => {
  res.send("Local Chef Bazaar Server is Running ✅");
});

/* ---------- USERS ---------- */
app.post("/users", async (req, res) => {
  const user = req.body;
  const exists = await usersCollection.findOne({ email: user.email });
  if (exists) return res.send({ message: "User already exists" });

  const result = await usersCollection.insertOne({
    ...user,
    role: "user",
    status: "active",
    createdAt: new Date().toISOString(),
  });

  res.send(result);
});

app.get("/users", async (req, res) => {
  res.send(await usersCollection.find().toArray());
});

app.get("/users/role/:email", async (req, res) => {
  const user = await usersCollection.findOne({ email: req.params.email });
  res.send({ role: user?.role || "user" });
});

/* ---------- MEALS ---------- */
app.get("/meals", async (req, res) => {
  res.send(await mealsCollection.find().toArray());
});

app.get("/meals/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id))
    return res.status(400).send({ message: "Invalid ID" });

  const meal = await mealsCollection.findOne({
    _id: new ObjectId(req.params.id),
  });
  res.send(meal);
});

app.post("/meals", async (req, res) => {
  res.send(await mealsCollection.insertOne(req.body));
});

/* ---------- REVIEWS ---------- */
app.get("/reviews", async (req, res) => {
  const query = req.query.userEmail ? { userEmail: req.query.userEmail } : {};
  res.send(await reviewsCollection.find(query).toArray());
});

app.post("/reviews", async (req, res) => {
  res.send(await reviewsCollection.insertOne({
    ...req.body,
    date: new Date().toISOString()
  }));
});

/* ---------- FAVORITES ---------- */
app.post("/favorites", async (req, res) => {
  const fav = req.body;
  const exists = await favoritesCollection.findOne({
    userEmail: fav.userEmail,
    mealId: fav.mealId,
  });

  if (exists) return res.status(400).send({ message: "Already favorited" });

  res.send(await favoritesCollection.insertOne({
    ...fav,
    addedTime: new Date().toISOString(),
  }));
});

app.get("/favorites", async (req, res) => {
  res.send(await favoritesCollection.find({ userEmail: req.query.email }).toArray());
});

/* ---------- ORDERS ---------- */
app.post("/orders", async (req, res) => {
  res.send(await ordersCollection.insertOne({
    ...req.body,
    orderStatus: "pending",
    paymentStatus: "Pending",
    orderTime: new Date().toISOString(),
  }));
});

app.get("/orders", async (req, res) => {
  res.send(await ordersCollection
    .find({ userEmail: req.query.email })
    .sort({ orderTime: -1 })
    .toArray());
});

app.patch("/orders/status/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id))
    return res.status(400).send({ message: "Invalid order ID" });

  res.send(await ordersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { orderStatus: req.body.orderStatus } }
  ));
});

app.patch("/orders/payment/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id))
    return res.status(400).send({ message: "Invalid order ID" });

  res.send(await ordersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { paymentStatus: "Paid" } }
  ));
});

/* ---------- PAYMENTS ---------- */
app.post("/payments", async (req, res) => {
  res.send(await paymentsCollection.insertOne({
    ...req.body,
    paidAt: new Date().toISOString(),
  }));
});

/* ---------- REQUESTS ---------- */
app.post("/requests", async (req, res) => {
  const exists = await requestsCollection.findOne({
    userEmail: req.body.userEmail,
    requestType: req.body.requestType,
    requestStatus: "pending",
  });

  if (exists)
    return res.status(400).send({ message: "Request already pending" });

  res.send(await requestsCollection.insertOne({
    ...req.body,
    requestStatus: "pending",
    requestTime: new Date().toISOString(),
  }));
});

app.get("/requests", async (req, res) => {
  res.send(await requestsCollection
    .find({ requestStatus: "pending" })
    .sort({ requestTime: -1 })
    .toArray());
});

app.patch("/requests/:id", async (req, res) => {
  const { status, role, userEmail } = req.body;

  await requestsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { requestStatus: status } }
  );

  if (status === "approved" && role) {
    await usersCollection.updateOne(
      { email: userEmail },
      { $set: { role } }
    );
  }

  res.send({ success: true });
});

/* =====================
   EXPORT FOR VERCEL
===================== */
module.exports = app;
