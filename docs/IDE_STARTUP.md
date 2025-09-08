# IDE Startup Guide - Complete Application

## Overview

The `index.js` file has been updated to provide **complete application startup** from your IDE, including both backend and frontend servers with graceful shutdown handling.

## ✅ **What's New**

### **Single Entry Point**
- **One file to start everything**: `index.js` now starts both backend and frontend
- **Works in both modes**: Development and Production
- **IDE-optimized**: Designed for IDE "play" button execution
- **Graceful shutdown**: Both servers stop cleanly when you hit "stop" in your IDE

### **Complete Server Management**
- **Backend API Server**: Port 3001
- **Frontend Development Server**: Port 5173 (dev mode) or Preview Server (prod mode)
- **Automatic dependency management**: Installs frontend dependencies if missing
- **Health monitoring**: Comprehensive service health checks

## 🚀 **How to Use**

### **From IDE (Recommended)**
1. Open `index.js` in your IDE
2. Click the "play" or "run" button
3. Both servers will start automatically
4. Access the GUI at `http://localhost:5173`
5. Click "stop" in your IDE to gracefully shutdown both servers

### **From Terminal (Alternative)**
```bash
# Complete application (both servers)
node index.js

# Traditional way (still works)
npm run dev    # Development mode
npm start      # Production mode
```

## 📋 **Startup Sequence**

When you run `index.js`, it will:

1. **🔍 Environment Detection**: Automatically detects development vs production mode
2. **🏗️ Service Initialization**: Sets up all backend services (database, LLM, psychology, etc.)
3. **🌐 Backend Server**: Starts API server on port 3001
4. **🎨 Frontend Server**: Starts appropriate frontend server on port 5173
5. **🏥 Health Check**: Verifies all services are running
6. **🛡️ Graceful Shutdown Setup**: Configures clean shutdown handling

## 🎯 **Available Services**

After startup, you'll have access to:

- **🎨 Frontend GUI**: `http://localhost:5173/`
- **🌐 Backend API**: `http://localhost:3001`
- **💬 Chat API**: `http://localhost:3001/api/chat`
- **⚙️ Settings API**: `http://localhost:3001/api/settings`
- **👥 Characters API**: `http://localhost:3001/api/characters`

## 🔧 **Mode Detection**

The application automatically detects the appropriate mode:

### **Development Mode** (Default)
- Triggered when `NODE_ENV` is not set or not "production"
- Features:
  - Hot reload for frontend changes
  - Debug logging enabled
  - LLM connection testing enabled
  - Detailed error messages
  - Vite development server

### **Production Mode**
- Triggered when `NODE_ENV=production`
- Features:
  - Optimized build process
  - Production logging
  - Vite preview server
  - Performance optimizations

## 🛑 **Graceful Shutdown**

The application handles shutdown gracefully:

### **IDE Stop Button**
- Sends `SIGTERM` to the main process
- Both servers shut down cleanly
- All services are properly closed
- Database connections are closed

### **Manual Termination**
- `Ctrl+C` in terminal
- Process kill commands
- System shutdown

### **Shutdown Sequence**
1. **🎨 Frontend Server**: Stopped first
2. **🌐 Backend API**: Closed gracefully
3. **🔧 Services**: All services shutdown
4. **✅ Complete**: Clean exit

## 🔍 **Troubleshooting**

### **Frontend Not Starting**
```bash
cd frontend
npm install  # Install dependencies
```

### **Backend API Errors**
- Check logs in `logs/` directory
- Ensure database is initialized: `npm run setup`
- Verify LLM server is running (if using external LLM)

### **Port Conflicts**
- Frontend: Port 5173
- Backend: Port 3001
- Check if ports are already in use: `lsof -i :5173` or `lsof -i :3001`

### **IDE Issues**
- Ensure you're running `index.js` directly
- Check IDE console for error messages
- Try running from terminal: `node index.js`

## 📊 **Health Monitoring**

The application provides comprehensive health monitoring:

- **Service Status**: All backend services are monitored
- **Server Status**: Both frontend and backend server health
- **Database Status**: Database connection and schema validation
- **LLM Status**: Language model service availability

## 🎉 **Benefits**

### **For Development**
- **One-click startup**: No need to manage multiple terminals
- **Integrated debugging**: All logs in one place
- **Hot reload**: Frontend changes are immediately visible
- **Complete environment**: Full application stack running

### **For Production**
- **Optimized builds**: Production-ready frontend builds
- **Performance monitoring**: Health checks and service monitoring
- **Clean deployment**: Single process manages everything
- **Graceful handling**: Proper shutdown and error handling

## 🔄 **Migration from Old Method**

If you were previously using:
```bash
npm run dev  # Old way
```

Now you can use:
```bash
node index.js  # New way - starts everything
```

**Both methods still work**, but `index.js` provides the complete IDE-integrated experience.

---

## ✅ **Quick Start Checklist**

1. ✅ Open `index.js` in your IDE
2. ✅ Click "Run" or "Play" button
3. ✅ Wait for both servers to start (15-30 seconds)
4. ✅ Open `http://localhost:5173` in your browser
5. ✅ Start chatting with datetime-aware AI characters!
6. ✅ Use IDE "Stop" button to shutdown gracefully

**🎉 You now have a complete, IDE-integrated Aria AI application!**
