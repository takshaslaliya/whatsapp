const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const qrcode = require("qrcode-terminal");

const client = new Client({
  authStrategy: new LocalAuth(),
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
      '--disable-features=IsolateOrigins,site-per-process'
    ],
    timeout: 120000,
    ignoreHTTPSErrors: true,
  },
  // Remove webVersionCache to let it auto-detect
  // This prevents version detection errors
});

const stripJid = (jid) => (jid ? jid.replace(/@.+$/, "") : jid);

client.on("qr", (qr) => {
  console.log("QR Code generated - scan with WhatsApp");
  qrcode.generate(qr, { small: true });
});

client.on("loading_screen", (percent, message) => {
  console.log(`Loading: ${percent}% - ${message}`);
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("disconnected", (reason) => {
  console.log("Client disconnected:", reason);
  // Auto-reconnect after 5 seconds
  setTimeout(() => {
    console.log("Attempting to reconnect...");
    client.initialize();
  }, 5000);
});

client.on("auth_failure", (msg) => {
  console.error("Authentication failure:", msg);
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
const MAX_RETRIES = 5;

const initializeClient = async () => {
  try {
    console.log(`Initializing WhatsApp client (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    await client.initialize();
    retryCount = 0; // Reset on success
  } catch (error) {
    retryCount++;
    console.error("Failed to initialize client:", error.message);
    console.error("Full error:", error);
    
    if (retryCount >= MAX_RETRIES) {
      console.error("Max retries reached. Please check your configuration.");
      process.exit(1);
    }
    
    const waitTime = Math.min(10000 * retryCount, 30000); // Exponential backoff, max 30s
    console.log(`Retrying in ${waitTime / 1000} seconds...`);
    setTimeout(initializeClient, waitTime);
  }
};

// Add process error handlers
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Don't exit, let the retry logic handle it
});

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
