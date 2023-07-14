import { erc20ABI, tokenMetadata } from "@daimo/contract";
import { Address, Log, getAbiItem } from "viem";

import { ViemClient } from "../chain";

const transferEvent = getAbiItem({ abi: erc20ABI, name: "Transfer" });
export type TransferLog = Log<bigint, number, typeof transferEvent, true>;

/* USDC or testUSDC stablecoin contract. Tracks transfers. */
export class CoinIndexer {
  // TODO: index to database
  private allTransfers: TransferLog[] = [];

  private listeners: ((logs: TransferLog[]) => void)[] = [];

  constructor(client: ViemClient) {
    client.pipeLogs(
      {
        address: tokenMetadata.address,
        event: transferEvent,
      },
      this.parseLogs
    );
  }

  private parseLogs = (logs: TransferLog[]) => {
    if (logs.length === 0) return;
    this.allTransfers.push(...logs);
    this.listeners.forEach((l) => l(logs));
  };

  /** Listener invoked for all past coin transfers, then for new ones. */
  pipeAllTransfers(listener: (logs: TransferLog[]) => void) {
    listener(this.allTransfers);
    this.addListener(listener);
  }

  /** Listener is invoked for all new coin transfers. */
  addListener(listener: (logs: TransferLog[]) => void) {
    this.listeners.push(listener);
  }

  /** Unsubscribe from new coin transfers. */
  removeListener(listener: (logs: TransferLog[]) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /** Returns all transfers from or to a given address */
  filterTransfers({
    addr,
    sinceBlockNum,
  }: {
    addr: Address;
    sinceBlockNum?: bigint;
  }): TransferLog[] {
    let ret = this.allTransfers.filter(
      (log) => log.args.from === addr || log.args.to === addr
    );
    if (sinceBlockNum) {
      ret = ret.filter((log) => (log.blockNumber || 0n) >= sinceBlockNum);
    }
    return ret;
  }
}