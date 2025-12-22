const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const http = require("http");
const os = require("os");
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kgvpymzrtnhwciwgfugo.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || "sb_publishable_ykbR6cyN6de023y3HI9nUQ_8-xiMijQ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Create HTTP server with API endpoints
const PORT = process.env.PORT || 3002;
const server = http.createServer(async (req, res) => {
  // Log all incoming requests for debugging
  const clientIP = req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${clientIP}`);
  console.log(`Headers:`, JSON.stringify(req.headers, null, 2));

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL with error handling
  let pathname = req.url;
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    pathname = url.pathname;
  } catch (urlErr) {
    // If URL parsing fails, try to extract pathname manually
    pathname = req.url.split('?')[0];
    console.log('URL parsing failed, using pathname:', pathname);
  }

  // Health check endpoint
  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "running",
      message: "WhatsApp Bot is running",
      timestamp: new Date().toISOString(),
      endpoints: {
        "POST /send-message": "Send a WhatsApp message to a number",
        "GET /": "Health check",
        "GET /test": "Test endpoint for connectivity"
      }
    }));
    return;
  }

  // Test endpoint for connectivity checks
  if (pathname === '/test' && req.method === 'GET') {
    console.log('Test endpoint hit');
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      success: true,
      message: "Server is reachable",
      timestamp: new Date().toISOString(),
      clientIP: req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown'
    }));
    return;
  }

  // Send message endpoint
  if (pathname === '/send-message' && req.method === 'POST') {
    console.log('POST /send-message request received');
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
      console.log('Received chunk, body length:', body.length);
    });

    req.on('error', (err) => {
      console.error('Request error:', err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: false,
        error: `Request error: ${err.message}`
      }));
    });

    req.on('end', async () => {
      console.log('Request body received, length:', body.length);
      console.log('Request body content:', body);

      try {
        let data;
        if (!body || body.trim() === '') {
          throw new Error('Empty request body');
        }

        try {
          data = JSON.parse(body);
        } catch (parseErr) {
          console.error('JSON parse error:', parseErr);
          console.error('Body that failed to parse:', body);
          throw new Error(`Invalid JSON: ${parseErr.message}`);
        }

        console.log('Parsed data:', JSON.stringify(data, null, 2));
        const { number, message } = data;

        // Validate input
        if (!number || !message) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            error: "Missing required fields: 'number' and 'message' are required"
          }));
          return;
        }

        // Check if client is ready
        if (!isClientReady) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            error: "WhatsApp client is not ready. Please wait for the bot to connect."
          }));
          return;
        }

        // Format number for WhatsApp
        let formattedNumber = String(number).trim();
        if (!formattedNumber.includes('@')) {
          // Remove any non-digit characters
          formattedNumber = formattedNumber.replace(/\D/g, '');
          // Add @s.whatsapp.net suffix
          formattedNumber = `${formattedNumber}@s.whatsapp.net`;
        }

        // Mark that we're about to send a message via API (to prevent outbound API call)
        const responseKey = `${formattedNumber}_${Date.now()}_${Math.random()}`;
        botResponseMessages.set(responseKey, {
          recipientId: formattedNumber,
          messageText: String(message).trim(),
          timestamp: Date.now(),
          source: 'api' // Mark as API-sent message
        });

        // Send the message
        try {
          console.log(`API: Sending message to ${formattedNumber}: ${message}`);
          await client.sendMessage(formattedNumber, String(message).trim());
          console.log(`✓ API: Message sent successfully to ${formattedNumber}`);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            message: "Message sent successfully",
            number: formattedNumber
          }));
        } catch (sendErr) {
          console.error(`API: Error sending message to ${formattedNumber}:`, sendErr.message);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            error: `Failed to send message: ${sendErr.message}`
          }));
        }
      } catch (parseErr) {
        console.error('Error processing request:', parseErr);
        console.error('Error stack:', parseErr.stack);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: false,
          error: `Invalid request: ${parseErr.message}`
        }));
      }
    });

    // Set timeout for request (5 minutes)
    req.setTimeout(300000, () => {
      console.error('Request timeout');
      res.writeHead(408, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: false,
        error: "Request timeout"
      }));
    });


    return;
  }

  // Send image endpoint
  if (pathname === '/send-image' && req.method === 'POST') {
    console.log('POST /send-image request received');
    let body = '';
    const maxBodySize = 10 * 1024 * 1024; // 10MB limit for images

    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > maxBodySize) {
        console.error('Request body too large');
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: false,
          error: "Payload too large. Max 10MB."
        }));
        req.destroy();
      }
    });

    req.on('error', (err) => {
      console.error('Request error:', err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: false,
        error: `Request error: ${err.message}`
      }));
    });

    req.on('end', async () => {
      console.log('Request body received, length:', body.length);

      try {
        let data;
        if (!body || body.trim() === '') {
          throw new Error('Empty request body');
        }

        try {
          data = JSON.parse(body);
        } catch (parseErr) {
          console.error('JSON parse error:', parseErr);
          throw new Error(`Invalid JSON: ${parseErr.message}`);
        }

        const { number, message, image, mimetype } = data;

        // Validate input
        if (!number || !image) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            error: "Missing required fields: 'number' and 'image' (base64) are required"
          }));
          return;
        }

        // Check if client is ready
        if (!isClientReady) {
          res.writeHead(503, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            error: "WhatsApp client is not ready. Please wait for the bot to connect."
          }));
          return;
        }

        // Format number for WhatsApp
        let formattedNumber = String(number).trim();
        if (!formattedNumber.includes('@')) {
          formattedNumber = formattedNumber.replace(/\D/g, '');
          formattedNumber = `${formattedNumber}@s.whatsapp.net`;
        }

        // Parse mimetype or default
        const mime = mimetype || 'image/jpeg';

        // Create media object
        // If the image string has a data URI prefix (data:image/x;base64,), strip it
        let base64Image = image;
        if (base64Image.includes(',')) {
          base64Image = base64Image.split(',')[1];
        }

        const media = new MessageMedia(mime, base64Image);

        // Mark that we're about to send a message via API
        const responseKey = `${formattedNumber}_${Date.now()}_${Math.random()}`;
        botResponseMessages.set(responseKey, {
          recipientId: formattedNumber,
          messageText: String(message || '').trim(), // Caption might be empty
          timestamp: Date.now(),
          source: 'api'
        });

        // Send the message
        try {
          console.log(`API: Sending image to ${formattedNumber}`);
          await client.sendMessage(formattedNumber, media, { caption: message || '' });
          console.log(`✓ API: Image sent successfully to ${formattedNumber}`);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: true,
            message: "Image sent successfully",
            number: formattedNumber
          }));
        } catch (sendErr) {
          console.error(`API: Error sending image to ${formattedNumber}:`, sendErr.message);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            success: false,
            error: `Failed to send image: ${sendErr.message}`
          }));
        }
      } catch (parseErr) {
        console.error('Error processing request:', parseErr);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: false,
          error: `Invalid request: ${parseErr.message}`
        }));
      }
    });

    // Set timeout for request (5 minutes)
    req.setTimeout(300000, () => {
      console.error('Request timeout');
      res.writeHead(408, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        success: false,
        error: "Request timeout"
      }));
    });

    return;
  }

  // 404 for unknown endpoints
  console.log(`404 - Endpoint not found: ${req.method} ${pathname}`);
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    success: false,
    error: `Endpoint not found: ${req.method} ${pathname}`
  }));
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port.`);
  }
});

