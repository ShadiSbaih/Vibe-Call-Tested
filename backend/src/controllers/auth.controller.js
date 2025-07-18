import { upsertStreamUser } from "../lib/stream.js";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

export async function signUp(req, res) {
  const { email, password, fullName } = req.body;

  try {
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const idx = Math.floor(Math.random() * 100) + 1;

    let randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

    const newUser = await User({
      email,
      password,
      fullName,
      profilePicture: randomAvatar,
    });

    await newUser.save();

    // Create a Stream user
    try {
      await upsertStreamUser({
        id: newUser._id.toString(),
        name: newUser.fullName,
        image: newUser.profilePicture || "",
      });
      console.log("Stream user created  successfully:", newUser.fullName)
    } catch (error) {
      console.error("Error creating Stream user:", error);
      return res.status(500).json({ message: "Internal server error (creating stream user)" });
    }


    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET_KEY,
      {
        expiresIn: "72h"
      }
    );

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true, //Prevents XSS attacks by not allowing client-side JavaScript to access the cookie
      sameSite: "strict", // CSRF protection
      secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS in production
    });

    return res.status(201).json({ success: true, user: newUser, message: "User created successfully" });

  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function login(req, res) {
  try {

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_KEY,
      {
        expiresIn: "72h"
      }
    );

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      httpOnly: true, //Prevents XSS attacks by not allowing client-side JavaScript to access the cookie
      sameSite: "strict", // CSRF protection
      secure: process.env.NODE_ENV === "production", // Only send cookie over HTTPS in production
    });

    res.status(200).json({ success: true, message: "User Logged In Successfully!", user })
  }
  catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export async function logout(req, res) {
  res.clearCookie("jwt");
  res.status(200).json({ success: true, message: "Logged out successfully" });
}

export async function onboard(req, res) {
  console.log(req.user);
  try {
    const userId = req.user._id;

    const { fullName, bio, learningLanguage, nativeLanguage, location } = req.body;
    // Validate required fields
    if (!fullName || !bio || !learningLanguage || !nativeLanguage || !location) {
      return res.status(400).json({
        message: "All fields are required",
        missingFields: [
          !fullName && "fullName",
          !bio && "bio",
          !learningLanguage && "learningLanguage",
          !nativeLanguage && "nativeLanguage",
          !location && "location",
        ].filter(Boolean),
        // This will filter out any false values and only return the missing fields
      });
    }
    // Check if the user is already onboarded
    const updatedUser = await User.findByIdAndUpdate(userId, {
      ...req.body,
      isOnboarded: true,
    }, { new: true });
    // Check if the user was found and updated
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    try {
      // Update the Stream user
      await upsertStreamUser({
        id: updatedUser._id.toString(),
        name: updatedUser.fullName,
        image: updatedUser.profilePicture || "",
      });
    } catch (error) {
      console.error("Error updating Stream user after boarding :", error.message);
      return res.status(500).json({ message: "Internal server Error => updating Stream user after boarding" });
    }
   
    res.status(200).json({ success: true, user: updatedUser, message: "User onboarded successfully" });
  } catch (error) {
    console.error("Error in onboarding:", error);
    return res.status(500).json({ message: "Internal server error" });

  }
}