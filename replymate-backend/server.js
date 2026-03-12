const express = require("express");
const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai");
const { PLAN_LIMITS } = require("./src/config/plans");
const { getUser, updateUserPlan, recordUsage } = require("./src/database");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

// Helper function to check if user has exceeded their limit
async function checkUsageLimit(userId) {
  try {
    const usage = await getUser(userId);
    const limit = PLAN_LIMITS[usage.plan] || PLAN_LIMITS.free;
    return {
      proceed: usage.used < limit,
      remaining: Math.max(0, limit - usage.used),
      used: usage.used,
      limit: limit,
      plan: usage.plan
    };
  } catch (error) {
    console.error('Error checking usage limit:', error);
    // Fallback to free plan limits
    return {
      proceed: false,
      remaining: 0,
      used: 0,
      limit: PLAN_LIMITS.free,
      plan: 'free'
    };
  }
}

app.use(cors());

// Stripe webhook handler - MUST be defined before express.json()
app.post("/stripe/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    try {
      const { userId, targetPlan } = session.metadata;
      
      if (!userId || !targetPlan) {
        console.error("Missing metadata in checkout session:", session.id);
        return res.status(400).json({ error: "Missing required metadata" });
      }

      // Validate target plan
      if (!['pro', 'pro_plus'].includes(targetPlan)) {
        console.error("Invalid target plan in metadata:", targetPlan);
        return res.status(400).json({ error: "Invalid target plan" });
      }

      // Update user plan in database
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;
      
      await updateUserPlan(userId, targetPlan, stripeCustomerId, stripeSubscriptionId);

      console.log(`[Stripe] User ${userId} upgraded to ${targetPlan}`);
      console.log(`[Stripe] Subscription completed:`, {
        sessionId: session.id,
        userId: userId,
        targetPlan: targetPlan,
        customerEmail: session.customer_email,
        subscriptionId: session.subscription,
        stripeCustomerId: stripeCustomerId
      });

    } catch (error) {
      console.error("Error processing checkout.session.completed:", error);
      return res.status(500).json({ error: "Failed to process webhook" });
    }
  }

  // Return 200 OK response
  res.status(200).json({ received: true });
});

// Apply JSON parser to all other routes
app.use(express.json());

app.get("/", (req, res) => {
  res.send("ReplyMate backend is running.");
});

// Get current usage
app.get("/usage", async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'default_user';
    const usage = await checkUsageLimit(userId);
    res.json(usage);
  } catch (error) {
    console.error('Error getting usage:', error);
    res.status(500).json({ error: "Failed to get usage" });
  }
});

app.post("/generate-reply", async (req, res) => {
    try {
      // Get user ID (in production, use authentication)
      const userId = req.headers["x-user-id"] || 'default_user';
      
      // Debug logging
      console.log("[DEBUG] userId:", userId);
      
      // Check usage limits
      const usageCheck = await checkUsageLimit(userId);
      console.log("[DEBUG] usageCheck:", usageCheck);
      
      if (!usageCheck.proceed) {
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
      await recordUsage(userId);
      
      // Get updated usage info
      const updatedUsage = await checkUsageLimit(userId);

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

// Create Stripe checkout session
app.post("/billing/create-checkout-session", async (req, res) => {
  try {
    const { targetPlan } = req.body;
    const userId = req.headers['x-user-id'] || 'default_user';
    const userEmail = req.headers['x-user-email'] || null;

    // Validate target plan
    if (!targetPlan || !['pro', 'pro_plus'].includes(targetPlan)) {
      return res.status(400).json({ 
        error: "Invalid plan. Must be 'pro' or 'pro_plus'" 
      });
    }

    // Get price ID from environment variables
    const priceId = targetPlan === 'pro' 
      ? process.env.STRIPE_PRICE_PRO 
      : process.env.STRIPE_PRICE_PRO_PLUS;

    if (!priceId) {
      return res.status(500).json({ 
        error: "Price ID not configured for the selected plan" 
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${req.protocol}://${req.get('host')}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/billing/cancel`,
      metadata: {
        userId: userId,
        targetPlan: targetPlan,
        ...(userEmail && { userEmail: userEmail })
      },
      customer_email: userEmail || undefined,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    res.json({
      checkoutUrl: session.url
    });

  } catch (error) {
    console.error("Stripe checkout session error:", error);
    res.status(500).json({ 
      error: "Failed to create checkout session" 
    });
  }
});

app.listen(PORT, () => {
  console.log(`ReplyMate API running on port ${PORT}`);
});