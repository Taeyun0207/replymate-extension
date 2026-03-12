const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, '../../replymate.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DB] Error opening database:', err.message);
  } else {
    console.log('[DB] Connected to SQLite database.');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      userId TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'free',
      used INTEGER NOT NULL DEFAULT 0,
      billingCycleStart TEXT NOT NULL,
      nextResetAt TEXT NOT NULL,
      stripeCustomerId TEXT,
      stripeSubscriptionId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('[DB] Error creating users table:', err.message);
    } else {
      console.log('[DB] Users table created successfully.');
    }
  });
}

// Get or create user record
function getUser(userId) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    // First try to get existing user
    db.get(
      'SELECT * FROM users WHERE userId = ?',
      [userId],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (row) {
          // Check if monthly reset is needed
          const nowTime = new Date();
          const nextResetTime = new Date(row.nextResetAt);
          
          if (nowTime >= nextResetTime) {
            // Reset usage and update billing cycle
            const newCycleStart = nowTime.toISOString();
            const nextReset = new Date(nowTime.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString();
            
            console.log('[DB] Monthly reset triggered for user:', userId);
            db.run(
              `UPDATE users 
               SET used = 0, 
                   billingCycleStart = ?, 
                   nextResetAt = ?,
                   updatedAt = ?
               WHERE userId = ?`,
              [newCycleStart, nextReset, now, userId],
              (updateErr) => {
                if (updateErr) {
                  reject(updateErr);
                  return;
                }
                
                // Return updated user data
                resolve({
                  ...row,
                  used: 0,
                  billingCycleStart: newCycleStart,
                  nextResetAt: nextReset,
                  updatedAt: now
                });
              }
            );
          } else {
            // Return existing user data
            resolve(row);
          }
        } else {
          // Create new user
          const nextReset = new Date(new Date().getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString();
          
          db.run(
            `INSERT INTO users 
             (userId, plan, used, billingCycleStart, nextResetAt, createdAt, updatedAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, 'free', 0, now, nextReset, now, now],
            (insertErr) => {
              if (insertErr) {
                reject(insertErr);
                return;
              }
              
              console.log('[DB] User created:', userId);
              // Return new user data
              resolve({
                userId,
                plan: 'free',
                used: 0,
                billingCycleStart: now,
                nextResetAt: nextReset,
                stripeCustomerId: null,
                stripeSubscriptionId: null,
                createdAt: now,
                updatedAt: now
              });
            }
          );
        }
      }
    );
  });
}

// Update user plan (for upgrades)
function updateUserPlan(userId, plan, stripeCustomerId = null, stripeSubscriptionId = null) {
  return new Promise((resolve, reject) => {
    // First ensure user exists
    getUser(userId)
      .then(existingUser => {
        const now = new Date().toISOString();
        const nextReset = new Date(new Date().getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString();
        
        if (existingUser) {
          // Update existing user
          console.log('[DB] Updating existing user plan:', userId, 'to:', plan);
          db.run(
            `UPDATE users 
             SET plan = ?, 
                 used = 0, 
                 billingCycleStart = ?, 
                 nextResetAt = ?,
                 stripeCustomerId = COALESCE(?, stripeCustomerId),
                 stripeSubscriptionId = COALESCE(?, stripeSubscriptionId),
                 updatedAt = ?
             WHERE userId = ?`,
            [plan, now, nextReset, stripeCustomerId, stripeSubscriptionId, now, userId],
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve({
                  userId,
                  plan,
                  used: 0,
                  billingCycleStart: now,
                  nextResetAt: nextReset,
                  stripeCustomerId,
                  stripeSubscriptionId,
                  updatedAt: now
                });
              }
            }
          );
        } else {
          // Insert new user with plan (handles case where user never called /usage before upgrade)
          console.log('[DB] Inserting new user with plan:', userId, plan);
          db.run(
            `INSERT INTO users 
             (userId, plan, used, billingCycleStart, nextResetAt, stripeCustomerId, stripeSubscriptionId, createdAt, updatedAt) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, plan, 0, now, nextReset, stripeCustomerId, stripeSubscriptionId, now, now],
            (err) => {
              if (err) {
                reject(err);
              } else {
                resolve({
                  userId,
                  plan,
                  used: 0,
                  billingCycleStart: now,
                  nextResetAt: nextReset,
                  stripeCustomerId,
                  stripeSubscriptionId,
                  createdAt: now,
                  updatedAt: now
                });
              }
            }
          );
        }
      })
      .catch(reject);
  });
}

// Record usage increment
function recordUsage(userId) {
  return new Promise((resolve, reject) => {
    const now = new Date().toISOString();
    
    db.run(
      'UPDATE users SET used = used + 1, updatedAt = ? WHERE userId = ?',
      [now, userId],
      function(err) {
        if (err) {
          reject(err);
        } else {
          console.log('[DB] Usage incremented for user:', userId);
          resolve(this.changes);
        }
      }
    );
  });
}

// Close database connection
function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error('[DB] Error closing database:', err.message);
    } else {
      console.log('[DB] Database connection closed.');
    }
  });
}

module.exports = {
  getUser,
  updateUserPlan,
  recordUsage,
  closeDatabase
};
