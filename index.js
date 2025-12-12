const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const http = require("http");

// Create HTTP server for Render port requirement
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WhatsApp Bot is running");
});
server.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

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

client.on("qr", (qr) => {
  console.log("QR Code generated - scan with WhatsApp");
  qrcode.generate(qr, { small: true });
});

client.on("loading_screen", (percent, message) => {
  console.log(`Loading: ${percent}% - ${message}`);
});

client.on("ready", async () => {
  console.log("Client is ready!");
  console.log("Bot is connected and ready to receive messages");
  
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
    console.log("Forwarding my outbound message to API");
    try {
      await axios.post("https://taksh1.app.n8n.cloud/webhook/864fa8a2-2647-4993-9625-7e9fb824ee55", {
        msg: msg.body,
        from: stripJid(msg.from),
        to: stripJid(msg.to),
        from_name: msg._data?.notifyName,
        direction: "outbound",
      });
    } catch (err) {
      console.error("Failed to forward outbound message", err.message);
    }
    return;
  }

  // if msg.from contains @g.us - its from group , else its from contact
  if (msg.from.includes("@g.us")) {
    console.log("Group message detected - ignoring for API forwarding");
    return;
  } else {
    console.log("Personal message");
    // respond to any personal message with safety guard
    try {
      await respond_to_message(msg);
    } catch (err) {
      console.error("Failed to handle inbound message", err.message);
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
    
    // Add a small delay before initialization to ensure previous session is cleaned up
    if (retryCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    await client.initialize();
    retryCount = 0; // Reset on success
    isInitializing = false;
    console.log("Initialization successful!");
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

//Message respond using n8n
respond_to_message = async (msg) => {
  if (msg.body) {
    let data = {
      msg: msg.body,
      from: stripJid(msg.from),
      to: stripJid(msg.to),
      from_name: msg._data.notifyName,
    };
    console.log("Data to n8n", data);
    try {
      let response = await axios.post("https://taksh1.app.n8n.cloud/webhook/custom_wa_bot", data);
      console.log("Response from n8n", response.data.output);
      if (response.data.output) {
        msg.reply(response.data.output);
      } else {
        console.log("No response from n8n");
      }
    } catch (err) {
      console.error("Error calling n8n webhook", err.message);
    }
  } else {
    console.log("No message body");
  }
};
