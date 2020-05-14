/*
 * Created with @iobroker/create-adapter v1.24.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from "@iobroker/adapter-core";
import fetch from "node-fetch"

const API = "/api/v1/"

type DeviceInfo = {

  type: string;         // The type of the device
  battery: boolean;     // Wether or not the devices is using batteries
  reachable: boolean;   // Wether or not the device is connected to a myStrom account
  meshroot: boolean;    // DEPRECATED
  on: boolean;          // Wether or not the bulb is currently turned on
  color: string;        // The current color
  mode: "rgb" | "hsv";  // The color mode the bulb is currently set to
  ramp: number;         // How quickly the bulb changes its its color
  power: number;        // The power consumed by the bulb
  fw_version: string;   // The firmware version of the bulb

}

type GeneralInfo = {
  version: string;      // Current firmware version
  mac: string;          // MAC address, without any delimiters
  type: string;         // The type of the queried device. See the type list below.
  ssid: string;         // SSID of the currently connected network
  ip: string;           // Current ip address
  mask: string;         // Mask of the current network
  gateway: string;      // Gateway of the current network
  dns: string;          // DNS of the curent network
  static: boolean;       // Wether or not the ip address is static
  connected: boolean;   // Wether or not the device is connected to the internet
}
// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ioBroker {
    interface AdapterConfig {
      url: string;
      hostip: string;
    }
  }
}

class MystromWifiBulb extends utils.Adapter {

  public constructor(options: Partial<utils.AdapterOptions> = {}) {
    super({
      ...options,
      name: "mystrom-wifi-bulb",
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }

  /**
   * Is called when databases are connected and adapter received configuration.
   */
  private async onReady(): Promise<void> {

    this.setState("info.connection", false, true)

    const gi: GeneralInfo = await this.doFetch("info")
    if (!gi) {
      this.log.error("Could not connect to devcice")
    } else {
      await this.createObject("boolean", "on", true)
      await this.createObject("string", "mode", true)
      await this.createObject("string", "color", true)
      await this.createObject("number", "ramp", true)
      await this.createObject("number", "power", false)
      this.setState("info.deviceInfo.mac", gi.mac)
      this.setState("info.deviceInfo.details", JSON.stringify(gi))
      const di: DeviceInfo = await this.doFetch("device")
      if (!di) {
        this.log.error("could not get devive info")
      } else {
        this.setState("on", di.on, true)
        this.setState("mode", di.mode, true)
        this.setState("color", di.color, true)
        this.setState("ramp", di.ramp, true)
        this.setState("power", di.power, true)
        this.setState("info.connection", true, true)
      }
    }



    // in this template all states changes inside the adapters namespace are subscribed
    this.subscribeStates("*");

    /*
    setState examples
    you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
    */
    // the variable testVariable is set to true as command (ack=false)
    await this.setStateAsync("testVariable", true);

    // same thing, but the value is flagged "ack"
    // ack should be always set to true if the value is received from or acknowledged from the target system
    await this.setStateAsync("testVariable", { val: true, ack: true });

    // same thing, but the state is deleted after 30s (getState will return null afterwards)
    await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

  }


  private async createObject(type: "string" | "boolean" | "number", name: string, writeable: boolean): Promise<void> {
    await this.setObjectAsync(name, {
      type: "state",
      common: {
        name,
        type: type,
        role: "indicator",
        read: true,
        write: writeable
      },
      native: {}
    })
  }

  private async doFetch(addr: string): Promise<any> {
    const url = this.config.url + API

    this.log.info("Fetching " + url + addr)
    try {
      const response = await fetch(url + addr, { method: "get" })
      if (response.status == 200) {
        const result = await response.json()
        this.log.info("got " + JSON.stringify(result))
        return result

      } else {
        this.log.error("Error while fetching " + addr + ": " + response.status)
        this.setState("info.connection", false, true);
        return {}
      }
    } catch (err) {
      this.log.error("Fatal error during fetch")
      this.setState("info.connection", false, true);
      return undefined
    }
  }


  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  private onUnload(callback: () => void): void {
    try {
      this.log.info("cleaned everything up...");
      callback();
    } catch (e) {
      callback();
    }
  }


  /**
   * Is called if a subscribed state changes
   */
  private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
    if (state) {
      // The state was changed
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    } else {
      // The state was deleted
      this.log.info(`state ${id} deleted`);
    }
  }

}

if (module.parent) {
  // Export the constructor in compact mode
  module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new MystromWifiBulb(options);
} else {
  // otherwise start the instance directly
  (() => new MystromWifiBulb())();
}