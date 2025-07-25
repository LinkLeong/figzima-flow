# FigZima Flow

A Figma plugin for seamless file management with NAS servers, supporting import and export operations between Figma and your local NAS.

## Features

- 🗂️ **File Browser**: Browse files and folders on your NAS server
- 📤 **Export Function**: Export Figma designs as PNG, JSON and other formats to NAS
- 📥 **Import Function**: Download images, SVG, JSON files from NAS and import to Figma
- 🔄 **Real-time Sync**: Support file list refresh and real-time status updates
- ⚠️ **Error Handling**: Comprehensive error notifications and network status monitoring

## Supported File Formats

### Export Formats
- PNG (2x resolution)
- JSON (page data)

### Import Formats
- Images: PNG, JPG, JPEG, GIF
- Vector: SVG
- Data: JSON

## Installation and Usage

### 1. Prerequisites

Make sure you have Node.js and npm installed:

```bash
# Check Node.js version
node --version

# Check npm version
npm --version
```

### 2. Install Dependencies

Run in the plugin directory:

```bash
npm install
```

### 3. Build the Code

```bash
npm run build
```

### 4. Install Plugin in Figma

1. Open Figma
2. Go to `Plugins > Development > Import plugin from manifest...`
3. Select this plugin folder
4. The plugin will appear in your plugin list

### 5. Configure NAS Connection

The plugin will prompt you to enter your NAS server information when you first use it:

- **Server Address**: Your NAS server URL (e.g., `https://your-nas-ip:port`)
- **Username**: Your NAS username
- **Password**: Your NAS password

The plugin will automatically save your login session for future use.

## How to Use

### Export Files to NAS

1. Select the layers or objects you want to export in Figma
2. Open the FigZima Flow plugin
3. Navigate to the target folder
4. Click the "📤 Export to NAS" button
5. The plugin will automatically export selected content as PNG and JSON files

### Import Files from NAS

1. Open the FigZima Flow plugin
2. Navigate to the folder containing files
3. Double-click the file you want to import
4. The file will be imported to the current Figma page

### File Browsing

- Double-click folder icons to enter subfolders
- Use path navigation for quick jumps
- Click "🔄 Refresh" button to update file list
- Connection status is displayed at the top

## API Interface Documentation

### File List Interface

```http
GET /v2_1/files/file?path={path}&index=0&size=10000&sfz=true&sort=name&direction=asc
Headers: Authorization: {token}
```

### File Upload Interface

```http
POST /v2_1/files/file/uploadV2
Headers:
  Authorization: {token}
  Content-Type: multipart/form-data
Body: {
  path: "target_path",
  file: "file_data_with_filename:filesize"
}
```

### File Download Interface

```http
GET /v3/file?token={access_token}&files={file_path}&action=download
```

## Development Guide

### Project Structure

```
├── code.ts          # Main plugin code
├── ui.html          # User interface
├── manifest.json    # Plugin configuration
├── package.json     # Project configuration
└── tsconfig.json    # TypeScript configuration
```

### Development Workflow

1. After modifying code, run `npm run build` to compile
2. Reload the plugin in Figma for testing
3. Check browser console for debugging information

### Technical Notes

- Plugin uses custom base64 encoding/decoding functions as Figma environment doesn't support native btoa/atob
- Network requests are limited by Figma plugin security policies, allowed domains must be configured in manifest.json
- File upload uses multipart/form-data format instead of JSON with base64 encoding

## Troubleshooting

### Connection Failed

- Check if NAS server address and port are correct
- Verify access credentials are valid
- Ensure network connection is stable

### Import/Export Failed

- Confirm file format is supported
- Check if file size is too large
- Review console error messages

### Build Errors

- Run `npm install` to reinstall dependencies
- Check TypeScript syntax errors
- Ensure all required type definitions are installed

## License

This project is for learning and development purposes.
