const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://superb-palmier-53c23d.netlify.app"
  ],
  credentials: true
}));

app.use(express.json());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected");

    const db = client.db("localChefBazaar");

    const usersCollection = db.collection("users");
    const mealsCollection = db.collection("meals");
    const reviewsCollection = db.collection("reviews");
    const favoritesCollection = db.collection("favorites");
    const ordersCollection = db.collection("orders");
    const paymentsCollection = db.collection("payments");
    const requestsCollection = db.collection("requests");

    app.get("/", (req, res) => {
      res.send("Local Chef Bazaar Server Running ✅");
    });

// user
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
      const users = await usersCollection.find().toArray();
      res.send(users);
    });

    app.get("/users/role/:email", async (req, res) => {
      const user = await usersCollection.findOne({ email: req.params.email });
      res.send({ role: user?.role || "user" });
    });

    app.get("/meals", async (req, res) => {
      const meals = await mealsCollection.find().toArray();
      res.send(meals);
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
      const result = await mealsCollection.insertOne(req.body);
      res.send(result);
    });

    //  REVIEWS
   app.get("/reviews", async (req, res) => {
  try {
    const userEmail = req.query.userEmail;
    const query = userEmail ? { userEmail } : {};
    const reviews = await reviewsCollection.find(query).toArray();
    res.send(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: "Failed to fetch reviews" });
  }
});



    app.post("/reviews", async (req, res) => {
  const review = {
    ...req.body,
    userEmail: req.body.userEmail,
    date: new Date().toISOString()
  };
  const result = await reviewsCollection.insertOne(review);
  res.send(result);
});


    //FAVORITES 
    app.post("/favorites", async (req, res) => {
      const fav = req.body;
      const exists = await favoritesCollection.findOne({
        userEmail: fav.userEmail,
        mealId: fav.mealId,
      });

      if (exists) return res.status(400).send({ message: "Already favorited" });

      const result = await favoritesCollection.insertOne({
        ...fav,
        addedTime: new Date().toISOString(),
      });

      res.send(result);
    });

    app.get("/favorites", async (req, res) => {
      const favorites = await favoritesCollection
        .find({ userEmail: req.query.email })
        .toArray();
      res.send(favorites);
    });

    //ORDERS 
    app.post("/orders", async (req, res) => {
      const order = {
        ...req.body,
        orderStatus: "pending",
        paymentStatus: "Pending",
        orderTime: new Date().toISOString(),
      };
      const result = await ordersCollection.insertOne(order);
      res.send(result);
    });

    app.get("/orders", async (req, res) => {
      const orders = await ordersCollection
        .find({ userEmail: req.query.email })
        .sort({ orderTime: -1 })
        .toArray();
      res.send(orders);
    });

    app.patch("/orders/status/:id", async (req, res) => {
      if (!ObjectId.isValid(req.params.id))
        return res.status(400).send({ message: "Invalid order ID" });

      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { orderStatus: req.body.orderStatus } }
      );
      res.send(result);
    });

    app.patch("/orders/payment/:id", async (req, res) => {
      if (!ObjectId.isValid(req.params.id))
        return res.status(400).send({ message: "Invalid order ID" });

      const result = await ordersCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { paymentStatus: "Paid" } }
      );
      res.send(result);
    });

    //PAYMENTS 
    app.post("/payments", async (req, res) => {
      const result = await paymentsCollection.insertOne({
        ...req.body,
        paidAt: new Date().toISOString(),
      });
      res.send(result);
    });

    app.post("/requests", async (req, res) => {
      const request = {
        ...req.body,
        requestStatus: "pending",
        requestTime: new Date().toISOString(),
      };

      const exists = await requestsCollection.findOne({
        userEmail: request.userEmail,
        requestType: request.requestType,
        requestStatus: "pending",
      });

      if (exists)
        return res.status(400).send({ message: "Request already pending" });

      const result = await requestsCollection.insertOne(request);
      res.send(result);
    });

    app.get("/requests", async (req, res) => {
      const requests = await requestsCollection
        .find({ requestStatus: "pending" })
        .sort({ requestTime: -1 })
        .toArray();
      res.send(requests);
    });

    app.patch("/requests/:id", async (req, res) => {
      const id = req.params.id;
      const { status, role, userEmail } = req.body;

      if (!ObjectId.isValid(id))
        return res.status(400).send({ message: "Invalid request ID" });

      if (!status || !userEmail)
        return res.status(400).send({ message: "Missing required fields" });

      const requestUpdate = await requestsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { requestStatus: status } }
      );

      if (status === "approved" && role) {
        await usersCollection.updateOne(
          { email: userEmail },
          { $set: { role: role } }
        );
      }

      res.send({
        success: true,
        requestUpdated: requestUpdate.modifiedCount > 0,
        newRole: status === "approved" ? role : null,
      });
    });

    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}

run();
