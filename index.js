const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

// const Stripe = require("stripe");
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); 


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

let usersCollection;
let mealsCollection;
let reviewsCollection;
let favoritesCollection;
let ordersCollection;
let paymentsCollection;
let requestsCollection;

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

    console.log("MongoDB connected");
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
  res.json({ message: "Local Chef Bazaar Server Running " });
});

/* USERS  */

app.post("/users", async (req, res) => {
  const user = req.body;

  const exists = await usersCollection.findOne({ email: user.email });

  if (exists) {
    return res.json({ message: "User already exists" });
  }

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

  res.json(users.map((u) => ({ ...u, _id: u._id.toString() })));
});

app.get("/users/role/:email", async (req, res) => {
  const user = await usersCollection.findOne({ email: req.params.email });

  res.json({ role: user?.role || "user" });
});

/* MEALS */

app.get("/meals", async (req, res) => {
  const query = {};

  if (req.query.chefEmail) {
    query.chefEmail = req.query.chefEmail;
  }

  const meals = await mealsCollection.find(query).toArray();

  res.json(meals.map((m) => ({ ...m, _id: m._id.toString() })));
});

app.get("/meals/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  const meal = await mealsCollection.findOne({
    _id: new ObjectId(req.params.id),
  });

  if (!meal) {
    return res.status(404).json({ message: "Meal not found" });
  }

  res.json({ ...meal, _id: meal._id.toString() });
});

app.post("/meals", async (req, res) => {
  const result = await mealsCollection.insertOne(req.body);

  res.json({ ...req.body, _id: result.insertedId.toString() });
});

app.patch("/meals/:id", async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  await mealsCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: req.body }
  );

  res.json({ success: true });
});

app.delete("/meals/:id", async (req, res) => {
  await mealsCollection.deleteOne({ _id: new ObjectId(req.params.id) });

  res.json({ success: true });
});

/* REVIEWS */

app.get("/reviews", async (req, res) => {
  try {
    const { mealId, userEmail } = req.query;

    const query = {};
    if (mealId) query.mealId = String(mealId);
    if (userEmail) query.userEmail = String(userEmail);

    const reviews = await reviewsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(
      reviews.map((r) => ({
        ...r,
        _id: r._id.toString(),
      }))
    );
  } catch {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

// POST review
app.post("/reviews", async (req, res) => {
  try {
    const { mealId, rating, comment, userEmail, username, reviewerImage } = req.body;

    if (!mealId || !rating || !comment || !userEmail) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // 1. FETCH DATA FIRST
    const mealData = await mealsCollection.findOne({ _id: new ObjectId(mealId) });
    const userData = await usersCollection.findOne({ email: userEmail });

    // 2. NOW DEFINE THE REVIEW OBJECT
    const review = {
      mealId: String(mealId),
      mealName: mealData?.mealName || "Unknown Meal",
      username: userData?.displayName || username || userEmail.split("@")[0],
      reviewerName: userData?.displayName || username || userEmail.split("@")[0],
      reviewerImage,
      rating: Number(rating),
      comment,
      userEmail,
      createdAt: new Date().toISOString(),
    };

    const result = await reviewsCollection.insertOne(review);

    // ... (rest of your average rating logic)
    res.json({ success: true, insertedId: result.insertedId.toString(), review });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add review" });
  }
});

app.delete("/reviews/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    const review = await reviewsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    await reviewsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ message: "Failed to delete review" });
  }
});

app.patch("/reviews/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { comment, rating } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid review ID" });
    }

    await reviewsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          comment,
          rating: Number(rating),
        },
      }
    );

    res.json({
      success: true,
      message: "Review updated successfully",
    });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({ message: "Failed to update review" });
  }
});
/* FAVORITES  */
app.get("/favorites", async (req, res) => {
  try {

    res.set("Cache-Control", "no-store");

    const email = req.query.email;

    if (!email) {
      return res.json([]);
    }

    const favs = await favoritesCollection
      .find({ userEmail: email })
      .toArray();

    res.json(favs.map((f) => ({ ...f, _id: f._id.toString() })));
  } catch (error) {
    console.error("Favorites fetch error:", error);
    res.status(500).json({ message: "Failed to fetch favorites" });
  }
});
/* FAVORITES  */

app.post("/favorites", async (req, res) => {
  try {
    const { userEmail, mealId, mealName, chefId, chefName, price } = req.body;

    if (!userEmail || !mealId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const exists = await favoritesCollection.findOne({ userEmail, mealId });
    if (exists) {
      return res.status(400).json({ message: "Meal already in favorites" });
    }

    const result = await favoritesCollection.insertOne({
      userEmail,
      mealId,
      mealName,
      chefId,
      chefName,
      price,
      createdAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      insertedId: result.insertedId.toString(),
    });
  } catch (err) {
    console.error("Add to favorites error:", err);
    res.status(500).json({ message: "Failed to add favorite" });
  }
});

/* DELETE ROUTE */
app.delete("/favorites/:id", async (req, res) => {
  try {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid favorite ID" });
    }

    const result = await favoritesCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Favorite not found",
      });
    }

    res.json({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
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

  res.json(orders.map((o) => ({ ...o, _id: o._id.toString() })));
});

app.patch("/orders/:id/status", async (req, res) => {
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

/* PAYMENTS  */

// app.post("/payments", async (req, res) => {
//   const result = await paymentsCollection.insertOne({
//     ...req.body,
//     paidAt: new Date().toISOString(),
//   });

//   res.json({ ...req.body, _id: result.insertedId.toString() });
// });

// // CREATE PAYMENT
// app.post("/create-payment-intent", async (req, res) => {
//   try {
//     const { amount, currency = "BDT" } = req.body; 
//     if (!amount) return res.status(400).json({ message: "Amount is required" });

//     const paymentIntent = await stripe.paymentIntents.create({
//       amount,
//       currency,
//     });

//     res.json({
//       clientSecret: paymentIntent.client_secret,
//     });
//   } catch (error) {
//     console.error("Stripe Payment Intent Error:", error);
//     res.status(500).json({ message: "Failed to create payment intent" });
//   }
// });

/* REQUESTS  */

app.post("/requests", async (req, res) => {
  const exists = await requestsCollection.findOne({
    userEmail: req.body.userEmail,
    requestType: req.body.requestType,
    requestStatus: "pending",
  });

  if (exists) {
    return res.status(400).json({ message: "Already pending" });
  }

  const result = await requestsCollection.insertOne({
    ...req.body,
    requestStatus: "pending",
    requestTime: new Date().toISOString(),
  });

  res.json({ ...req.body, _id: result.insertedId.toString() });
});

app.get("/requests", async (req, res) => {
  const reqs = await requestsCollection.find().toArray();

  res.json(reqs.map((r) => ({ ...r, _id: r._id.toString() })));
});


app.patch("/requests/:id", async (req, res) => {
  try {
    const { status, role, userEmail } = req.body;
    const id = req.params.id;

    // Determine if we should use ObjectId or a plain string
    const query = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { _id: id };

    const result = await requestsCollection.updateOne(
      query, // Use the flexible query here
      { $set: { requestStatus: status } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Request not found in database" });
    }

    if (status === "approved" && role && userEmail) {
      const finalRole = role.toLowerCase().includes("chef") ? "chef" : role.toLowerCase();
      
      await usersCollection.updateOne(
        { email: userEmail }, 
        { $set: { role: finalRole } }
      );
    }

    res.json({ success: true, message: `Request ${status}` });
  } catch (error) {
    console.error("Patch Request Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;