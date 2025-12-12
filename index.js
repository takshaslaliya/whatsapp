const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const qrcode = require("qrcode-terminal");

const client = new Client({
  authStrategy: new LocalAuth(),
});

const stripJid = (jid) => (jid ? jid.replace(/@.+$/, "") : jid);

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
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

client.initialize();

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
