import * as ip from 'ip';

/**
 * Checks if ip address is in list (e.g. whitelist, blacklist).
 * @memberof module:helpers
 * @function
 * @param  list - An array of ip addresses or ip subnets.
 * @param {string} addr - The ip address to check if in array.
 * @return {boolean} True if ip is in the list, false otherwise.
 */
export function checkIpInList(list: string[] & { _subNets?: SubnetInfo[] }, addr: string): boolean {

  if (!list._subNets) { // First call, create subnet list
    list._subNets = [];
    for (let entry of list) {
      if (ip.isV4Format(entry)) { // IPv4 host entry
        entry = entry + '/32';
      } else if (ip.isV6Format(entry)) { // IPv6 host entry
        entry = entry + '/128';
      }
      try {
        list._subNets.push(ip.cidrSubnet(entry));
      } catch (err) {
        // tslint:disable-next-line no-console
        console.error('CheckIpInList:', err.toString());
      }
    }
  }

  // Check subnets
  for (const subnet of list._subNets) {
    if (subnet.contains(addr)) {
      return true;
    }
  }

  // IP address not found
  return false;
}
