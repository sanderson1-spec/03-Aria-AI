# 📱 Mobile Device Setup Guide

## Issues Fixed (Latest Update)

✅ **Backend server now accessible from mobile devices**
- Server now listens on `0.0.0.0` (all network interfaces) instead of just `localhost`
- CORS configuration updated to allow mobile device connections
- **YOU MUST RESTART THE SERVER** for this to work!

✅ **Character import now works on mobile devices**
- Made file input more permissive with accept types
- Added better mobile compatibility
- Improved error messages to help diagnose issues

✅ **Settings page API connection fixed**
- Dynamic API URL detection based on device
- Automatically uses correct server address

## How to Access from Mobile Device

### Option 1: Testing on Same Computer (Browser Resize)
If you're just resizing your desktop browser window to test mobile layout:
- ✅ **No setup needed** - Just resize and test!
- The app will use `localhost:3001`

### Option 2: Accessing from Real Mobile Device

If you want to test on an actual phone/tablet on the same network:

#### Step 1: Find Your Computer's IP Address

**On macOS:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**On Windows:**
```bash
ipconfig
```

Look for something like `192.168.1.x` or `10.0.0.x`

#### Step 2: Start the Server

**IMPORTANT**: Restart your server to apply the mobile access fix:
```bash
# Stop the current server (Ctrl+C or stop button in IDE)
# Then start it again:
npm start
```

The server will now listen on `0.0.0.0:3001` (all network interfaces) and accept CORS requests from mobile devices.

#### Step 3: Access from Mobile

On your mobile device's browser, navigate to:
```
http://YOUR_COMPUTER_IP:5173
```

For example:
```
http://192.168.1.100:5173
```

The app will **automatically detect** that you're on a mobile device and use:
```
http://192.168.1.100:3001
```
for the API instead of `localhost:3001`

## Environment Variable (Optional)

You can also manually set the API URL by creating a `.env` file in the `frontend` directory:

```env
VITE_API_BASE_URL=http://192.168.1.100:3001
```

Replace `192.168.1.100` with your actual computer's IP address.

## Troubleshooting

### Character Import Still Not Working
- Make sure you're selecting `.json` files
- Try using the "Files" app on iOS or "My Files" on Android first
- Some browsers may have stricter file access - try Chrome or Safari

### "Failed to load available models" on Settings
1. Check that your mobile device is on the **same Wi-Fi network** as your computer
2. Verify the server is running: `http://YOUR_IP:3001/api/llm/models` in mobile browser
3. Check firewall settings on your computer - port 3001 must be accessible
4. On macOS: System Settings → Network → Firewall → Allow connections to Node

### Can't Connect at All
- Ensure both devices are on the same network
- Try accessing `http://YOUR_IP:3001/api/characters` directly in mobile browser
- Check if your router has client isolation enabled (disable it)
- Verify the frontend dev server is accessible: `http://YOUR_IP:5173`

## Network Security Note

The app is configured to work on local networks only. If you need to access it over the internet, you'll need to:
1. Set up proper authentication
2. Use HTTPS with SSL certificates  
3. Configure your router for port forwarding
4. Consider using a VPN for security

**For local testing, the current setup is perfect and secure!** 🎉
