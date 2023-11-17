import {
  AddrLabel,
  DAccount,
  DaimoAccountCall,
  EAccount,
  isValidName,
  validateName,
} from "@daimo/common";
import {
  daimoEphemeralNotesAddress,
  nameRegistryProxyConfig,
} from "@daimo/contract";
import {
  Address,
  Log,
  encodeFunctionData,
  getAbiItem,
  getAddress,
  hexToString,
  isAddress,
} from "viem";
import { normalize } from "viem/ens";

import { chainConfig } from "../env";
import { ViemClient } from "../network/viemClient";

const registeredName = "Registered";
const registeredEvent = getAbiItem({
  abi: nameRegistryProxyConfig.abi,
  name: registeredName,
});

type RegisteredLog = Log<bigint, number, false, typeof registeredEvent, true>;

const specialAddrLabels: { [_: Address]: AddrLabel } = {
  "0x2A6d311394184EeB6Df8FBBF58626B085374Ffe7": AddrLabel.Faucet,
  // All historical notes ("payment link") contract addresses
  "0x37Ac8550dA1E8d227266966A0b4925dfae648f7f": AddrLabel.PaymentLink,
  "0x450E09fc6C2a9bC4230D4e6f3d7131CCa48b48Ce": AddrLabel.PaymentLink,
  "0x1eec7E083C1a10C16470bEAc7839364853c7B81f": AddrLabel.PaymentLink,
  "0x831967F433D9425Aa34D6A3dAC01a428d839De0f": AddrLabel.PaymentLink,
  "0x4adca7cb84497c9c4c308063d2f219c7b6041183": AddrLabel.PaymentLink,
  // All historical paymaster addresses
  "0x13f490FafBb206440F25760A10C21A6220017fFa": AddrLabel.Paymaster,
  "0x939263eAFE57038a072cb4edD6B25dd81A8A6c56": AddrLabel.Paymaster,
  // Known Coinbase Pay addresses on Base
  "0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A": AddrLabel.Coinbase,
  "0x6dcBCe46a8B494c885D0e7b6817d2b519dF64467": AddrLabel.Coinbase,
};
specialAddrLabels[daimoEphemeralNotesAddress] = AddrLabel.PaymentLink;
specialAddrLabels[chainConfig.pimlicoPaymasterAddress] = AddrLabel.Paymaster;

/* Interface to the NameRegistry contract. */
export class NameRegistry {
  /* In-memory indexer, for now. */
  private nameToAddr = new Map<string, Address>();
  private addrToName = new Map<Address, string>();
  private accounts: DAccount[] = [];

  public logs: RegisteredLog[] = [];

  constructor(private vc: ViemClient, private nameBlacklist: Set<string>) {}

  /** Init: index logs from chain, get all names so far */
  async init() {
    await this.vc.pipeLogs(
      {
        address: nameRegistryProxyConfig.address,
        event: registeredEvent,
      },
      this.parseLogs
    );
  }

  /** Parses Registered event logs, first in init(), then on subscription. */
  parseLogs = async (logs: RegisteredLog[]) => {
    this.logs.push(...logs);

    const accounts = logs
      .map((l) => l.args)
      .map((a) => ({
        name: hexToString(a.name, { size: 32 }),
        addr: getAddress(a.addr),
      }));
    console.log(`[NAME-REG] parsed ${accounts.length} named account(s)`);

    accounts.forEach(this.cacheAccount);
  };

  /** Cache an account in memory. */
  private cacheAccount = (acc: DAccount) => {
    if (!isValidName(acc.name)) {
      console.log(`[NAME-REG] skipping invalid name ${acc.name}`);
      return;
    }

    console.log(`[NAME-REG] caching ${acc.name} -> ${acc.addr}`);
    this.nameToAddr.set(acc.name, acc.addr);

    if (this.nameBlacklist.has(acc.name)) {
      console.log(`[NAME-REG] hiding blacklisted name ${acc.name}`);
      return;
    }
    this.addrToName.set(acc.addr, acc.name);
    this.accounts.push(acc);
  };

  /** Find accounts whose names start with a prefix */
  async search(prefix: string): Promise<DAccount[]> {
    // Slow, linear time search. Replace with DB past a few hundred accounts.
    return this.accounts
      .filter((a) => a.name.startsWith(prefix))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 10);
  }

  /** Get call for registering a Daimo name to an address. */
  getRegisterNameCall(name: string): DaimoAccountCall {
    validateName(name);
    const nameHex = Buffer.from(name.padEnd(32, "\0")).toString("hex");

    return {
      dest: nameRegistryProxyConfig.address,
      value: 0n,
      data: encodeFunctionData({
        abi: nameRegistryProxyConfig.abi,
        functionName: "registerSelf",
        args: [`0x${nameHex}`],
      }),
    };
  }

  /** On successfully registering a name, cache it. */
  onSuccessfulRegister = (name: string, address: Address) => {
    this.cacheAccount({ name, addr: address });
  };

  /** Find wallet address for a given Daimo name, or undefined if not found. */
  resolveName(name: string): Address | undefined {
    return this.nameToAddr.get(name);
  }

  /** Find name, or undefined if not a Daimo account. */
  resolveDaimoNameForAddr(addr: Address): string | undefined {
    return this.addrToName.get(addr);
  }

  /** Gets an Ethereum account, including name, ENS, label if available. */
  async getEAccount(address: Address): Promise<EAccount> {
    // First, look for a Daimo name
    const name = this.addrToName.get(address);
    if (name) return { addr: address, name };

    // Then, a special labelled address, e.g. faucet
    const label = specialAddrLabels[address];
    if (label) return { addr: address, label };

    // Finally, ENS reverse lookup
    let ensName: string | undefined = undefined;
    try {
      console.log(`[NAME-REG] looking up ENS name for ${address}`);
      ensName = (await this.vc.getEnsName({ address })) || undefined;
      // Verify the forward lookup
      if (ensName != null) {
        const addr = await this.vc.getEnsAddress({ name: ensName });
        if (addr !== address) {
          console.warn(`[NAME-REG] bad ENS ${address} > ${ensName} > ${addr}`);
          ensName = undefined;
        }
      }
      console.log(`[NAME-REG] ENS name for ${address}: ${ensName}`);
    } catch (e) {
      console.log(`[NAME-REG] ENS lookup failed for ${address}: ${e}`);
    }

    // Bare addresses are fine too, ensName can be undefined
    return { addr: address, ensName };
  }

  /** Gets an Ethereum account given "alice", "bob.eth", or "0x..." */
  async getEAccountFromStr(eAccStr: string): Promise<EAccount | undefined> {
    if (eAccStr.includes(".")) {
      const ensName = normalize(eAccStr);
      const addr = await this.vc.getEnsAddress({ name: ensName });
      if (addr != null) {
        return { ensName, addr } as EAccount;
      }
    } else if (isAddress(eAccStr)) {
      const addr = getAddress(eAccStr);
      return { addr } as EAccount;
    } else {
      const daimoAddress = this.resolveName(eAccStr);
      if (daimoAddress) {
        return await this.getEAccount(daimoAddress);
      }
    }
  }
}
