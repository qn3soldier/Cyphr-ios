/**
 * iOS Entry Point - index.js
 * Adapted from web main.tsx for React Native
 */

import { registerRootComponent } from 'expo';
import App from './src/App';

// Register the main app component for iOS
// NO ReactDOM - using Expo registerRootComponent instead
registerRootComponent(App);

export default App;