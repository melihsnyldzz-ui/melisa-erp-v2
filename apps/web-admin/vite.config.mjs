import {fileURLToPath} from 'node:url';
import {loadEnv} from 'vite';
import {assertEmptyLocalBuildEnvironment} from './src/config/emptyLocalInstallation.mjs';

export default ({mode}) => {
  const environment = {...loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_'), ...process.env};
  if (!assertEmptyLocalBuildEnvironment(environment, mode)) return {};
  return {
    server: {host: '127.0.0.1', port: 5294, strictPort: true, cors: false},
    preview: {host: '127.0.0.1', port: 5294, strictPort: true, cors: false},
  };
};
