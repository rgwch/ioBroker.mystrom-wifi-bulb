"use strict";
/**
 * Connect MyStrom WiFi Bulbs (https://mystrom.ch/de/wifi-bulb/) with ioBroker
 * Copyright (c) 2020 by G. Weirich
 * License: See LICENSE
 *
 * Adapter templated created with @iobroker/create-adapter v1.24.2
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils = require("@iobroker/adapter-core");
const node_fetch_1 = require("node-fetch");
const API = "/api/v1/";
class MystromWifiBulb extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: "mystrom-wifi-bulb" }));
        this.mac = "";
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        this.on("unload", this.onUnload.bind(this));
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            this.setState("info.connection", false, true);
            const gi = yield this.doFetch("info");
            if (!gi) {
                this.log.error("Could not connect to devcice");
            }
            else {
                if (gi.type != "102") {
                    this.log.warn("unsupported device type " + gi.type);
                }
                // if we could connect and it's indeed a mystrom wifi bulb, setup Objects
                yield this.createObject("boolean", "on", true); // on/off state
                yield this.createObject("string", "mode", true); // mono, rgb or hsv
                yield this.createObject("string", "color", true); // depending on mode
                yield this.createObject("number", "ramp", true); // Time for on/off cycle
                yield this.createObject("number", "power", false); // Consumed power in watts
                yield this.createObject("string", "notify", false); // bulb will set this when changed from other controllers
                this.setState("info.deviceInfo.mac", gi.mac);
                this.mac = gi.mac;
                this.setState("info.deviceInfo.details", JSON.stringify(gi));
                // Fetch current settings and initialize states accordingly
                const dir = yield this.doFetch("device");
                if (!dir) {
                    this.log.error("could not get device info");
                }
                else {
                    const di = dir[this.mac];
                    if (di.type !== "rgblamp") {
                        this.log.warn("unsupported device type " + di.type);
                    }
                    this.setState("on", di.on, true);
                    this.setState("mode", di.mode, true);
                    this.setState("color", di.color, true);
                    this.setState("ramp", di.ramp, true);
                    this.setState("power", di.power, true);
                    // Set callback address for the bulb to our "notify" state. Bulb will POST device info
                    // to this address on every change.
                    if (this.config.hostip) {
                        yield this.doPost({ notifyurl: `${this.config.hostip}/setValueFromBody/${this.namespace}.notify` });
                    }
                    // set connection indicator to "green"
                    this.setState("info.connection", true, true);
                }
            }
            this.subscribeStates("*");
        });
    }
    // Helper to set a state only of it's changed
    setConditionally(statename, act) {
        return __awaiter(this, void 0, void 0, function* () {
            const vl = act[statename];
            const full = this.namespace + "." + statename;
            const old = yield this.getStateAsync(full);
            if (old && old.val) {
                if (old.val != vl) {
                    yield this.setStateAsync(full, vl, true);
                }
            }
        });
    }
    /*
      This is called when the bulb POSTed to the notify url
      We get a DeviceInfo structure and set the states accordingly.
     */
    notify(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.info("Got notify from bulb: " + JSON.stringify(data));
            const di = data[this.mac];
            const states = ["on", "color", "mode", "ramp", "power"];
            states.forEach((st) => __awaiter(this, void 0, void 0, function* () {
                yield this.setConditionally(st, di);
            }));
        });
    }
    /**
    * Is called if a subscribed state changes, or if the bulb POSTed to the notify URL
    */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
            if (!state.ack) {
                // Change On/Off from UI
                if (id.endsWith(".on")) {
                    this.doPost({ action: (state.val ? "on" : "off") });
                }
                else if (id.endsWith("notify")) {
                    // notify from bulb
                    if (state && state.val) {
                        this.notify(JSON.parse(state.val.toString()));
                    }
                }
                else {
                    // Other change from UI
                    this.doPost({ [id.substr(this.namespace.length)]: state.val });
                }
            }
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
    // Helper to create an ioBroker Object
    createObject(type, name, writeable) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setObjectAsync(name, {
                type: "state",
                common: {
                    name,
                    type: type,
                    role: "indicator",
                    read: true,
                    write: writeable
                },
                native: {}
            });
        });
    }
    // Helper to POST data 
    doPost(body) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.config.url + API + "device/" + this.mac;
            let enc = "";
            Object.keys(body).forEach(el => {
                enc += `${el}=${body[el]}&`;
            });
            enc = enc.substr(0, enc.length - 1);
            this.log.info("POSTing " + url + " := " + enc);
            try {
                const response = yield node_fetch_1.default(url, {
                    method: "POST",
                    headers: {
                        "content-type": "application/x-www-form-urlencoded"
                    },
                    body: enc,
                    redirect: "follow"
                });
                if (response.status !== 200) {
                    this.log.error("Error with POST: " + response.status + ", " + response.statusText);
                }
                else {
                    const result = yield response.json();
                    this.log.info(JSON.stringify(result));
                    return result;
                }
            }
            catch (err) {
                this.log.error("Exception with POST " + err);
            }
        });
    }
    doFetch(addr) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.config.url + API;
            this.log.info("Fetching " + url + addr);
            try {
                const response = yield node_fetch_1.default(url + addr, { method: "get" });
                if (response.status == 200) {
                    const result = yield response.json();
                    this.log.info("got " + JSON.stringify(result));
                    return result;
                }
                else {
                    this.log.error("Error while fetching " + addr + ": " + response.status);
                    this.setState("info.connection", false, true);
                    return {};
                }
            }
            catch (err) {
                this.log.error("Fatal error during fetch");
                this.setState("info.connection", false, true);
                return undefined;
            }
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            this.log.info("cleaned everything up...");
            callback();
        }
        catch (e) {
            callback();
        }
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new MystromWifiBulb(options);
}
else {
    // otherwise start the instance directly
    (() => new MystromWifiBulb())();
}
