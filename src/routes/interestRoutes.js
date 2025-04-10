const express = require("express")
const router = express.Router()
const {
  createInterest,
  getReceivedInterests,
  getSentInterests,
  respondToInterest,
  checkInterest
} = require("../controllers/interestController")
const { protect } = require("../middleware/authMiddleware")

// Create a new interest
router.post("/", protect, createInterest)

router.get("/check",protect,checkInterest)

// Get received interests
router.get("/received", protect, getReceivedInterests)

// Get sent interests
router.get("/sent", protect, getSentInterests)

// Respond to an interest
router.put("/:id/respond", protect, respondToInterest)

module.exports = router

