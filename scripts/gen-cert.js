'use strict';

/**
 * Self-signed cert generator.
 *
 * Why this exists: DeviceOrientationEvent.requestPermission() only resolves in a
 * secure context. A plain HTTP address on the local network is NOT a secure context, so that
 * LAN server can never read the phone's IMU. HTTPS with a self-signed cert is —
 * you just have to click through the browser warning once on the phone.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const os = require('os');

const CERT_DIR = path.join(__dirname, '..', 'certs');
const KEY_PATH = path.join(CERT_DIR, 'key.pem');
const CRT_PATH = path.join(CERT_DIR, 'cert.pem');

/** Every non-internal IPv4 address, so the cert covers whichever LAN IP is live. */
function localAddresses() {
  const out = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address);
    }
  }
  return out;
}

function isPrivateLanAddress(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function addressPriority(address) {
  if (isPrivateLanAddress(address)) return 2;
  if (address.startsWith('169.254.')) return 0;
  return 1;
}

function choosePreferredAddress(addresses) {
  return addresses.reduce((best, address) => {
    if (!best || addressPriority(address) > addressPriority(best)) return address;
    return best;
  }, null);
}

function configuredAddress() {
  const address = process.env.GAMEVITTO_IP?.trim();
  return net.isIP(address) === 4 ? address : null;
}

function certificateAddresses() {
  return [...new Set([...localAddresses(), configuredAddress()].filter(Boolean))];
}

function preferredAddress() {
  return configuredAddress() || choosePreferredAddress(localAddresses()) || 'localhost';
}

/** Does the existing cert still cover every address we're about to serve on? */
function certCoversCurrentIps(quiet) {
  try {
    const text = execFileSync('openssl', ['x509', '-in', CRT_PATH, '-noout', '-ext', 'subjectAltName'], {
      encoding: 'utf8',
    });
    const missing = certificateAddresses().filter((ip) => !text.includes(ip));
    if (missing.length && !quiet) {
      console.log(`[certificado] gerando novamente para incluir o endereço ${missing.join(', ')}`);
    }
    return missing.length === 0;
  } catch {
    return false;
  }
}

function ensureCert({ quiet = false } = {}) {
  // A cert pinned to an old DHCP lease still loads, but the phone then hits a
  // NAME_INVALID error that looks nothing like "self-signed" — so check the
  // SANs rather than just the file's existence.
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CRT_PATH) && certCoversCurrentIps(quiet)) {
    return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CRT_PATH) };
  }

  fs.mkdirSync(CERT_DIR, { recursive: true });

  const ips = certificateAddresses();
  const altNames = ['DNS:localhost', 'IP:127.0.0.1', ...ips.map((ip) => `IP:${ip}`)].join(',');

  try {
    execFileSync(
      'openssl',
      [
        'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
        '-keyout', KEY_PATH,
        '-out', CRT_PATH,
        '-days', '825',
        '-subj', '/CN=gamevitto.local',
        '-addext', `subjectAltName=${altNames}`,
      ],
      { stdio: 'ignore' }
    );
  } catch (err) {
    if (!quiet) {
      console.error('[certificado] o OpenSSL falhou. O servidor usará HTTP comum.');
      console.error('[certificado]', err.message);
    }
    return null;
  }

  if (!quiet) console.log(`[certificado] certificado autoassinado criado para ${altNames}`);
  return { key: fs.readFileSync(KEY_PATH), cert: fs.readFileSync(CRT_PATH) };
}

module.exports = {
  ensureCert,
  localAddresses,
  isPrivateLanAddress,
  choosePreferredAddress,
  preferredAddress,
  CERT_DIR,
};

if (require.main === module) ensureCert();
