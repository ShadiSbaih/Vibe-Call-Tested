import { generateStreamToken } from "../lib/stream.js";

export async function getStreamToken(req, res) {
  try {
    const token = await generateStreamToken(req.user.id);
    res.status(200).json({ token });
  } catch (error) {
    console.log(error.message);
    return res
      .status(500)
      .json({
        message: "Internal server error- unable to get stream token",
        err: error.message,
      });
  }
}