server.on('clientError', (err, socket) => {
  console.error('Client error:', err);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

// Get hostname for better logging
const networkInterfaces = os.networkInterfaces();
let hostname = 'localhost';
let publicIP = null;

// Try to find a public IP address
for (const interfaceName in networkInterfaces) {
  const interfaces = networkInterfaces[interfaceName];
  for (const iface of interfaces) {
    if (iface.family === 'IPv4' && !iface.internal) {
      publicIP = iface.address;
      break;
    }
  }
  if (publicIP) break;
}

// Listen on all interfaces (0.0.0.0) to accept external connections
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`HTTP server listening on port ${PORT}`);
  console.log(`API endpoint (local): POST http://localhost:${PORT}/send-message`);
  if (publicIP) {
    console.log(`API endpoint (network): POST http://${publicIP}:${PORT}/send-message`);
  }
  console.log(`Server is accessible from all network interfaces (0.0.0.0:${PORT})`);

  // Start tunnel service if enabled
  const useTunnel = process.env.USE_TUNNEL === 'true' || process.env.USE_TUNNEL === '1';
  const tunnelType = process.env.TUNNEL_TYPE || 'localtunnel'; // 'ngrok' or 'localtunnel'

  if (useTunnel) {
    await startTunnel(PORT, tunnelType);
  }
});

