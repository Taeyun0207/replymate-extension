const express = require("express");
const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai");
const { PLAN_LIMITS } = require("./src/config/plans");

const app = express();
const PORT = process.env.PORT || 3000;
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

// In-memory usage tracking (in production, use a database)
const userUsage = new Map(); // userId -> { plan, used, lastReset }

// Helper function to get or create user usage record
function getUserUsage(userId) {
  if (!userUsage.has(userId)) {
    userUsage.set(userId, {
      plan: 'free', // Default to free plan
      used: 0,
      lastReset: new Date().toISOString()
    });
  }
  return userUsage.get(userId);
}

// Helper function to check if user has exceeded their limit
function checkUsageLimit(userId) {
  const usage = getUserUsage(userId);
  const limit = PLAN_LIMITS[usage.plan] || PLAN_LIMITS.free;
  return {
    canProceed: usage.used < limit,
    remaining: Math.max(0, limit - usage.used),
    used: usage.used,
    limit: limit,
    plan: usage.plan
  };
}

// Helper function to record usage
function recordUsage(userId) {
  const usage = getUserUsage(userId);
  usage.used += 1;
  userUsage.set(userId, usage);
}

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("ReplyMate backend is running.");
});

// Get current usage
app.get("/usage", (req, res) => {
  const userId = req.headers['x-user-id'] || 'default_user';
  const usage = checkUsageLimit(userId);
  res.json(usage);
});

// Change user plan
app.post("/plan", (req, res) => {
  const userId = req.headers['x-user-id'] || 'default_user';
  const { plan } = req.body;
  
  if (!PLAN_LIMITS.hasOwnProperty(plan)) {
    return res.status(400).json({ error: "Invalid plan" });
  }
  
  const usage = getUserUsage(userId);
  usage.plan = plan;
  usage.used = 0; // Reset usage when changing plans
  usage.lastReset = new Date().toISOString();
  userUsage.set(userId, usage);
  
  res.json({ 
    plan: usage.plan,
    limit: PLAN_LIMITS[plan],
    used: 0,
    remaining: PLAN_LIMITS[plan]
  });
});

app.post("/generate-reply", async (req, res) => {
    try {
      // Get user ID (in production, use authentication)
      const userId = req.headers['x-user-id'] || 'default_user';
      
      // Check usage limits
      const usageCheck = checkUsageLimit(userId);
      if (!usageCheck.canProceed) {
        return res.status(403).json({
          error: "usage_limit_exceeded",
          remaining: usageCheck.remaining
        });
      }

      const {
        subject,
        latestMessage,
        previousMessages,
        recipientName,
        userName,
        inferredUserName,
        tone,
        lengthInstruction,
        additionalInstruction,
      } = req.body;
  
      console.log("Incoming request:");
      console.log(req.body);
  
      const previousThreadText =
        Array.isArray(previousMessages) && previousMessages.length > 0
          ? previousMessages.join("\n\n")
          : "No previous messages.";
  
      // Generate tone-specific instructions
      let toneInstructions = "";
      switch ((tone || "").toLowerCase()) {
        case "professional":
          toneInstructions = "Write in a professional tone. Use formal language, proper business etiquette, and maintain a respectful, polished manner.";
          break;
        case "friendly":
          toneInstructions = "Write in a friendly, warm tone. Use conversational language, express warmth, and maintain a positive, approachable manner.";
          break;
        case "direct":
          toneInstructions = "Write in a direct, concise tone. Be practical and efficient with minimal padding. Focus on clarity and brevity while remaining polite. Avoid unnecessary small talk and get straight to the point.";
          break;
        default: // polite
          toneInstructions = "Write in a polite, balanced tone. Be courteous and respectful while maintaining natural warmth and professionalism.";
      }

      const prompt = `
  You are an AI assistant for ReplyMate, a Gmail reply generator.
  
  Write an email reply.
  
  Context:
  - Email subject: ${subject || ""}
  - Recipient name: ${recipientName || "there"}
  - Sender name: ${userName || ""}
  
  Previous thread:
  ${previousThreadText}
  
  Latest message:
  ${latestMessage || ""}
  
  Instructions:
  - Write only the email body.
  - Do not include a subject line.
  - ${toneInstructions}
  - ${lengthInstruction || "Keep the reply length appropriate for the message."}
  ${additionalInstruction ? `- Additional instruction: ${additionalInstruction}` : ""}
  - If recipient name is known, use it naturally.
  - End with an appropriate closing using the sender name if available.
  `;
  
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You generate polished email replies for Gmail users.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
      });
  
      const reply = completion.choices?.[0]?.message?.content?.trim();
  
      if (!reply) {
        return res.status(500).json({
          error: "OpenAI returned an empty reply.",
        });
      }

      // Record successful usage
      recordUsage(userId);
      
      // Get updated usage info
      const updatedUsage = checkUsageLimit(userId);

      res.json({ 
        reply,
        usage: {
          plan: updatedUsage.plan,
          used: updatedUsage.used,
          limit: updatedUsage.limit,
          remaining: updatedUsage.remaining
        }
      });
    } catch (error) {
      console.error("OpenAI generation error:", error);
  
      res.status(500).json({
        error: "Failed to generate AI reply.",
      });
    }
  });

app.listen(PORT, () => {
  console.log(`ReplyMate API running on port ${PORT}`);
});