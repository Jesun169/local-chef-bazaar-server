const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://superb-palmier-53c23d.netlify.app",
      "https://beamish-starburst-1296f3.netlify.app",
    ],
    credentials: true,
  })
);

app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI);
let db;

let usersCollection,
  mealsCollection,
  reviewsCollection,
  favoritesCollection,
  ordersCollection,
  paymentsCollection,
  requestsCollection;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("localChefBazaar");

    usersCollection = db.collection("users");
    mealsCollection = db.collection("meals");
    reviewsCollection = db.collection("reviews");
    favoritesCollection = db.collection("favorites");
    ordersCollection = db.collection("orders");
    paymentsCollection = db.collection("payments");
    requestsCollection = db.collection("requests");

    console.log("✅ MongoDB connected");
  }
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ message: "Database connection failed" });
  }
});

/* ROOT */
app.get("/", (req, res) => {
  res.json({ message: "Local Chef Bazaar Server Running ✅" });
});

/* USERS */
app.post("/users", async (req, res) => {
  const user = req.body;
  const exists = await usersCollection.findOne({ email: user.email });
  if (exists) return res.json({ message: "User already exists" });

  const result = await usersCollection.insertOne({
    ...user,
    role: "user",
    status: "active",
    createdAt: new Date().toISOString(),
  });

  res.json({ ...user, _id: result.insertedId.toString() });
});

app.get("/users", async (req, res) => {
  const users = await usersCollection.find().toArray();
  res.json(users.map(u => ({ ...u, _id: u._id.toString() })));
});

app.get("/users/role/:email", async (req, res) => {
  const user = await usersCollection.findOne({ email: req.params.email });
  res.json({ role: user?.role || "user" });
});

app.patch("/users/fraud/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id))
    return res.status(400).json({ message: "Invalid ID" });

  const user = await usersCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.role === "admin")
    return res.status(403).json({ message: "Admin cannot be fraud" });

  await usersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { status: "fraud" } }
  );

  res.json({ success: true });
});

/* MEALS */
app.get("/meals", async (req, res) => {
  const query = {};
  if (req.query.chefEmail) query.chefEmail = req.query.chefEmail;

  const meals = await mealsCollection.find(query).toArray();
  res.json(meals.map(m => ({ ...m, _id: m._id.toString() })));
});

app.get("/meals/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id))
    return res.status(400).json({ message: "Invalid ID" });

  const meal = await mealsCollection.findOne({ _id: new ObjectId(req.params.id) });
  if (!meal) return res.status(404).json({ message: "Meal not found" });

  res.json({ ...meal, _id: meal._id.toString() });
});

app.post("/meals", async (req, res) => {
  const result = await mealsCollection.insertOne(req.body);
  res.json({ ...req.body, _id: result.insertedId.toString() });
});

app.put("/meals/:id", updateMeal);
app.patch("/meals/:id", updateMeal);

async function updateMeal(req, res) {
  if (!ObjectId.isValid(req.params.id))
    return res.status(400).json({ message: "Invalid ID" });

  const result = await mealsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: req.body }
  );

  if (!result.matchedCount)
    return res.status(404).json({ message: "Meal not found" });

  res.json({ success: true });
}

app.delete("/meals/:id", async (req, res) => {
  await mealsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ success: true });
});

/* REVIEWS */
app.get("/reviews", async (req, res) => {
  const query = req.query.userEmail ? { userEmail: req.query.userEmail } : {};
  const reviews = await reviewsCollection.find(query).toArray();
  res.json(reviews.map(r => ({ ...r, _id: r._id.toString() })));
});

app.post("/reviews", async (req, res) => {
  const result = await reviewsCollection.insertOne({
    ...req.body,
    date: new Date().toISOString(),
  });
  res.json({ ...req.body, _id: result.insertedId.toString() });
});

/* FAVORITES */
app.post("/favorites", async (req, res) => {
  const exists = await favoritesCollection.findOne(req.body);
  if (exists) return res.status(400).json({ message: "Already added" });

  const result = await favoritesCollection.insertOne({
    ...req.body,
    addedTime: new Date().toISOString(),
  });
  res.json({ ...req.body, _id: result.insertedId.toString() });
});

app.get("/favorites", async (req, res) => {
  const favs = await favoritesCollection
    .find({ userEmail: req.query.email })
    .toArray();
  res.json(favs.map(f => ({ ...f, _id: f._id.toString() })));
});

/* ORDERS */
app.post("/orders", async (req, res) => {
  const result = await ordersCollection.insertOne({
    ...req.body,
    orderStatus: "pending",
    paymentStatus: "Pending",
    orderTime: new Date().toISOString(),
  });
  res.json({ ...req.body, _id: result.insertedId.toString() });
});

app.get("/orders", async (req, res) => {
  const query = {};
  if (req.query.email) query.userEmail = req.query.email;
  if (req.query.chefEmail) query.chefEmail = req.query.chefEmail;
  if (req.query.chefId) query.chefId = req.query.chefId;

  const orders = await ordersCollection
    .find(query)
    .sort({ orderTime: -1 })
    .toArray();

  res.json(orders.map(o => ({ ...o, _id: o._id.toString() })));
});

app.patch("/orders/:id/status", async (req, res) => {
  if (!ObjectId.isValid(req.params.id))
    return res.status(400).json({ message: "Invalid order ID" });

  await ordersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { orderStatus: req.body.orderStatus } }
  );
  res.json({ success: true });
});

app.patch("/orders/:id/payment", async (req, res) => {
  await ordersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { paymentStatus: "Paid" } }
  );
  res.json({ success: true });
});

/*ADMIN STATS*/
app.get("/admin/stats", async (req, res) => {
  try {
    const totalUsers = await usersCollection.countDocuments();
    const pendingOrders = await ordersCollection.countDocuments({ orderStatus: "pending" });
    const deliveredOrders = await ordersCollection.countDocuments({ orderStatus: "delivered" });

    const deliveredOrdersData = await ordersCollection.find({ orderStatus: "delivered" }).toArray();
    const totalPaymentAmount = deliveredOrdersData.reduce(
      (sum, o) => sum + Number(o.price || 0),
      0
    );

    res.json({
      totalUsers,
      pendingOrders,
      deliveredOrders,
      totalPaymentAmount,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ message: "Failed to fetch admin statistics" });
  }
});

/* PAYMENTS */
app.post("/payments", async (req, res) => {
  const result = await paymentsCollection.insertOne({
    ...req.body,
    paidAt: new Date().toISOString(),
  });
  res.json({ ...req.body, _id: result.insertedId.toString() });
});

/*REQUESTS*/
app.post("/requests", async (req, res) => {
  const exists = await requestsCollection.findOne({
    userEmail: req.body.userEmail,
    requestType: req.body.requestType,
    requestStatus: "pending",
  });
  if (exists) return res.status(400).json({ message: "Already pending" });

  const result = await requestsCollection.insertOne({
    ...req.body,
    requestStatus: "pending",
    requestTime: new Date().toISOString(),
  });

  res.json({ ...req.body, _id: result.insertedId.toString() });
});

app.get("/requests", async (req, res) => {
  const reqs = await requestsCollection.find().toArray();
  res.json(reqs.map(r => ({ ...r, _id: r._id.toString() })));
});

app.patch("/requests/:id", async (req, res) => {
  const { status, role, userEmail } = req.body;

  await requestsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { requestStatus: status } }
  );

  if (status === "approved" && role) {
    await usersCollection.updateOne({ email: userEmail }, { $set: { role } });
  }

  res.json({ success: true });
});

app.listen(port, () => console.log(`🚀 Server running on port ${port}`));

module.exports = app;