// Tunnel service setup
async function startTunnel(port, tunnelType) {
  try {
    if (tunnelType === 'ngrok') {
      await startNgrok(port);
    } else {
      await startLocaltunnel(port);
    }
  } catch (error) {
    console.error('Failed to start tunnel:', error.message);
    console.log('Continuing without tunnel. You can still use local/network IPs.');
  }
}

// Start ngrok tunnel
async function startNgrok(port) {
  try {
    // Check for authtoken
    const authtoken = process.env.NGROK_AUTHTOKEN;
    if (!authtoken) {
      console.error('\n❌ NGROK_AUTHTOKEN not set!');
      console.log('To use ngrok:');
      console.log('1. Sign up at https://ngrok.com (free account)');
      console.log('2. Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken');
      console.log('3. Set environment variable: export NGROK_AUTHTOKEN=your_token_here');
      console.log('4. Or use localtunnel instead: export TUNNEL_TYPE=localtunnel\n');
      throw new Error('NGROK_AUTHTOKEN environment variable is required');
    }

    let publicUrl;

    // Try new @ngrok/ngrok package first
    try {
      const ngrok = require('@ngrok/ngrok');
      console.log('Starting ngrok tunnel with @ngrok/ngrok...');

      // Set authtoken first
      await ngrok.authtoken(authtoken);

      // Start tunnel - try different API methods
      try {
        // Method 1: Using forward with authtoken
        const listener = await ngrok.forward({
          addr: port,
          authtoken: authtoken
        });
        publicUrl = listener.url();
      } catch (forwardError) {
        // Method 2: Using connect
        try {
          await ngrok.connect({
            addr: port,
            authtoken: authtoken
          });
          // Get the listener to get URL
          const listener = await ngrok.forward({ addr: port });
          publicUrl = listener.url();
        } catch (connectError) {
          // Method 3: Try with just port
          const listener = await ngrok.forward({ addr: port });
          publicUrl = listener.url();
        }
      }

    } catch (newNgrokError) {
      // If new package fails, try old ngrok package
      if (newNgrokError.message.includes('Cannot find module')) {
        console.log('Trying alternative ngrok package...');
        try {
          const ngrok = require('ngrok');
          console.log('Starting ngrok tunnel with ngrok package...');

          // Configure authtoken for old package
          await ngrok.authtoken(authtoken);

          // Start tunnel
          publicUrl = await ngrok.connect(port);
        } catch (oldNgrokError) {
          if (oldNgrokError.message.includes('Cannot find module')) {
            console.error('\n❌ ngrok package not found!');
            console.log('Install with: npm install @ngrok/ngrok');
            console.log('Or: npm install ngrok');
            console.log('Or use localtunnel: export TUNNEL_TYPE=localtunnel\n');
            throw oldNgrokError;
          }
          console.error('Old ngrok error:', oldNgrokError.message);
          throw oldNgrokError;
        }
      } else {
        // Re-throw if it's not a module not found error
        console.error('Ngrok error:', newNgrokError.message);
        console.error('Full error:', newNgrokError);
        if (newNgrokError.message.includes('authtoken') || newNgrokError.message.includes('auth') || newNgrokError.message.includes('401') || newNgrokError.message.includes('403')) {
          console.error('\n❌ Invalid or missing NGROK_AUTHTOKEN');
          console.error('Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken');
          console.error('Make sure to export it: export NGROK_AUTHTOKEN=your_token_here\n');
        }
        throw newNgrokError;
      }
    }

    if (!publicUrl) {
      throw new Error('Failed to get ngrok URL');
    }

    console.log('\n========================================');
    console.log('✓ NGROK TUNNEL ACTIVE');
    console.log('========================================');
    console.log(`Public URL: ${publicUrl}`);
    console.log(`API endpoint: POST ${publicUrl}/send-message`);
    console.log(`Test endpoint: GET ${publicUrl}/test`);
    console.log('========================================\n');

    // Store the URL for reference
    process.env.PUBLIC_URL = publicUrl;

    return publicUrl;
  } catch (error) {
    console.error('\n❌ Failed to start ngrok:', error.message);
    console.error('Error details:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Check if NGROK_AUTHTOKEN is set: echo $NGROK_AUTHTOKEN');
    console.log('2. Verify token at: https://dashboard.ngrok.com/get-started/your-authtoken');
    console.log('3. Try localtunnel instead: export TUNNEL_TYPE=localtunnel\n');
    throw error;
  }
}

