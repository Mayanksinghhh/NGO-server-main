const express = require("express")
const router = express.Router()
const modController = require("../controllers/modController")
const { protect, moderator } = require("../middleware/modMiddleware")
const { upload } = require("../middleware/uploadMiddleware")

// Apply middleware to all routes
router.use(protect)
router.use(moderator)

// Listings moderation routes
router.get("/listings", modController.getListingsForModeration)
router.post("/listings/approve-reject", modController.approveRejectListing)
router.post("/listings/bulk-approve-reject", modController.bulkApproveRejectListings)

// User moderation routes
router.get("/users", modController.getUsersForModeration)
router.post("/users/approve-reject", modController.approveRejectUser)
router.post("/users/bulk-approve-reject", modController.bulkApproveRejectUsers)

// Interest moderation routes - Fix the method to POST
router.get("/interests", modController.getInterestsForModeration)
router.post("/interests/approve-reject", modController.approveRejectInterest) // Changed from PUT to POST
router.post("/interests/bulk-approve-reject", modController.bulkApproveRejectInterests)

module.exports = router
