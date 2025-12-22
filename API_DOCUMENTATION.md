# WhatsApp Bot API Documentation

## Overview

This WhatsApp Bot provides an HTTP API endpoint to send messages to WhatsApp numbers programmatically. The bot runs on a Node.js server and uses the WhatsApp Web.js library to send messages.

## Base URL

### Option 1: Public Tunnel URL (Recommended for External Services)

If you've enabled tunnel support (see `TUNNEL_SETUP.md`), use the public URL shown in the server logs:

```
https://your-tunnel-url.loca.lt
```

**Benefits:**
- ✅ Works from anywhere (no firewall configuration)
- ✅ Always accessible
- ✅ Perfect for n8n and other external services
- ✅ Works with Docker containers

**Setup:**
```bash
export USE_TUNNEL=true
export TUNNEL_TYPE=localtunnel
node index.js
```

### Option 2: Local/Network Access

**Local access:**
```
http://localhost:3002
```

**Network access (from other machines/containers):**
```
http://YOUR_SERVER_IP:3002
```

To find your server's IP address, run:
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```

Or check the server logs when it starts - it will display the network IP address.

**Note:** If you're accessing from Docker containers, you may need to use:
- `http://host.docker.internal:3002` (Docker Desktop)
- `http://172.17.0.1:3002` (Docker bridge network)
- `http://YOUR_HOST_IP:3002` (Your actual server IP)

## Endpoints

### 1. Health Check

Check if the bot is running and get available endpoints.

**Endpoint:** `GET /`

**Response:**
```json
{
  "status": "running",
  "message": "WhatsApp Bot is running",
  "endpoints": {
    "POST /send-message": "Send a WhatsApp message to a number",
    "GET /": "Health check"
  }
}
```

**Example:**
```bash
curl http://localhost:3000/
```

---

### 2. Send Message

Send a WhatsApp message to a specified phone number.

**Endpoint:** `POST /send-message`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "number": "919313309319",
  "message": "Hello! This is a test message."
}
```

**Parameters:**
- `number` (required, string): The phone number to send the message to. Can be in any format (with or without country code, with or without + sign). The API will automatically format it for WhatsApp.
- `message` (required, string): The message text to send.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "number": "919313309319@s.whatsapp.net"
}
```

**Error Responses:**

**400 Bad Request** - Missing required fields:
```json
{
  "success": false,
  "error": "Missing required fields: 'number' and 'message' are required"
}
```

**400 Bad Request** - Invalid JSON:
```json
{
  "success": false,
  "error": "Invalid JSON in request body"
}
```

**503 Service Unavailable** - Bot not ready:
```json
{
  "success": false,
  "error": "WhatsApp client is not ready. Please wait for the bot to connect."
}
```

**500 Internal Server Error** - Failed to send:
```json
{
  "success": false,
  "error": "Failed to send message: [error details]"
}
```

**404 Not Found** - Invalid endpoint:
```json
{
  "success": false,
  "error": "Endpoint not found"
}
```


---

### 3. Send Image Message

Send an image with a caption to a specified phone number.

**Endpoint:** `POST /send-image`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "number": "919313309319",
  "message": "Here is an image for you!",
  "image": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "mimetype": "image/png"
}
```

**Parameters:**
- `number` (required, string): The phone number to send the image to.
- `message` (optional, string): The caption for the image.
- `image` (required, string): The Base64 encoded, string representation of the image.
- `mimetype` (optional, string): The MIME type of the image. Defaults to `image/jpeg`.

**Success Response (200 OK):**
```json
{
  "success": true,
  "message": "Image sent successfully",
  "number": "919313309319@s.whatsapp.net"
}
```

**Error Responses:**

**413 Payload Too Large** - Image too big (Max 10MB):
```json
{
  "success": false,
  "error": "Payload too large. Max 10MB."
}
```

Plus standard error responses (400, 503, 500) as above.



## Examples

### cURL Example

```bash
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "number": "919313309319",
    "message": "Hello! This is a test message from the API."
  }'
```

### JavaScript (Fetch) Example

```javascript
async function sendWhatsAppMessage(number, message) {
  try {
    const response = await fetch('http://localhost:3000/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: number,
        message: message
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Message sent successfully!', data);
    } else {
      console.error('Error:', data.error);
    }
    
    return data;
  } catch (error) {
    console.error('Request failed:', error);
  }
}

// Usage
sendWhatsAppMessage('919313309319', 'Hello from JavaScript!');
```

### Python Example

```python
import requests
import json

def send_whatsapp_message(number, message):
    url = 'http://localhost:3000/send-message'
    headers = {'Content-Type': 'application/json'}
    data = {
        'number': number,
        'message': message
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        result = response.json()
        
        if result.get('success'):
            print('Message sent successfully!', result)
        else:
            print('Error:', result.get('error'))
        
        return result
    except Exception as e:
        print('Request failed:', e)
        return None

# Usage
send_whatsapp_message('919313309319', 'Hello from Python!')
```

### Node.js (Axios) Example

```javascript
const axios = require('axios');

async function sendWhatsAppMessage(number, message) {
  try {
    const response = await axios.post('http://localhost:3000/send-message', {
      number: number,
      message: message
    });
    
    console.log('Message sent successfully!', response.data);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Error:', error.response.data);
    } else {
      console.error('Request failed:', error.message);
    }
  }
}

// Usage
sendWhatsAppMessage('919313309319', 'Hello from Node.js!');
```

---

## Phone Number Format

The API accepts phone numbers in various formats and automatically formats them for WhatsApp:

**Accepted formats:**
- `919313309319` (digits only)
- `+91 9313309319` (with country code and spaces)
- `91-9313309319` (with dashes)
- `919313309319@s.whatsapp.net` (already formatted - will be used as-is)

**Note:** The API will:
1. Remove all non-digit characters
2. Add the `@s.whatsapp.net` suffix automatically
3. Use the formatted number to send the message

---

## Important Notes

1. **Bot Must Be Connected**: The WhatsApp bot must be connected and ready before sending messages. Check the health endpoint or wait for the bot to initialize.

2. **Rate Limiting**: Be mindful of WhatsApp's rate limits. Sending too many messages too quickly may result in temporary restrictions.

3. **Message Format**: Currently, the API supports text messages only. Media messages and other formats are not supported in this version.

4. **Error Handling**: Always check the `success` field in the response to determine if the message was sent successfully.

5. **CORS**: The API includes CORS headers, so it can be called from web applications.

---

## Troubleshooting

### Bot Not Ready (503 Error)
- **Solution**: Wait for the bot to connect to WhatsApp. Check the server logs to see the connection status.

### Message Not Sent (500 Error)
- **Possible causes**:
  - Invalid phone number
  - Number not registered on WhatsApp
  - Network issues
  - WhatsApp connection lost

### Invalid JSON (400 Error)
- **Solution**: Ensure your request body is valid JSON and includes the `Content-Type: application/json` header.

### Missing Fields (400 Error)
- **Solution**: Ensure both `number` and `message` fields are present in the request body.

---

## Support

For issues or questions, check the server logs for detailed error messages.