// Start localtunnel (no signup required)
async function startLocaltunnel(port) {
  try {
    const localtunnel = require('localtunnel');

    console.log('Starting localtunnel...');
    const tunnel = await localtunnel({
      port: port,
      subdomain: process.env.LOCALTUNNEL_SUBDOMAIN // Optional: set a custom subdomain
    });

    const publicUrl = tunnel.url;

    console.log('\n========================================');
    console.log('✓ LOCALTUNNEL ACTIVE');
    console.log('========================================');
    console.log(`Public URL: ${publicUrl}`);
    console.log(`API endpoint: POST ${publicUrl}/send-message`);
    console.log(`Test endpoint: GET ${publicUrl}/test`);
    console.log('========================================\n');

    // Store the URL for reference
    process.env.PUBLIC_URL = publicUrl;

    // Handle tunnel close
    tunnel.on('close', () => {
      console.log('Tunnel closed. Attempting to reconnect...');
      setTimeout(() => startLocaltunnel(port), 5000);
    });

    return publicUrl;
  } catch (error) {
    if (error.message.includes('Cannot find module')) {
      console.error('localtunnel not installed. Run: npm install localtunnel');
      throw error;
    }
    console.error('Localtunnel error:', error.message);
    throw error;
  }
}

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./.wwebjs_auth",
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--window-size=1920,1080',
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
      '--disable-extensions-except',
      '--disable-plugins-discovery',
      '--disable-default-apps'
    ],
    timeout: 120000,
    ignoreHTTPSErrors: true,
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  },
  // Use takeover to prevent auto-logout
  takeoverOnConflict: false,
  takeoverTimeoutMs: 0,
  // Use remote version cache to avoid detection errors
  webVersionCache: {
    type: 'remote',
    remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2413.51.html',
  },
});

const stripJid = (jid) => (jid ? jid.replace(/@.+$/, "") : jid);

// Track outbound messages that are responses from the inbound API or sent via API
// This prevents calling the outbound API for bot-generated responses and API-sent messages
// Key format: "recipientId_messageText_timestamp"
// Value: { recipientId, messageText, timestamp, source: 'api' | 'bot' }
const botResponseMessages = new Map();

client.on("qr", (qr) => {
  console.log("\n========================================");
  console.log("QR CODE GENERATED - SCAN WITH WHATSAPP");
  console.log("========================================\n");
  qrcode.generate(qr, { small: true });
  console.log("\nScan the QR code above with WhatsApp to connect...\n");
});

client.on("loading_screen", (percent, message) => {
  console.log(`Loading: ${percent}% - ${message}`);
});

let isClientReady = false;

client.on("ready", async () => {
  console.log("Client is ready!");
  console.log("Bot is connected and ready to receive messages");
  isClientReady = true;

  // Start broadcast background job
  startBroadcastJob();

  // Add stealth script to hide automation (if page is accessible)
  try {
    // Wait a bit for page to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (client.pupPage) {
      const page = await client.pupPage();
      if (page) {
        await page.evaluateOnNewDocument(() => {
          // Hide webdriver property
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
          });

          // Override plugins
          Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
          });

          // Override languages
          Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
          });

          // Mock chrome object
          window.chrome = {
            runtime: {},
          };
        });
        console.log("Stealth scripts injected successfully");
      }
    }
  } catch (err) {
    // Silently fail - stealth injection is optional
    console.log("Note: Could not inject stealth scripts (this is usually fine)");
  }
});

