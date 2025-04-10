const ProductListing = require("../models/ProductListing")
const ServiceListing = require("../models/ServiceListing")
const JobListing = require("../models/JobListing")
const MatrimonyListing = require("../models/MatrimonyListing")
const express = require("express")

// Mapping of listing types to their respective models
const ListingModels = {
  product: ProductListing,
  service: ServiceListing,
  job: JobListing,
  matrimony: MatrimonyListing,
}

// @desc    Create a new listing
// @route   POST /api/listings/:type
exports.createListing = async (req, res) => {
  try {
    const { type } = req.params;
    const listingModel = ListingModels[type];

    if (!listingModel) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing type",
      });
    }

    // Handle file uploads if any
    const documents = req.files?.map(file => file.path) || [];

    // Create listing data
    const listingData = {
      ...req.body,
      user: req.user.id,
      status: "pending",
      documents // Add uploaded documents
    };

    const listing = new listingModel(listingData);
    await listing.save();

    // Create notification
    const Notification = require("../models/Notification");
    await Notification.createNotification({
      user: req.user.id,
      type: "listing_created",
      content: `Your ${type} listing has been created and is pending approval`,
      relatedEntity: {
        entityId: listing._id,
        type: "Listing",
      },
    });

    res.status(201).json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error("Error creating listing:", error);
    res.status(500).json({
      success: false,
      message: "Error creating listing",
      error: error.message,
    });
  }
};

// @desc    Get all listings of a specific type
// @route   GET /api/listings/:type
exports.getListings = async (req, res) => {
  try {
    const { type } = req.params
    const listingModel = ListingModels[type]

    if (!listingModel) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing type",
      })
    }

    // Pagination
    const page = Number.parseInt(req.query.page) || 1
    const limit = Number.parseInt(req.query.limit) || 10
    const skipIndex = (page - 1) * limit

    // Filtering
    const filters = {}
    if (req.query.status) filters.status = req.query.status

    // Sorting
    const sortOptions = { createdAt: -1 } // Default sort by newest first
    if (req.query.sortBy) {
      const [field, order] = req.query.sortBy.split(":")
      sortOptions[field] = order === "desc" ? -1 : 1
    }

    // Search
    const searchQuery = req.query.search
      ? {
          $or: [
            { title: { $regex: req.query.search, $options: "i" } },
            { description: { $regex: req.query.search, $options: "i" } },
          ],
        }
      : {}

    // Combine all filters
    const query = {
      ...filters,
      ...searchQuery,
    }

    // Execute query
    const totalListings = await listingModel.countDocuments(query)

    const listings = await listingModel
      .find(query)
      .sort(sortOptions)
      .limit(limit)
      .skip(skipIndex)
      .populate("user", "username email")

    res.status(200).json({
      success: true,
      count: listings.length,
      totalListings,
      totalPages: Math.ceil(totalListings / limit),
      currentPage: page,
      data: listings,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching listings",
      error: error.message,
    })
  }
}
// @desc    Get single listing by ID
// @route   GET /api/listings/:type/:id
exports.getSingleListing = async (req, res) => {
  try {
    const { type, id } = req.params
    const listingModel = ListingModels[type]

    if (!listingModel) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing type",
      })
    }

    const listing = await listingModel.findById(id).populate("user", "username email")

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      })
    }
console.log("Listing data-->",listing);

    res.status(200).json({
      success: true,
      data: listing,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching listing",
      error: error.message,
    })
  }
}

// @desc    Update a listing
// @route   PUT /api/listings/:type/:id
exports.updateListing = async (req, res) => {
  try {
    const { type, id } = req.params
    const listingModel = ListingModels[type]

    if (!listingModel) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing type",
      })
    }

    // Find the listing and ensure the user owns it
    const listing = await listingModel.findOne({
      _id: id,
      user: req.user.id,
    })

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you are not authorized to update it",
      })
    }

    // Remove fields that cannot be updated
    const updateFields = { ...req.body }
    delete updateFields.user
    delete updateFields.createdAt
    delete updateFields.status

    // Update the listing
    const updatedListing = await listingModel.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: true,
    })

    res.status(200).json({
      success: true,
      data: updatedListing,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating listing",
      error: error.message,
    })
  }
}

// @desc    Delete a listing
// @route   DELETE /api/listings/:type/:id
exports.deleteListing = async (req, res) => {
  try {
    const { type, id } = req.params
    const listingModel = ListingModels[type]

    if (!listingModel) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing type",
      })
    }

    // Find the listing and ensure the user owns it
    const listing = await listingModel.findOne({
      _id: id,
      user: req.user.id,
    })

    if (!listing) {
      return res.status(404).json({
        success: false,
        message: "Listing not found or you are not authorized to delete it",
      })
    }

    // Soft delete by updating status
    listing.status = "inactive"
    await listing.save()

    res.status(200).json({
      success: true,
      message: "Listing successfully marked as inactive",
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting listing",
      error: error.message,
    })
  }
}

// @desc    Get all listings of My own
// @route   GET /api/listings/my-listings
exports.getMyListings = async (req, res) => {
  try {
    const userId = req.user.id

    // Fetch listings from all models
    const listingPromises = Object.values(ListingModels).map((model) =>
      model.find({ user: userId }).populate("user", "username email"),
    )

    const results = await Promise.all(listingPromises)

    // Organize listings by type
    const userListings = {}
    Object.keys(ListingModels).forEach((key, index) => {
      userListings[key] = results[index]
    })

    res.status(200).json({
      success: true,
      data: userListings,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching user listings",
      error: error.message,
    })
  }
}

// @desc    Search across all listing types
// @route   GET /api/listings/search
exports.searchListings = async (req, res) => {
  try {
    const { query, type } = req.query

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      })
    }

    // If specific type is provided, search only that type
    if (type && !ListingModels[type]) {
      return res.status(400).json({
        success: false,
        message: "Invalid listing type",
      })
    }

    // Perform search
    const searchResults = {}
    const searchPromises = type
      ? [
          ListingModels[type].find({
            $or: [{ title: { $regex: query, $options: "i" } }, { description: { $regex: query, $options: "i" } }],
          }),
        ]
      : Object.values(ListingModels).map((model) =>
          model.find({
            $or: [{ title: { $regex: query, $options: "i" } }, { description: { $regex: query, $options: "i" } }],
          }),
        )

    const results = await Promise.all(searchPromises)

    // Organize results
    Object.keys(ListingModels).forEach((key, index) => {
      searchResults[key] = results[type ? 0 : index]
    })

    res.status(200).json({
      success: true,
      data: type ? searchResults[type] : searchResults,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error searching listings",
      error: error.message,
    })
  }
}

