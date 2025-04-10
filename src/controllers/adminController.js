const User = require("../models/User")
const ProductListing = require("../models/ProductListing")
const ServiceListing = require("../models/ServiceListing")
const JobListing = require("../models/JobListing")
const MatrimonyListing = require("../models/MatrimonyListing")
const AdminDashboard = require("../models/Admin")
const Interest = require("../models/Interest")

// Listing models mapping
const ListingModels = {
  product: ProductListing,
  service: ServiceListing,
  job: JobListing,
  matrimony: MatrimonyListing,
}

// Explicit exports with error handling wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
const getDashboardStatistics = asyncHandler(async (req, res) => {
  // Update and retrieve dashboard statistics
  const dashboard = await AdminDashboard.updateStatistics()

  res.status(200).json({
    success: true,
    data: dashboard,
  })
})

// @desc    Get users with filtering and pagination
// @route   GET /api/admin/users
const getUsers = asyncHandler(async (req, res) => {
  const page = Number.parseInt(req.query.page) || 1
  const limit = Number.parseInt(req.query.limit) || 10
  const skipIndex = (page - 1) * limit

  // Filtering options
  const filters = {}
  if (req.query.role) filters.role = req.query.role
  if (req.query.isActive !== undefined) filters.isActive = req.query.isActive === "true"

  // Search
  if (req.query.search) {
    filters.$or = [
      { username: { $regex: req.query.search, $options: "i" } },
      { email: { $regex: req.query.search, $options: "i" } },
    ]
  }

  // Execute query
  const totalUsers = await User.countDocuments(filters)
  const users = await User.find(filters).select("-password").sort({ createdAt: -1 }).limit(limit).skip(skipIndex)

  res.status(200).json({
    success: true,
    count: users.length,
    totalUsers,
    totalPages: Math.ceil(totalUsers / limit),
    currentPage: page,
    data: users,
  })
})

// @desc    Bulk user actions`
// @route   POST /api/admin/users/bulk
const bulkUserActions = asyncHandler(async (req, res) => {
  const { action, userIds } = req.body

  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({
      success: false,
      message: "Invalid user IDs",
    })
  }

  let result
  switch (action) {
    case "activate":
      result = await User.updateMany({ _id: { $in: userIds } }, { $set: { isActive: true } })
      break
    case "deactivate":
      result = await User.updateMany({ _id: { $in: userIds } }, { $set: { isActive: false } })
      break
    case "delete":
      result = await User.deleteMany({ _id: { $in: userIds } })
      break
    default:
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount || result.deletedCount} ${result.modifiedCount || result.deletedCount > 1 ? "users" : "user"} ${action}d`,
    modifiedCount: result.modifiedCount || result.deletedCount,
  })
})

// @desc    Bulk listing actions
// @route   POST /api/admin/listings/bulk
const bulkListingActions = asyncHandler(async (req, res) => {
  const { type, action, listingIds } = req.body

  // Validate input
  if (!type || !ListingModels[type]) {
    return res.status(400).json({
      success: false,
      message: "Invalid listing type",
    })
  }

  if (!listingIds || !Array.isArray(listingIds)) {
    return res.status(400).json({
      success: false,
      message: "Invalid listing IDs",
    })
  }

  const ListingModel = ListingModels[type]
  console.log("Listing Model:", ListingModel.modelName)
  let result

  switch (action) {
    case "activate":
      result = await ListingModel.updateMany({ _id: { $in: listingIds } }, { $set: { status: "active" } })
      break
    case "deactivate":
      result = await ListingModel.updateMany({ _id: { $in: listingIds } }, { $set: { status: "inactive" } })
      break
    case "delete":
      result = await ListingModel.deleteMany({ _id: { $in: listingIds } })
      break
    default:
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
  }

  res.status(200).json({
    success: true,
    message: `${result.matchedCount} ${type} listings found, ${result.modifiedCount} updated`,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
  })
})

// @desc    Manage system configuration
// @route   PUT /api/admin/system-config
const updateSystemConfiguration = asyncHandler(async (req, res) => {
  const { maintenanceMode, disclaimerText, termsOfService } = req.body

  const dashboard = (await AdminDashboard.findOne({})) || new AdminDashboard()

  if (maintenanceMode !== undefined) {
    dashboard.systemConfig.maintenanceMode = maintenanceMode
  }

  if (disclaimerText) {
    dashboard.systemConfig.disclaimerText = disclaimerText
  }

  if (termsOfService) {
    dashboard.systemConfig.termsOfService = termsOfService
  }

  await dashboard.save()

  res.status(200).json({
    success: true,
    data: dashboard.systemConfig,
  })
})

// Get system configuration
exports.getSystemConfig = async (req, res) => {
  try {
    // You can create a SystemConfig model or use a singleton approach
    // For now, we'll return default values
    const config = {
      siteName: "FreecoSystem",
      siteDescription: "A platform for free exchange of goods and services",
      contactEmail: "support@freecosystem.com",
      contactPhone: "+1234567890",
      maxImagesPerAd: 4,
      maxAdDurationDays: 30,
      requireModeration: true,
      allowUserRegistration: true,
      maintenanceMode: false,
    }

    res.status(200).json(config)
  } catch (error) {
    console.error("Error in getSystemConfig:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Update system configuration
exports.updateSystemConfig = async (req, res) => {
  try {
    // In a real implementation, you would save this to a database
    // For now, we'll just return success
    res.status(200).json({
      success: true,
      message: "System configuration updated successfully",
    })
  } catch (error) {
    console.error("Error in updateSystemConfig:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Export all methods
module.exports = {
  getDashboardStatistics,
  getUsers,
  bulkUserActions,
  bulkListingActions,
  updateSystemConfiguration,
  getSystemConfig: exports.getSystemConfig,
  updateSystemConfig: exports.updateSystemConfig,
}