client.on("disconnected", (reason) => {
  console.log("Client disconnected:", reason);

  // Reset retry count on disconnect
  retryCount = 0;

  // If logged out, need to re-scan QR code
  if (reason === "LOGOUT") {
    console.log("Logged out - WhatsApp may have detected automation");
    console.log("A new QR code will be generated. Please scan it again.");
    // Wait longer before reinitializing to avoid rapid reconnection and give time for cleanup
    setTimeout(() => {
      console.log("Reinitializing after logout (waiting for WhatsApp Web to be ready)...");
      initializeClient();
    }, 15000); // Increased wait time
    return;
  }

  // For other disconnections, try to reconnect
  console.log("Attempting to reconnect...");
  setTimeout(() => {
    initializeClient();
  }, 5000);
});

client.on("auth_failure", (msg) => {
  console.error("Authentication failure:", msg);
  // Clear auth data on failure
  console.log("Clearing authentication data...");
});

client.on("remote_session_saved", () => {
  console.log("Remote session saved successfully");
});

client.on("message_create", async (msg) => {
  console.log("MESSAGE RECEIVED", msg, msg.from, msg.to, msg.body, msg.author);

  // Messages sent by me: forward to API then stop.
  if (msg.id.fromMe) {
    // Check if this is a message sent via API or bot response
    // Match by recipient and message text (within last 30 seconds for API messages, 10 seconds for bot responses)
    const recipientId = msg.to;
    const messageText = msg.body || '';
    const currentTime = Date.now();

    // Check if this matches a recent API-sent message or bot response
    let isApiOrBotMessage = false;
    let matchedSource = null;

    for (const [key, data] of botResponseMessages.entries()) {
      // Check if recipient matches (handle different formats)
      const recipientMatches = data.recipientId === recipientId ||
        data.recipientId.replace('@s.whatsapp.net', '') === recipientId.replace('@s.whatsapp.net', '') ||
        data.recipientId === recipientId.replace('@c.us', '@s.whatsapp.net') ||
        data.recipientId.replace('@s.whatsapp.net', '') === recipientId.replace('@c.us', '');

      // Check if message text matches (exact match or trimmed match)
      const messageMatches = data.messageText === messageText ||
        data.messageText.trim() === messageText.trim();

      // Time window: 30 seconds for API messages, 10 seconds for bot responses
      const timeWindow = data.source === 'api' ? 30000 : 10000;
      const timeMatches = (currentTime - data.timestamp) < timeWindow;

      if (recipientMatches && messageMatches && timeMatches) {
        isApiOrBotMessage = true;
        matchedSource = data.source;
        // Clean up this entry
        botResponseMessages.delete(key);
        break;
      }
    }

    // Clean up old entries (older than 30 seconds)
    for (const [key, data] of botResponseMessages.entries()) {
      if ((currentTime - data.timestamp) > 30000) {
        botResponseMessages.delete(key);
      }
    }

    if (isApiOrBotMessage) {
      console.log(`Skipping outbound API call - this is a ${matchedSource === 'api' ? 'API-sent' : 'bot response'} message`);
      return;
    }

    // This is a direct admin message (not from API, not a bot response)
    console.log("Forwarding direct admin message to API");

    const payload = {
      msg: msg.body,
      from: stripJid(msg.from),
      to: stripJid(msg.to),
      from_name: msg._data?.notifyName,
      direction: "outbound",
    };

    console.log("Forwarding direct admin message payload:", JSON.stringify(payload, null, 2));

    try {
      await axios.post("http://72.60.97.177:5678/webhook/admin-message", payload);
      console.log("Direct admin message forwarded to API");
    } catch (err) {
      console.error("Failed to forward direct admin message", err.message);
    }
    return;
  }

  // if msg.from contains @g.us - its from group , else its from contact
  if (msg.from.includes("@g.us")) {
    console.log("Group message detected - ignoring for API forwarding");
    return;
  } else {
    console.log("Personal message");

    // Manual number replacement
    let senderNumber = stripJid(msg.from);
    if (senderNumber === '122569810260158') {
      senderNumber = '918708577598';
      console.log(`Manually replaced sender number ${msg.from} with ${senderNumber}`);
    }

    const payload = {
      msg: msg.body,
      from: senderNumber,
      to: stripJid(msg.to),
      from_name: msg._data?.notifyName,
      direction: "inbound",
    };

    console.log("Forwarding user message payload:", JSON.stringify(payload, null, 2));

    // Forward all user messages to the API
    try {
      await axios.post("http://72.60.97.177:5678/webhook/custom_wa_bot", payload);
      console.log("User message forwarded to API");
    } catch (err) {
      console.error("Failed to forward user message to API", err.message);
    }
  }
});

