const { Client, LocalAuth } = require("whatsapp-web.js");
const axios = require("axios");
const qrcode = require("qrcode-terminal");

const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("message_create", async (msg) => {
  console.log("MESSAGE RECEIVED", msg, msg.from, msg.to, msg.body, msg.author);

  // Ignore messages sent by me to myself no.  
  if (msg.id.fromMe) {
    console.log("Ignore : Message sent by me");
    return;
  }

  // if msg.from contains @g.us - its from group , else its from contact
  if (msg.from.includes("@g.us")) {
    console.log("Group message");
    // respond only when the bot is mentioned in group to avoid spamming everyone
    let mentionedIds = msg.mentionedIds;
    console.log("Mentioned Ids", mentionedIds);
    if (mentionedIds && mentionedIds.includes(client.info.wid._serialized)) {
      respond_to_message(msg);
    }
  } else {
    console.log("Personal message");
    // respond to any personal message
    respond_to_message(msg);
  }
});

client.initialize();

//Message respond using n8n
respond_to_message = async (msg) => {
  // msg.reply('pong');

  //http://localhost:5678/webhook/custom_wa_bot
  //cal this api {msg:msg.body}
  //get the response and send it back to the user
  if (msg.body) {
    let data = { msg: msg.body, from: msg.from, from_name: msg._data.notifyName };
    console.log("Data to n8n", data);
    let response = await axios.post("https://taksh1.app.n8n.cloud/webhook/custom_wa_bot", data);
    console.log("Response from n8n", response.data.output);
    if (response.data.output) {
      msg.reply(response.data.output);
    } else {
      console.log("No response from n8n");
    }
  } else {
    console.log("No message body");
  }
};
