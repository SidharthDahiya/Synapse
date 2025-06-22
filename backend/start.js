import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let restartCount = 0;
const maxRestarts = 5;

function startServer() {
  console.log(`🚀 Starting server (attempt ${restartCount + 1})`);

  const server = spawn('node', ['--max-old-space-size=8192', 'server.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });

  server.on('close', (code) => {
    console.log(`💥 Server crashed with code ${code}`);

    if (restartCount < maxRestarts) {
      restartCount++;
      console.log(`🔄 Restarting server (${restartCount}/${maxRestarts})...`);
      setTimeout(startServer, 2000);
    } else {
      console.log('❌ Max restart attempts reached. Exiting.');
      process.exit(1);
    }
  });

  server.on('error', (error) => {
    console.error('❌ Server error:', error);
  });
}

startServer();
