import os from 'node:os';

const apiPort = process.env.TERMINAL_API_PORT || '4100';

function getIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family !== 'IPv4' || entry.internal) {
        continue;
      }

      addresses.push({
        name,
        address: entry.address,
      });
    }
  }

  return addresses;
}

async function checkHealth(address) {
  const url = `http://${address}:${apiPort}/api/health`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
    return {
      url,
      ok: response.ok,
      status: response.status,
    };
  } catch (error) {
    return {
      url,
      ok: false,
      status: error.message || 'unreachable',
    };
  }
}

const addresses = getIpv4Addresses();

console.log('Melisa Terminal field test info');
console.log('');

if (!addresses.length) {
  console.log('No LAN IPv4 address found.');
  console.log('Check Wi-Fi/Ethernet connection.');
  process.exit(1);
}

for (const item of addresses) {
  const health = await checkHealth(item.address);
  console.log(`Adapter: ${item.name}`);
  console.log(`PC IPv4: ${item.address}`);
  console.log(`API URL: http://${item.address}:${apiPort}`);
  console.log(`Health: ${health.ok ? 'OK' : 'FAIL'} (${health.url} / ${health.status})`);
  console.log('');
}

console.log('Expo LAN start:');
console.log('npm run start:lan');
console.log('');
console.log('If LAN QR does not connect:');
console.log('npm run start:tunnel');
console.log('');
console.log('Phone checklist:');
console.log('1. Phone and PC must be on the same Wi-Fi for LAN.');
console.log('2. Expo Go must scan the QR inside Expo Go, not normal camera/browser.');
console.log(`3. App Settings API address should be http://PC_IP:${apiPort}.`);
console.log('4. Windows Firewall must allow Node/Expo and API port.');
