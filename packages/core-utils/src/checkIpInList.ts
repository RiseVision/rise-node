import { Address4, Address6 } from 'ip-address';

function getAddressClass(addr: string): Address4 | Address6 {
  const address4 = new Address4(addr);
  if (address4.isValid()) {
    return address4;
  }
  const address6 = new Address6(addr);
  if (address6.isValid()) {
    return address6;
  }
  throw new Error(`Address ${addr} is neither v4 or v6`);
}
/**
 * Checks if ip address is in list (e.g. whitelist, blacklist).
 * @memberof module:helpers
 * @function
 * @param  list - An array of ip addresses or ip subnets.
 * @param {string} addr - The ip address to check if in array.
 * @return {boolean} True if ip is in the list, false otherwise.
 */
export function checkIpInList(list: string[], addr: string): boolean {
  // Check subnets
  const l = list.map((entry) => getAddressClass(entry));

  const testAddr = getAddressClass(addr);
  for (const entry of l) {
    if (testAddr.isInSubnet(entry)) {
      return true;
    }
  }
  return false;
}
