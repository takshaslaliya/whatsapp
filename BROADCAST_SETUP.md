# WhatsApp Broadcast Messaging Setup Guide

## Prerequisites

1. Supabase account and project
2. WhatsApp bot running and connected
3. Node.js installed

## Setup Steps

### 1. Create Supabase Tables

1. Go to your Supabase dashboard: https://kgvpymzrtnhwciwgfugo.supabase.co
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-migration.sql`
4. Click **Run** to execute the migration
5. Verify the `broadcast_messages` table was created

### 2. Install Dependencies

```bash
npm install
```

This will install:
- `@supabase/supabase-js` - Supabase client
- Other existing dependencies

### 3. Configure Environment Variables (Optional)

If you want to use different Supabase credentials, set these environment variables:

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://kgvpymzrtnhwciwgfugo.supabase.co"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY="sb_publishable_ykbR6cyN6de023y3HI9nUQ_8-xiMijQ"
```

Or create a `.env` file:
```
NEXT_PUBLIC_SUPABASE_URL=https://kgvpymzrtnhwciwgfugo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_ykbR6cyN6de023y3HI9nUQ_8-xiMijQ
```

### 4. Start the Bot

```bash
npm start
```

The bot will:
- Connect to WhatsApp
- Start the background job that runs every 1 minute
- Check for pending broadcast messages

### 5. Access Admin Dashboard

1. Open `admin-dashboard.html` in your web browser
2. Or serve it using a local server:
   ```bash
   npx serve .
   # Then open http://localhost:3000/admin-dashboard.html
   ```

## How It Works

### Background Job Flow

1. **Every 1 minute**, the bot checks Supabase for messages with status `pending`
2. If found, it **immediately changes status to `processing`**
3. Fetches **all WhatsApp contacts** directly from WhatsApp Web
4. Sends the message to each contact **one by one**
5. Adds a **3-4 second delay** between each message
6. Counts successful sends
7. Updates status to `completed` with `sent_count`

### Admin Dashboard Features

- **Create Broadcast**: Add new messages (status: pending)
- **View All Messages**: See all broadcasts with:
  - Message text
  - Status (pending, processing, completed, failed)
  - Sent count
  - Created and completed timestamps
- **Auto-refresh**: Updates every 5 seconds

### Status Flow

```
pending → processing → completed
                ↓
             failed (if error occurs)
```

## Database Schema

### broadcast_messages Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| message | TEXT | Broadcast message content |
| status | TEXT | pending, processing, completed, failed |
| sent_count | INTEGER | Number of contacts messaged (default: 0) |
| created_at | TIMESTAMPTZ | When message was created |
| updated_at | TIMESTAMPTZ | Last update time |
| started_at | TIMESTAMPTZ | When processing started |
| completed_at | TIMESTAMPTZ | When processing finished |
| error_message | TEXT | Error details if failed |

## Important Notes

1. **Contact Fetching**: Contacts are fetched directly from WhatsApp Web, not from a database
2. **Rate Limiting**: 3-4 second delay between messages prevents account suspension
3. **One at a Time**: Only one broadcast is processed at a time (first pending message)
4. **Error Handling**: Failed sends don't stop the broadcast; count continues
5. **Status Updates**: Status changes are immediate to prevent duplicate processing

## Troubleshooting

### Bot not processing messages
- Ensure WhatsApp bot is connected and ready
- Check bot logs for errors
- Verify Supabase connection

### Messages stuck in "processing"
- Check if bot disconnected
- Restart the bot
- Manually update status in Supabase if needed

### No contacts found
- Ensure WhatsApp is connected
- Check if you have contacts in WhatsApp
- Verify bot has access to contacts

## Security Notes

- The current Supabase policies allow all operations
- For production, restrict access based on admin authentication
- Consider adding user authentication to the admin dashboard

