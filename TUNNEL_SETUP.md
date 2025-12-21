# Tunnel Setup Guide

This guide explains how to use a temporary public domain (tunnel) to receive requests from external services like n8n, even when your server is behind a firewall or NAT.

## Why Use a Tunnel?

- **Always Accessible**: Get a public URL that works from anywhere
- **No Firewall Configuration**: No need to open ports on your router
- **Easy Testing**: Perfect for development and testing with webhooks
- **Works with Docker**: Works even when services are in different containers

## Available Tunnel Services

### Option 1: Localtunnel (Recommended - No Signup Required)

**Pros:**
- ✅ No account or signup needed
- ✅ Free and open source
- ✅ Easy to use
- ✅ Automatically installed with the bot

**Cons:**
- ⚠️ URLs change each time (unless you set a subdomain)
- ⚠️ Less reliable than ngrok for production

### Option 2: Ngrok (More Reliable)

**Pros:**
- ✅ More stable and reliable
- ✅ Can use custom domains
- ✅ Better for production use
- ✅ Persistent URLs with paid plans

**Cons:**
- ⚠️ Requires free account signup
- ⚠️ Free tier has limitations

## Setup Instructions

### Step 1: Install Dependencies

The bot already includes `localtunnel` in dependencies. If you want to use ngrok instead:

```bash
npm install @ngrok/ngrok
```

### Step 2: Enable Tunnel

Set environment variables before starting the bot:

**For Localtunnel (Recommended):**
```bash
export USE_TUNNEL=true
export TUNNEL_TYPE=localtunnel
node index.js
```

**For Ngrok:**
```bash
export USE_TUNNEL=true
export TUNNEL_TYPE=ngrok
export NGROK_AUTHTOKEN=your_ngrok_authtoken_here
node index.js
```

### Step 3: Get Your Public URL

When the bot starts, you'll see output like:

```
========================================
✓ LOCALTUNNEL ACTIVE
========================================
Public URL: https://random-name.loca.lt
API endpoint: POST https://random-name.loca.lt/send-message
Test endpoint: GET https://random-name.loca.lt/test
========================================
```

**Use this URL in your n8n workflow!**

## Using in n8n

In your n8n HTTP Request node:

1. **Method**: `POST`
2. **URL**: `https://your-tunnel-url.loca.lt/send-message`
3. **Headers**: `Content-Type: application/json`
4. **Body**: 
   ```json
   {
     "number": "919313309319",
     "message": "Hello from n8n!"
   }
   ```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `USE_TUNNEL` | Enable tunnel service | `false` | No |
| `TUNNEL_TYPE` | Type: `localtunnel` or `ngrok` | `localtunnel` | No |
| `NGROK_AUTHTOKEN` | Ngrok auth token (for ngrok only) | - | Yes (if using ngrok) |
| `LOCALTUNNEL_SUBDOMAIN` | Custom subdomain for localtunnel | - | No |

## Ngrok Setup (Optional)

If you want to use ngrok instead of localtunnel:

1. **Sign up** at https://ngrok.com (free account)
2. **Get your authtoken** from the dashboard
3. **Set environment variable**:
   ```bash
   export NGROK_AUTHTOKEN=your_token_here
   ```
4. **Start bot with ngrok**:
   ```bash
   export USE_TUNNEL=true
   export TUNNEL_TYPE=ngrok
   node index.js
   ```

## Custom Localtunnel Subdomain

You can request a custom subdomain (if available):

```bash
export USE_TUNNEL=true
export TUNNEL_TYPE=localtunnel
export LOCALTUNNEL_SUBDOMAIN=my-custom-name
node index.js
```

This will try to use `https://my-custom-name.loca.lt` (subject to availability).

## Troubleshooting

### Tunnel Not Starting

**Error: "localtunnel not installed"**
```bash
npm install localtunnel
```

**Error: "ngrok not installed"**
```bash
npm install @ngrok/ngrok
```

### Tunnel Closes Unexpectedly

Localtunnel automatically reconnects. If it keeps closing:
- Check your internet connection
- Try using ngrok instead (more stable)
- Check if the port is already in use

### URL Changes Each Time

- **Localtunnel**: URLs change unless you set `LOCALTUNNEL_SUBDOMAIN`
- **Ngrok**: Free tier URLs change, paid tier can have fixed domains

### Connection Refused from n8n

1. Make sure `USE_TUNNEL=true` is set
2. Check the tunnel URL in the console output
3. Use the exact URL shown (including `https://`)
4. Test the `/test` endpoint first: `GET https://your-url.loca.lt/test`

## Example: Complete Setup

```bash
# Install dependencies
npm install

# Start with tunnel enabled
export USE_TUNNEL=true
export TUNNEL_TYPE=localtunnel
node index.js
```

Output:
```
HTTP server listening on port 3002
API endpoint (local): POST http://localhost:3002/send-message

========================================
✓ LOCALTUNNEL ACTIVE
========================================
Public URL: https://clever-mouse-123.loca.lt
API endpoint: POST https://clever-mouse-123.loca.lt/send-message
Test endpoint: GET https://clever-mouse-123.loca.lt/test
========================================
```

Now use `https://clever-mouse-123.loca.lt/send-message` in your n8n workflow!

## Security Note

⚠️ **Important**: These tunnel URLs are publicly accessible. Anyone with the URL can send messages through your bot. 

- Use tunnel URLs only for development/testing
- For production, use proper authentication or restrict access
- Consider adding API key authentication for production use

