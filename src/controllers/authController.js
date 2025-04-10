const User = require("../models/User")
const { generateToken } = require("../middleware/authMiddleware")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail", // Or your preferred email service
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS,
  },
})

// @desc    Register new user
// @route   POST /api/auth/register

exports.registerUser = async (req, res) => {
  const { firstName, lastName, email, phoneNumber, gender, pincode, state, city, password, confirmPassword } =
    req.body

    console.log(req.body) 
  if (!firstName || !lastName || !email || !phoneNumber || !gender || !pincode || !state || !city || !password || !confirmPassword) {
      return res.status(400).json({
          success: false,
          message: "All fields are required.",
          error: error.message
      });
  }

  try {
    // Check if user already exists
    const userExists = await User.findOne({
      $or: [{ email }, { phoneNumber }],
    })

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User with this email, phone number, or username already exists.",
      })
    }

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      })
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create new user
    const user = new User({
      firstName,
      lastName,
      email,
      phoneNumber,
      gender,
      pincode,
      state,
      city,
      password: hashedPassword,
      confirmPassword: hashedPassword,
      role: "user",
    })
console.log(user)
    // Generate OTP
    const otp = user.generateOTP()
    await user.save()

    res.status(201).json({
      success: true,
      message: "User registered. Check your email for OTP verification.",
      userId: user._id,
      otp: otp,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: error.message,
    })
  }
}

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
  const { userId, otp } = req.body

  try {
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Verify OTP
    const isValid = user.verifyOTP(otp)

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      })
    }

    // Generate JWT token
    const token = generateToken(user._id)

    res.status(200).json({
      success: true,
      message: "Account verified successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during OTP verification",
      error: error.message,
    })
  }
}

// @desc    Login user
// @route   POST /api/auth/login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body

  try {
    // Find user by email
    const user = await User.findOne({ email })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email",
      })
    }

    // Check password
    const isMatch = () => {
      return bcrypt.compare(password, user.password)
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      })
    }

    // Check if user is verified
    if (user.isVerified) {
      // Regenerate OTP
      const otp = user.generateOTP()
      await user.save()

      // Send OTP via email
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Verify Your Account",
        text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
      })

      return res.status(403).json({
        success: false,
        message: "Account not verified. OTP sent to email.",
        userId: user._id,
      })
    }

    // Generate token
    const token = generateToken(user._id)

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error during login",
      error: error.message,
    })
  }
}

// @desc    Get user profile
// @route   GET /api/auth/profile
exports.getUserProfile = async (req, res) => {
  try {
    // req.user is set by protect middleware
    const user = await User.findById(req.user.id).select("-password")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.status(200).json({
      success: true,
      user,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: error.message,
    })
  }
}

// @desc    Update user profile
// @route   PUT /api/auth/profile
exports.updateUserProfile = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, address } = req.body

    const user = await User.findById(req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Update profile fields
    user.profile = {
      firstName: firstName || user.profile.firstName,
      lastName: lastName || user.profile.lastName,
      phoneNumber: phoneNumber || user.profile.phoneNumber,
      address: address || user.profile.address,
    }

    await user.save()

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        profile: user.profile,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error updating profile",
      error: error.message,
    })
  }
}

