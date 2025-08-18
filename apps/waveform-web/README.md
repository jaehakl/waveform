# Waveform Web

Waveform Web is a web-based configuration editor for physics simulations. It provides an intuitive interface for users to set up and manage various simulation parameters.

## 🚀 Key Features

### 📊 Simulation Configuration Management
- **Constants**: Simulation constant settings
- **Settings**: Simulation configuration parameters
- **Structures**: 3D structure definitions
- **Components**: Simulation component settings
- **Sources**: Source configuration
- **Detectors**: Detector settings
- **Materials**: Material property definitions
- **Material Susceptibility**: Material susceptibility settings

### 🎨 User Interface
- **Tab-based Editor**: Manage each configuration category through separate tabs
- **Spreadsheet Interface**: Edit data for structures, components, etc. in table format
- **Form-based Input**: Input constants and settings through intuitive forms
- **3D Visualization**: Preview configured structures in 3D
- **Real-time Structure Regeneration**: Update 3D structures in real-time when settings change

### 🔐 User Management
- Login/logout functionality
- User-specific configuration storage and management
- Public/private configuration support

### 💾 Data Management
- Backend server integration for configuration storage
- Configuration list viewing and editing
- Configuration copying and sharing features

## 🛠 Technology Stack

### Frontend
- **React 19**: Latest React version
- **Vite**: Fast development server and build tool
- **RSuite**: React UI component library
- **Three.js**: 3D visualization
- **Axios**: HTTP client

### Development Tools
- **ESLint**: Code quality management
- **Less**: CSS preprocessor
- **React Router**: Client-side routing

## 📁 Project Structure

```
src/
├── api/                    # API communication
│   └── api.js             # Backend API call functions
├── components/             # Reusable components
│   ├── Navbar.jsx         # Navigation bar
│   ├── SetupList.jsx      # Configuration list component
│   ├── Spreadsheet.jsx    # Spreadsheet component
│   ├── experiment3D.jsx   # 3D visualization component
│   └── LoginForm.jsx      # Login form
├── contexts/              # React Context
│   ├── AuthContext.jsx    # Authentication state management
│   └── ThemeContext.jsx   # Theme state management
├── lib/                   # Utility libraries
│   └── structureToGeometry.js  # Convert structures to 3D
├── styles/                # Style files
├── SetupEditor.jsx        # Main configuration editor component
├── App.jsx               # App root component
└── main.jsx              # App entry point
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Backend server (waveform-server) running

### Installation and Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   
   Or on Windows:
   ```bash
   run.bat
   ```

3. **View in Browser**
   - Navigate to http://localhost:5173

### Build

```bash
npm run build
```

### Code Quality Check

```bash
npm run lint
```

## 🔧 Key Components

### SetupEditor
The main configuration editor component that provides:

- **Tab-based Interface**: Manage 8 configuration categories through tabs
- **Unified State Management**: Manage all configuration data in a single `inputData` state
- **Dynamic Rendering**: Generate tabs and forms dynamically based on `SECTIONS` array
- **Backend Integration**: Configuration save, load, and update functionality

### Spreadsheet
Spreadsheet-style data editing component:
- Dynamic row/column addition/deletion
- Dropdown option support
- Real-time data validation

### Experiment3D
Three.js-based 3D visualization component:
- Render configured structures in 3D
- Real-time updates
- Interactive viewer

## 🔄 Data Flow

1. **Initial Load**: Read input_variables JSON files from backend
2. **Configuration Editing**: Users edit settings by tab
3. **3D Update**: Automatically update 3D view when structures/components change
4. **Save**: Save edited configurations to backend
5. **Load**: Load saved configurations and display in editor

## 🎯 Code Quality and Maintainability

### Improvements Made
- **Unified State Management**: Consolidated all InputVariables into a single `inputData` object
- **Dynamic Section Management**: Automatically generate tabs and states based on `SECTIONS` array
- **Common Setter**: Unified data updates for all sections using `getSectionSetter` function
- **Loop-based Rendering**: Dynamic rendering using `map` instead of hardcoded tabs

### Extensibility
- Add new sections: Simply add to `SECTIONS` array and tabs/states are automatically generated
- Change section types: Specify 'form' or 'sheet' using the `type` field
- Backend integration: Flexible data structure support based on JSON files

## 🔗 Backend Integration

This project integrates with the `waveform-server` backend:

- **API Endpoint**: http://localhost:8000
- **Authentication**: Session-based authentication
- **Data Source**: JSON files in server's `input_variables` directory
- **Storage**: User-specific configurations stored in database

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
