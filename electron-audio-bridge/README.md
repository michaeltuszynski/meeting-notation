# Meeting Audio Bridge

An Electron application that captures system audio from meeting applications and streams it to the Docker backend for transcription and analysis.

## Features

- 🎙️ Captures clean system audio from any application
- 🎯 Prioritizes meeting apps (Zoom, Teams, Google Meet, etc.)
- 📊 Real-time audio level visualization
- 🔄 Auto-reconnect to backend
- 📱 System tray integration for background operation

## Prerequisites

### macOS
- **Screen Recording Permission**: The app requires screen recording permission to capture audio
  - Go to System Preferences > Security & Privacy > Screen Recording
  - Add and enable the Electron app after first launch
- **Audio Routing**: For best results, install [BlackHole](https://existential.audio/blackhole/) for virtual audio routing

### Windows
- Install [VB-Cable](https://vb-audio.com/Cable/) for virtual audio routing

## Installation

```bash
# Clone or navigate to the electron-audio-bridge directory
cd electron-audio-bridge

# Install dependencies
npm install
```

## Usage

### 1. Start the Docker Backend
Make sure the meeting notation backend is running:
```bash
cd ..
docker-compose up
```

### 2. Launch the Audio Bridge
```bash
npm start
```

### 3. Select Audio Source
- The app will list all available audio sources
- Meeting applications (Zoom, Teams, etc.) are prioritized at the top
- Click on a source to select it

### 4. Start Streaming
- Click "Start Streaming" to begin capturing audio
- The app will minimize to system tray if auto-minimize is enabled
- Audio level meter shows real-time audio activity

### 5. Monitor from System Tray
- Click the tray icon to show/hide the window
- Right-click for quick access to stop streaming or quit

## Configuration

### Settings
- **Auto-minimize**: Automatically minimize to tray when streaming starts
- **Auto-reconnect**: Automatically reconnect to backend if connection is lost
- **Sample Rate**: Choose audio quality (16kHz recommended for speech)

### Environment Variables
- `BACKEND_URL`: Backend WebSocket URL (default: `http://localhost:9000`)

## Troubleshooting

### "Failed to get sources" Error
- **macOS**: Grant screen recording permission in System Preferences
- **Windows**: Run the app as administrator

### No Audio Captured
- Ensure the selected application is producing audio
- Check system audio settings
- Try selecting "Entire Screen" as the source

### Backend Connection Issues
- Verify Docker backend is running on port 9000
- Check firewall settings
- Ensure no other service is using port 9000

## Architecture

The audio bridge acts as an intermediary between system audio and the Docker backend:

1. **Audio Capture**: Uses Electron's `desktopCapturer` API to capture system audio
2. **Processing**: Converts audio to PCM format at specified sample rate
3. **Streaming**: Sends audio chunks via WebSocket to backend
4. **Monitoring**: Provides real-time feedback on audio levels and connection status

## Development

### Run in Development Mode
```bash
npm run dev
```

### Build for Distribution
```bash
npm run build
```

## License

Part of the Meeting Intelligence Assistant project.