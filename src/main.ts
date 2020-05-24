/**
 * Connect MyStrom WiFi Bulbs (https://mystrom.ch/de/wifi-bulb/) with ioBroker
 * Copyright (c) 2020 by G. Weirich
 * License: See LICENSE
 *
 * Adapter templated created with @iobroker/create-adapter v1.24.2
 */

import * as utils from "@iobroker/adapter-core";
import fetch from "node-fetch"

const API = "/api/v1/"

type DeviceInfo = {

  type: string;                   // The type of the device
  battery: boolean;               // Wether or not the devices is using batteries
  reachable: boolean;             // Wether or not the device is connected to a myStrom account
  meshroot: boolean;              // DEPRECATED
  on: boolean;                    // Wether or not the bulb is currently turned on
  color: string;                  // The current color
  mode: "rgb" | "hsv" | "mono";   // The color mode the bulb is currently set to
  ramp: number;                   // How quickly the bulb changes its its color
  power: number;                  // The power consumed by the bulb
  fw_version: string;             // The firmware version of the bulb

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
  private mac = ""

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
      if (gi.type != "102") {
        this.log.warn("unsupported device type " + gi.type)
      }
      // if we could connect and it's indeed a mystrom wifi bulb, setup Objects
      await this.createObject("boolean", "on", true)    // on/off state
      await this.createObject("string", "mode", true)   // mono, rgb or hsv
      await this.createObject("string", "color", true)  // depending on mode
      await this.createObject("number", "ramp", true)   // Time for on/off cycle
      await this.createObject("number", "power", false) // Consumed power in watts
      await this.createObject("string", "notify", false) // bulb will set this when changed from other controllers

      this.setState("info.deviceInfo.mac", gi.mac)
      this.mac = gi.mac
      this.setState("info.deviceInfo.details", JSON.stringify(gi))

      // Fetch current settings and initialize states accordingly
      const dir = await this.doFetch("device")
      if (!dir) {
        this.log.error("could not get device info")
      } else {
        const di: DeviceInfo = dir[this.mac]
        if (di.type !== "rgblamp") {
          this.log.warn("unsupported device type " + di.type)
        }
        this.setState("on", di.on, true)
        this.setState("mode", di.mode, true)
        this.setState("color", di.color, true)
        this.setState("ramp", di.ramp, true)
        this.setState("power", di.power, true)
        // Set callback address for the bulb to our "notify" state. Bulb will POST device info
        // to this address on every change.
        if (this.config.hostip) {
          await this.doPost({ notifyurl: `${this.config.hostip}/setValueFromBody/${this.namespace}.notify` })
        }
        // set connection indicator to "green"
        this.setState("info.connection", true, true)
      }

    }

    this.subscribeStates("*");
  }

  // Helper to set a state only of it's changed
  private async setConditionally(statename: "on" | "color" | "mode" | "ramp" | "power", act: DeviceInfo): Promise<void> {
    const vl = act[statename]
    const full = this.namespace + "." + statename
    const old = await this.getStateAsync(full)
    this.log.info("SetState " + full + " from " + old?.val + " to " + vl)
    if (old) {
      if (old.val != vl) {
        await this.setStateAsync(full, vl, true)
      }
    }
  }

  /*
    This is called when the bulb POSTed to the notify url
    We get a DeviceInfo structure and set the states accordingly.
   */
  private async notify(data: any): Promise<void> {
    this.log.debug("Got notify from bulb: " + JSON.stringify(data))
    const di: DeviceInfo = data[this.mac]
    const states = ["on", "color", "mode", "ramp", "power"]
    states.forEach(async st => {
      await this.setConditionally(st as any, di)
    });
  }

  /**
  * Is called if a subscribed state changes, or if the bulb POSTed to the notify URL
  */
  private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
    if (state) {
      // The state was changed
      this.log.debug(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
      if (!state.ack) {
        // Change On/Off from UI
        if (id.endsWith(".on")) {
          this.doPost({ action: (state.val ? "on" : "off") })
        } else if (id.endsWith("notify")) {
          // notify from bulb
          if (state && state.val) {
            this.notify(JSON.parse(state.val.toString()))
          }
        } else {
          // Other change from UI
          this.doPost({ [id.substr(this.namespace.length)]: state.val })
        }

      }
    } else {
      // The state was deleted
      this.log.info(`state ${id} deleted`);
    }
  }


  // Helper to create an ioBroker Object
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

  // Helper to POST data 
  private async doPost(body: any): Promise<any> {
    const url = this.config.url + API + "device/" + this.mac

    let enc = ""
    Object.keys(body).forEach(el => {
      enc += `${el}=${body[el]}&`
    })
    enc = enc.substr(0, enc.length - 1)
    this.log.info("POSTing " + url + " := " + enc)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        body: enc,
        redirect: "follow"
      })
      if (response.status !== 200) {
        this.log.error("Error with POST: " + response.status + ", " + response.statusText)
      } else {
        const result = await response.json()
        this.log.info(JSON.stringify(result))
        return result
      }
    } catch (err) {
      this.log.error("Exception with POST " + err)
    }
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



}

if (module.parent) {
  // Export the constructor in compact mode
  module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new MystromWifiBulb(options);
} else {
  // otherwise start the instance directly
  (() => new MystromWifiBulb())();
}