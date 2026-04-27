import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent llama a AppRegistry.registerComponent('main', () => App).
// También asegura que, tanto si cargas la app en Expo Go como en una build nativa,
// el entorno quede configurado correctamente.
registerRootComponent(App);
