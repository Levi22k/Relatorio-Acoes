import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const version=process.env.GITHUB_SHA||new Date().toISOString();
export default defineConfig({define:{__APP_VERSION__:JSON.stringify(version)},plugins:[react(),{name:'version-file',generateBundle(){this.emitFile({type:'asset',fileName:'version.json',source:JSON.stringify({version})})}}],base:process.env.GITHUB_REPOSITORY?'/'+process.env.GITHUB_REPOSITORY.split('/')[1]+'/':'/'});
