/**
 * Web Bluetooth thermal-printer helper.
 *
 * Most 58mm/80mm Bluetooth POS printers speak ESC/POS over a simple GATT
 * service. There is no truly-standard UUID, but almost every printer sold
 * for POS use exposes one of these three "printer service" UUIDs (they
 * originate from the same reference SDK).
 */

// Common GATT UUIDs used by consumer BT thermal printers. We advertise all
// of them so the browser device picker doesn't blank when the printer's
// preferred service isn't the "first" one.
const KNOWN_PRINTER_SERVICES = [
  0x18f0, // generic printer service (BT-P/S/H bluetooth POS printers)
  0xff00, // xprinter, munbyn, etc.
  0xffe0, // HC-05 / HC-06 SPP clones sometimes used by cheap TSPL printers
  0xffb0, // Xprinter XP-58 variants
];

/**
 * Ask the browser to prompt the user for a nearby BT printer. Returns the
 * device on success, or throws a DOMException on cancel/error.
 */
export async function requestPrinter() {
  if (!("bluetooth" in navigator)) {
    throw new Error(
      "Browser tidak mendukung Web Bluetooth. Pakai Chrome/Edge di Android atau macOS."
    );
  }
  const device = await navigator.bluetooth.requestDevice({
    // Accept any BT device but expose the known printer services so the
    // subsequent gatt.getPrimaryService() can find one.
    acceptAllDevices: true,
    optionalServices: KNOWN_PRINTER_SERVICES,
  });
  return device;
}

/**
 * Given a paired BluetoothDevice, connect and locate a writable ESC/POS
 * characteristic. Returns { device, server, characteristic }.
 */
export async function connectPrinter(device) {
  const server = await device.gatt.connect();

  // Try each known printer service. The first one that resolves wins.
  let service = null;
  for (const uuid of KNOWN_PRINTER_SERVICES) {
    try {
      service = await server.getPrimaryService(uuid);
      if (service) break;
    } catch (e) {
      /* try next */
    }
  }
  if (!service) {
    // Fallback: enumerate all primary services and pick the first one that
    // exposes a writable characteristic.
    const services = await server.getPrimaryServices();
    for (const s of services) {
      const chars = await s.getCharacteristics();
      const writable = chars.find(
        (c) => c.properties?.write || c.properties?.writeWithoutResponse
      );
      if (writable) {
        service = s;
        return { device, server, characteristic: writable };
      }
    }
    throw new Error(
      "Perangkat terhubung tapi tidak ada service printer yang bisa ditulis."
    );
  }

  const chars = await service.getCharacteristics();
  const writable = chars.find(
    (c) => c.properties?.write || c.properties?.writeWithoutResponse
  );
  if (!writable) {
    throw new Error("Karakteristik tulis tidak ditemukan di printer.");
  }
  return { device, server, characteristic: writable };
}

/** ASCII-safe substring transliteration for characters that ESC/POS
 *  code-page 437 doesn't support out-of-the-box. */
function toAscii(text) {
  return String(text || "")
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[•●]/g, "*")
    .replace(/·/g, "-")
    .replace(/[^\x00-\xff]/g, "?");
}

// Emit ESC/POS control bytes for common operations.
export const ESC_POS = {
  init: () => new Uint8Array([0x1b, 0x40]), // ESC @
  alignCenter: () => new Uint8Array([0x1b, 0x61, 0x01]),
  alignLeft: () => new Uint8Array([0x1b, 0x61, 0x00]),
  boldOn: () => new Uint8Array([0x1b, 0x45, 0x01]),
  boldOff: () => new Uint8Array([0x1b, 0x45, 0x00]),
  doubleOn: () => new Uint8Array([0x1d, 0x21, 0x11]),
  doubleOff: () => new Uint8Array([0x1d, 0x21, 0x00]),
  feed: (n = 3) => new Uint8Array([0x1b, 0x64, n]),
  cut: () => new Uint8Array([0x1d, 0x56, 0x00]),
};

/**
 * Convert a plain-text receipt (already formatted line by line) into an
 * ESC/POS byte stream. Includes init, centered header block, left-aligned
 * body, and a final feed + full-cut.
 */
export function buildEscPosPayload(headerLines, bodyLines, footerLines) {
  const enc = new TextEncoder();
  const chunks = [];
  const push = (bytes) => chunks.push(bytes);

  push(ESC_POS.init());

  // Header centered + bold + double-height for the first line
  push(ESC_POS.alignCenter());
  headerLines.forEach((line, i) => {
    if (i === 0) {
      push(ESC_POS.doubleOn());
      push(ESC_POS.boldOn());
      push(enc.encode(toAscii(line) + "\n"));
      push(ESC_POS.boldOff());
      push(ESC_POS.doubleOff());
    } else {
      push(enc.encode(toAscii(line) + "\n"));
    }
  });

  // Body left-aligned
  push(ESC_POS.alignLeft());
  push(enc.encode("\n"));
  bodyLines.forEach((line) => push(enc.encode(toAscii(line) + "\n")));

  // Footer centered
  if (footerLines.length) {
    push(enc.encode("\n"));
    push(ESC_POS.alignCenter());
    footerLines.forEach((line) => push(enc.encode(toAscii(line) + "\n")));
  }

  push(ESC_POS.feed(4));
  push(ESC_POS.cut());

  // Flatten to single Uint8Array
  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/**
 * Send an ESC/POS payload to the printer characteristic. Automatically
 * chunks large payloads to the 512-byte GATT MTU limit that most cheap
 * printers enforce. Uses writeWithoutResponse when available (faster).
 */
export async function writeToPrinter(characteristic, payload) {
  const chunkSize = 180; // safe under 512-byte MTU + BT MTU headroom
  const useNoResponse = characteristic.properties?.writeWithoutResponse;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize);
    if (useNoResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
  }
}

export const isWebBluetoothSupported = () =>
  typeof navigator !== "undefined" && "bluetooth" in navigator;
