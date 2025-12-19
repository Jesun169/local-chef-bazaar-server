// server.js
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// ---------------- Middleware ----------------
app.use(cors());
app.use(express.json());

// ---------------- MongoDB Connection ----------------
const uri =
  process.env.MONGO_URI ||
  "mongodb+srv://chefdb:X2Ojkg5Gd6otLHxQ@cluster0.lls6dfv.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });

async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB connected");

    const db = client.db("localChefBazaar");
    const mealsCollection = db.collection("meals");
    const reviewsCollection = db.collection("reviews");
    const ordersCollection = db.collection("orders");
    const usersCollection = db.collection("users");
    const favoritesCollection = db.collection("favorites");

    // ---------------- ROOT ----------------
    app.get("/", (req, res) => {
      res.send("Local Chef Bazaar Server Running ✅");
    });

    // ---------------- MEALS ----------------
    app.get("/meals", async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 0;
        const meals = await mealsCollection.find().limit(limit).toArray();
        res.send(meals);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch meals", error });
      }
    });

    app.get("/meals/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid meal ID" });
        }
        const meal = await mealsCollection.findOne({ _id: new ObjectId(id) });
        if (!meal) return res.status(404).send({ message: "Meal not found" });
        res.send(meal);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch meal", error });
      }
    });

    app.post("/meals", async (req, res) => {
      try {
        const meal = req.body;
        const result = await mealsCollection.insertOne(meal);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add meal", error });
      }
    });

    // ---------------- REVIEWS ----------------
    app.get("/reviews", async (req, res) => {
      try {
        const { foodId } = req.query;
        let query = {};
        if (foodId) {
          query = { foodId };
        }
        const reviews = await reviewsCollection.find(query).toArray();
        res.send(reviews);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch reviews", error });
      }
    });

    app.post("/reviews", async (req, res) => {
      try {
        const review = {
          ...req.body,
          date: new Date().toISOString()
        };
        const result = await reviewsCollection.insertOne(review);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add review", error });
      }
    });

    // ---------------- FAVORITES ----------------
    app.post("/favorites", async (req, res) => {
      try {
        const fav = req.body;
        const existing = await favoritesCollection.findOne({
          userEmail: fav.userEmail,
          mealId: fav.mealId
        });

        if (existing) {
          return res.send({ message: "Meal already in favorites" });
        }

        const result = await favoritesCollection.insertOne({
          ...fav,
          addedTime: new Date().toISOString()
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add favorite", error });
      }
    });

    app.get("/favorites", async (req, res) => {
      try {
        const email = req.query.email;
        const favorites = await favoritesCollection.find({ userEmail: email }).toArray();
        res.send(favorites);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch favorites", error });
      }
    });

    // ---------------- ORDERS ----------------
    app.post("/orders", async (req, res) => {
      try {
        const order = req.body;
        const result = await ordersCollection.insertOne(order);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to place order", error });
      }
    });

    app.get("/orders", async (req, res) => {
      try {
        const email = req.query.email;
        const orders = await ordersCollection.find({ userEmail: email }).toArray();
        res.send(orders);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch orders", error });
      }
    });

    // ---------------- USERS ----------------
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const existingUser = await usersCollection.findOne({ email: user.email });

        if (existingUser) {
          return res.status(400).send({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne({
          ...user,
          status: "active",
          role: "user"
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to register user", error });
      }
    });

    app.get("/users", async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch users", error });
      }
    });

    // ---------------- START SERVER ----------------
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });

  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    process.exit(1);
  }
}

run();
