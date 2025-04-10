const express = require("express")
const router = express.Router()
const adminController = require("../controllers/adminController")
const { protect, admin } = require("../middleware/modMiddleware")

// Apply middleware to all routes
router.use(protect)
router.use(admin)

// User management routes
router.get("/users", adminController.getUsers)
router.post("/users/bulk", adminController.bulkUserActions)  // Changed from bulkUpdateUsers

// Listing management routes
router.get("/listings", (req, res) => {
  // Placeholder until you implement getListings
  res.status(501).json({ message: "Not implemented yet" });
})
router.post("/listings/bulk", adminController.bulkListingActions)  // Changed from bulkUpdateListings

// Interest management routes
router.get("/interests", (req, res) => {
  // Placeholder until you implement getInterests
  res.status(501).json({ message: "Not implemented yet" });
})
router.post("/interests/bulk", (req, res) => {
  // Placeholder until you implement bulkUpdateInterests
  res.status(501).json({ message: "Not implemented yet" });
})

// Analytics routes
router.get("/analytics/overview", (req, res) => {
  // Placeholder until you implement getAnalyticsOverview
  res.status(501).json({ message: "Not implemented yet" });
})
router.get("/analytics/listings", (req, res) => {
  // Placeholder until you implement getListingsAnalytics
  res.status(501).json({ message: "Not implemented yet" });
})
router.get("/analytics/users", (req, res) => {
  // Placeholder until you implement getUsersAnalytics
  res.status(501).json({ message: "Not implemented yet" });
})

// System configuration routes
router.get("/system-config", adminController.getSystemConfig)
router.put("/system-config", adminController.updateSystemConfig)

// Dashboard statistics
router.get("/dashboard", adminController.getDashboardStatistics)

module.exports = router