// Initialize with error handling and retry logic
let retryCount = 0;
const MAX_RETRIES = 3;
let isInitializing = false;

const initializeClient = async () => {
  if (isInitializing) {
    console.log("Already initializing, skipping...");
    return;
  }

  isInitializing = true;
  try {
    console.log(`Initializing WhatsApp client (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    console.log("This may take a few seconds. Waiting for WhatsApp Web to load...");

    // Add a small delay before initialization to ensure previous session is cleaned up
    if (retryCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log("Starting WhatsApp Web client initialization...");
    await client.initialize();
    retryCount = 0; // Reset on success
    isInitializing = false;
    console.log("✓ Initialization successful! Bot is ready.");
  } catch (error) {
    isInitializing = false;
    retryCount++;
    const errorMsg = error?.message || String(error);
    console.error("Failed to initialize client:", errorMsg);

    // Handle specific error types
    if (errorMsg.includes("VERSION") || errorMsg.includes("Execution context")) {
      console.error("Version detection error - WhatsApp Web may not be fully loaded yet");
      console.error("This often happens on cloud platforms. Will retry with longer delay...");
    }

    if (retryCount >= MAX_RETRIES) {
      console.error("Max retries reached. The bot will stay stopped.");
      console.error("This is often due to WhatsApp detecting automation on cloud platforms.");
      console.error("Consider using a VPS or upgrading to Render paid plan for better compatibility.");
      return; // Don't exit, let the HTTP server keep running
    }

    // Longer wait time for version errors
    const baseWaitTime = errorMsg.includes("VERSION") ? 30000 : 15000;
    const waitTime = Math.min(baseWaitTime * retryCount, 60000); // Max 60s
    console.log(`Retrying in ${waitTime / 1000} seconds...`);
    setTimeout(() => {
      initializeClient();
    }, waitTime);
  }
};

// Add process error handlers
process.on('unhandledRejection', (error) => {
  const errorMsg = error?.message || String(error);
  console.error('Unhandled promise rejection:', errorMsg);

  // If it's a version error, try to reinitialize after a delay
  if (errorMsg.includes('VERSION') || errorMsg.includes('Execution context')) {
    console.log('Version detection error detected. Will retry initialization...');
    setTimeout(() => {
      if (!isInitializing) {
        retryCount = 0; // Reset retry count for version errors
        initializeClient();
      }
    }, 20000); // Wait 20 seconds before retry
  }
  // Don't crash on unhandled rejections, let the bot continue
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error.message);
  // Don't exit, let the HTTP server keep running
});

// Start the bot
initializeClient();

// ==================== BROADCAST MESSAGING FEATURE ====================

/**
 * Fetch all WhatsApp contacts directly from WhatsApp Web
 * @returns {Promise<Array>} Array of contact objects with id and name
 */
const fetchAllWhatsAppContacts = async () => {
  try {
    if (!isClientReady) {
      console.log("Client not ready, cannot fetch contacts");
      return [];
    }

    console.log("Fetching all WhatsApp contacts...");

    // Try method 1: getContacts() - may fail on some WhatsApp Web versions
    let contacts = [];
    try {
      contacts = await client.getContacts();
    } catch (error) {
      console.log("getContacts() failed, trying alternative method...");
      // Fallback: Use chats to get contacts
      try {
        const chats = await client.getChats();
        // Extract unique contacts from chats (excluding groups and self)
        const contactMap = new Map();

        for (const chat of chats) {
          // Skip groups
          if (chat.isGroup) continue;

          const contactId = chat.id._serialized;
          // Skip broadcast lists and self
          if (contactId.includes('@broadcast') || contactId === client.info.wid._serialized) continue;

          // Add to map if not already present
          if (!contactMap.has(contactId)) {
            contactMap.set(contactId, {
              id: { _serialized: contactId },
              pushname: chat.name || chat.contact?.pushname || chat.contact?.name || null,
              name: chat.name || chat.contact?.name || null,
              number: chat.contact?.number || null
            });
          }
        }

        contacts = Array.from(contactMap.values());
        console.log(`Fetched ${contacts.length} contacts from chats`);
      } catch (chatError) {
        console.error("Error fetching contacts from chats:", chatError.message);
        throw chatError;
      }
    }

    // Filter out groups and only get individual contacts
    const individualContacts = contacts.filter(contact => {
      const contactId = contact.id?._serialized || contact.id || '';
      // Exclude groups (they have @g.us in id)
      return !contactId.includes('@g.us') &&
        !contactId.includes('@broadcast') &&
        contactId !== client.info.wid._serialized; // Exclude self
    });

    console.log(`Found ${individualContacts.length} individual contacts`);
    return individualContacts.map(contact => {
      const contactId = contact.id?._serialized || contact.id || '';
      return {
        id: contactId,
        name: contact.pushname || contact.name || contact.number || 'Unknown'
      };
    });
  } catch (error) {
    console.error("Error fetching WhatsApp contacts:", error.message);
    return [];
  }
};

/**
 * Send broadcast message to all contacts
 * @param {string} messageId - Supabase message ID
 * @param {string} message - Message text to send
 */
const sendBroadcastMessage = async (messageId, message) => {
  try {
    console.log(`Starting broadcast for message ID: ${messageId}`);

    // Fetch all WhatsApp contacts
    const contacts = await fetchAllWhatsAppContacts();

    if (contacts.length === 0) {
      console.log("No contacts found to send broadcast");
      await supabase
        .from('broadcast_messages')
        .update({
          status: 'failed',
          error_message: 'No contacts found',
          completed_at: new Date().toISOString()
        })
        .eq('id', messageId);
      return;
    }

    let sentCount = 0;
    const delay = () => new Promise(resolve => setTimeout(resolve, 3500)); // 3.5 second delay

    // Send message to each contact one by one
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      try {
        console.log(`Sending to ${contact.name} (${i + 1}/${contacts.length})...`);
        await client.sendMessage(contact.id, message);
        sentCount++;
        console.log(`✓ Sent to ${contact.name}`);

        // Add delay between messages (except for the last one)
        if (i < contacts.length - 1) {
          await delay();
        }
      } catch (error) {
        console.error(`Failed to send to ${contact.name}:`, error.message);
        // Continue with next contact even if one fails
      }
    }

    // Update message status to completed
    console.log(`Broadcast completed. Sent to ${sentCount} out of ${contacts.length} contacts`);
    await supabase
      .from('broadcast_messages')
      .update({
        status: 'completed',
        sent_count: sentCount,
        completed_at: new Date().toISOString()
      })
      .eq('id', messageId);

  } catch (error) {
    console.error("Error in broadcast:", error.message);
    // Update message status to failed
    await supabase
      .from('broadcast_messages')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', messageId);
  }
};

/**
 * Process pending broadcast messages
 */
const processPendingBroadcasts = async () => {
  try {
    if (!isClientReady) {
      console.log("Client not ready, skipping broadcast check");
      return;
    }

    // Check for pending messages
    const { data: pendingMessages, error } = await supabase
      .from('broadcast_messages')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error("Error fetching pending messages:", error.message);
      return;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return; // No pending messages
    }

    const message = pendingMessages[0];
    console.log(`Found pending message: ${message.id}`);

    // Immediately change status to processing
    const { error: updateError } = await supabase
      .from('broadcast_messages')
      .update({
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', message.id);

    if (updateError) {
      console.error("Error updating message status:", updateError.message);
      return;
    }

    console.log(`Processing message: "${message.message.substring(0, 50)}..."`);

    // Send broadcast
    await sendBroadcastMessage(message.id, message.message);

  } catch (error) {
    console.error("Error processing broadcasts:", error.message);
  }
};

/**
 * Start background job that runs every 1 minute
 */
const startBroadcastJob = () => {
  console.log("Starting broadcast background job (runs every 1 minute)");

  // Run immediately on start
  processPendingBroadcasts();

  // Then run every 1 minute (60000 ms)
  setInterval(() => {
    processPendingBroadcasts();
  }, 60000);
};