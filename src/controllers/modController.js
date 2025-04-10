const User = require("../models/User")
const ProductListing = require("../models/ProductListing")
const ServiceListing = require("../models/ServiceListing")
const JobListing = require("../models/JobListing")
const MatrimonyListing = require("../models/MatrimonyListing")
const Interest = require("../models/Interest")
const Notification = require("../models/Notification")
const mongoose = require("mongoose")

// Get listings for moderation
exports.getListingsForModeration = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit
    const type = req.query.type || "all"
    const status = req.query.status || "pending"

    const query = { status: status }
    let listings = []
    let totalListings = 0

    if (type === "all" || type === "product") {
      const productListings = await ProductListing.find(query)
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(type === "all" ? 0 : skip)
        .limit(type === "all" ? 0 : limit)

      const productCount = await ProductListing.countDocuments(query)

      listings = [
        ...listings,
        ...productListings.map((listing) => ({
          ...listing._doc,
          listingType: "product",
        })),
      ]

      totalListings += productCount
    }

    if (type === "all" || type === "service") {
      const serviceListings = await ServiceListing.find(query)
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(type === "all" ? 0 : skip)
        .limit(type === "all" ? 0 : limit)

      const serviceCount = await ServiceListing.countDocuments(query)

      listings = [
        ...listings,
        ...serviceListings.map((listing) => ({
          ...listing._doc,
          listingType: "service",
        })),
      ]

      totalListings += serviceCount
    }

    if (type === "all" || type === "job") {
      const jobListings = await JobListing.find(query)
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(type === "all" ? 0 : skip)
        .limit(type === "all" ? 0 : limit)

      const jobCount = await JobListing.countDocuments(query)

      listings = [
        ...listings,
        ...jobListings.map((listing) => ({
          ...listing._doc,
          listingType: "job",
        })),
      ]

      totalListings += jobCount
    }

    if (type === "all" || type === "matrimony") {
      const matrimonyListings = await MatrimonyListing.find(query)
        .populate("user", "firstName lastName email")
        .sort({ createdAt: -1 })
        .skip(type === "all" ? 0 : skip)
        .limit(type === "all" ? 0 : limit)

      const matrimonyCount = await MatrimonyListing.countDocuments(query)

      listings = [
        ...listings,
        ...matrimonyListings.map((listing) => ({
          ...listing._doc,
          listingType: "matrimony",
        })),
      ]

      totalListings += matrimonyCount
    }

    // If we're getting all types, we need to sort and paginate the combined results
    if (type === "all") {
      listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      listings = listings.slice(skip, skip + limit)
    }

    const totalPages = Math.ceil(totalListings / limit)

    res.status(200).json({
      success: true,
      data: listings,
      page,
      totalPages,
      totalListings,
    })
  } catch (error) {
    console.error("Error in getListingsForModeration:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Approve or reject a listing
exports.approveRejectListing = async (req, res) => {
  try {
    const { listingId, listingType, action } = req.body

    if (!listingId || !listingType || !action) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      })
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
    }

    let Model
    switch (listingType) {
      case "product":
        Model = ProductListing
        break
      case "service":
        Model = ServiceListing
        break
      case "job":
        Model = JobListing
        break
      case "matrimony":
        Model = MatrimonyListing
        break
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid listing type",
        })
    }

    const listing = await Model.findById(listingId).populate("user", "email")

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      })
    }

    listing.status = action === "approve" ? "active" : "rejected"
    await listing.save()

    // Create notification for the user
    await Notification.create({
      recipient: listing.user._id,
      type: "listing_moderation",
      title: `Your ${listingType} listing has been ${action === "approve" ? "approved" : "rejected"}`,
      message: `Your listing "${listing.title || listing.jobTitle}" has been ${action === "approve" ? "approved" : "rejected"} by a moderator.`,
      relatedModel: listingType,
      relatedId: listing._id,
    })

    res.status(200).json({
      success: true,
      message: `Listing ${action === "approve" ? "approved" : "rejected"} successfully`,
    })
  } catch (error) {
    const { action } = req.body
    console.error(`Error in ${action}Listing:`, error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Bulk approve or reject listings
exports.bulkApproveRejectListings = async (req, res) => {
  try {
    const { listingIds, action } = req.body

    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0 || !action) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      })
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
    }

    const results = {
      success: [],
      failed: [],
    }

    // Process each listing
    for (const item of listingIds) {
      try {
        const { id, type } = item

        let Model
        switch (type) {
          case "product":
            Model = ProductListing
            break
          case "service":
            Model = ServiceListing
            break
          case "job":
            Model = JobListing
            break
          case "matrimony":
            Model = MatrimonyListing
            break
          default:
            results.failed.push({ id, type, error: "Invalid listing type" })
            continue
        }

        const listing = await Model.findById(id).populate("user", "email")

        if (!listing) {
          results.failed.push({ id, type, error: "Listing not found" })
          continue
        }

        listing.status = action === "approve" ? "active" : "rejected"
        await listing.save()

        // Create notification for the user
        await Notification.create({
          recipient: listing.user._id,
          type: "listing_moderation",
          title: `Your ${type} listing has been ${action === "approve" ? "approved" : "rejected"}`,
          message: `Your listing "${listing.title || listing.jobTitle}" has been ${action === "approve" ? "approved" : "rejected"} by a moderator.`,
          relatedModel: type,
          relatedId: listing._id,
        })

        results.success.push({ id, type })
      } catch (error) {
        console.error(`Error processing listing ${item.id}:`, error)
        results.failed.push({ id: item.id, type: item.type, error: error.message })
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk ${action} completed`,
      results,
    })
  } catch (error) {
    console.error(`Error in bulkApproveRejectListings:`, error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Get users for moderation
exports.getUsersForModeration = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit
    const status = req.query.status || "pending"

    const query = { status: status }

    const users = await User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)

    const totalUsers = await User.countDocuments(query)
    const totalPages = Math.ceil(totalUsers / limit)

    res.status(200).json({
      success: true,
      data: users,
      page,
      totalPages,
      totalUsers,
    })
  } catch (error) {
    console.error("Error in getUsersForModeration:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Approve or reject a user
exports.approveRejectUser = async (req, res) => {
  try {
    const { userId, action } = req.body

    if (!userId || !action) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      })
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
    }

    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    user.status = action === "approve" ? "active" : "inactive"
    await user.save()

    // Create notification for the user
    await Notification.create({
      recipient: user._id,
      type: "account_moderation",
      title: `Your account has been ${action === "approve" ? "approved" : "rejected"}`,
      message: `Your account has been ${action === "approve" ? "approved" : "rejected"} by a moderator.`,
      relatedModel: "user",
      relatedId: user._id,
    })

    res.status(200).json({
      success: true,
      message: `User ${action === "approve" ? "approved" : "rejected"} successfully`,
    })
  } catch (error) {
    console.error(`Error in approveRejectUser:`, error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Bulk approve or reject users
exports.bulkApproveRejectUsers = async (req, res) => {
  try {
    const { userIds, action } = req.body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !action) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      })
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
    }

    const results = {
      success: [],
      failed: [],
    }

    // Process each user
    for (const userId of userIds) {
      try {
        const user = await User.findById(userId)

        if (!user) {
          results.failed.push({ id: userId, error: "User not found" })
          continue
        }

        user.status = action === "approve" ? "active" : "inactive"
        await user.save()

        // Create notification for the user
        await Notification.create({
          recipient: user._id,
          type: "account_moderation",
          title: `Your account has been ${action === "approve" ? "approved" : "rejected"}`,
          message: `Your account has been ${action === "approve" ? "approved" : "rejected"} by a moderator.`,
          relatedModel: "user",
          relatedId: user._id,
        })

        results.success.push({ id: userId })
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error)
        results.failed.push({ id: userId, error: error.message })
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk ${action} completed`,
      results,
    })
  } catch (error) {
    console.error(`Error in bulkApproveRejectUsers:`, error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Get interests for moderation
exports.getInterestsForModeration = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit
    const status = req.query.status || "pending"

    const query = { status: status }

    const interests = await Interest.find(query)
      .populate("sender", "firstName lastName email")
      .populate("receiver", "firstName lastName email")
      .populate({
        path: "listing",
        select: "title jobTitle",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const totalInterests = await Interest.countDocuments(query)
    const totalPages = Math.ceil(totalInterests / limit)

    res.status(200).json({
      success: true,
      data: interests,
      page,
      totalPages,
      totalInterests,
    })
  } catch (error) {
    console.error("Error in getInterestsForModeration:", error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Approve or reject an interest
exports.approveRejectInterest = async (req, res) => {
  try {
    const { interestId, action } = req.body

    if (!interestId || !action) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      })
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
    }

    const interest = await Interest.findById(interestId)
      .populate("sender", "email")
      .populate("receiver", "email")
      .populate({
        path: "listing",
        select: "title jobTitle",
      })

    if (!interest) {
      return res.status(404).json({
        success: false,
        message: "Interest not found",
      })
    }

    interest.status = action === "approve" ? "approved" : "rejected"
    await interest.save()

    // Create notification for both sender and receiver
    await Notification.create({
      recipient: interest.sender._id,
      type: "interest_moderation",
      title: `Your interest has been ${action === "approve" ? "approved" : "rejected"}`,
      message: `Your interest in "${interest.listing?.title || interest.listing?.jobTitle}" has been ${action === "approve" ? "approved" : "rejected"} by a moderator.`,
      relatedModel: "interest",
      relatedId: interest._id,
    })

    if (action === "approve") {
      await Notification.create({
        recipient: interest.receiver._id,
        type: "interest_received",
        title: "You have received an interest",
        message: `${interest.sender.firstName} ${interest.sender.lastName} has shown interest in your listing "${interest.listing?.title || interest.listing?.jobTitle}".`,
        relatedModel: "interest",
        relatedId: interest._id,
      })
    }

    res.status(200).json({
      success: true,
      message: `Interest ${action === "approve" ? "approved" : "rejected"} successfully`,
    })
  } catch (error) {
    console.error(`Error in approveRejectInterest:`, error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}

// Bulk approve or reject interests
exports.bulkApproveRejectInterests = async (req, res) => {
  try {
    const { interestIds, action } = req.body

    if (!interestIds || !Array.isArray(interestIds) || interestIds.length === 0 || !action) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
      })
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      })
    }

    const results = {
      success: [],
      failed: [],
    }

    // Process each interest
    for (const interestId of interestIds) {
      try {
        const interest = await Interest.findById(interestId)
          .populate("sender", "firstName lastName email")
          .populate("receiver", "email")
          .populate({
            path: "listing",
            select: "title jobTitle",
          })

        if (!interest) {
          results.failed.push({ id: interestId, error: "Interest not found" })
          continue
        }

        interest.status = action === "approve" ? "approved" : "rejected"
        await interest.save()

        // Create notification for both sender and receiver
        await Notification.create({
          recipient: interest.sender._id,
          type: "interest_moderation",
          title: `Your interest has been ${action === "approve" ? "approved" : "rejected"}`,
          message: `Your interest in "${interest.listing?.title || interest.listing?.jobTitle}" has been ${action === "approve" ? "approved" : "rejected"} by a moderator.`,
          relatedModel: "interest",
          relatedId: interest._id,
        })

        if (action === "approve") {
          await Notification.create({
            recipient: interest.receiver._id,
            type: "interest_received",
            title: "You have received an interest",
            message: `${interest.sender.firstName} ${interest.sender.lastName} has shown interest in your listing "${interest.listing?.title || interest.listing?.jobTitle}".`,
            relatedModel: "interest",
            relatedId: interest._id,
          })
        }

        results.success.push({ id: interestId })
      } catch (error) {
        console.error(`Error processing interest ${interestId}:`, error)
        results.failed.push({ id: interestId, error: error.message })
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk ${action} completed`,
      results,
    })
  } catch (error) {
    console.error(`Error in bulkApproveRejectInterests:`, error)
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    })
  }
}
