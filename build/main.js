"use strict";
/*
 * Created with @iobroker/create-adapter v1.24.2
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
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
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
                yield this.createObject("boolean", "on", true);
                yield this.createObject("string", "mode", true);
                yield this.createObject("string", "color", true);
                yield this.createObject("number", "ramp", true);
                yield this.createObject("number", "power", false);
                this.setState("info.deviceInfo.mac", gi.mac);
                this.mac = gi.mac;
                this.setState("info.deviceInfo.details", JSON.stringify(gi));
                const di = yield this.doFetch("device");
                if (!di) {
                    this.log.error("could not get devive info");
                }
                else {
                    this.setState("on", di.on, true);
                    this.setState("mode", di.mode, true);
                    this.setState("color", di.color, true);
                    this.setState("ramp", di.ramp, true);
                    this.setState("power", di.power, true);
                    if (this.config.hostip) {
                        yield this.doPost({ notifyurl: this.config.hostip });
                    }
                    this.setState("info.connection", true, true);
                }
            }
            this.subscribeStates("*");
        });
    }
    /**
    * Is called if a subscribed state changes
    */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }
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
    doPost(body) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.config.url + API + "device/" + this.mac;
            this.log.info("POSTing " + url + JSON.stringify(body));
            const encoded = new URLSearchParams();
            Object.keys(body).forEach(element => {
                encoded.append(element, body[element]);
            });
            try {
                const response = yield node_fetch_1.default(url, {
                    method: "POST",
                    body: encoded,
                    redirect: "follow"
                });
                if (response.status !== 200) {
                    this.log.error("Error with POST: " + response.status + ", " + response.statusText);
                }
                else {
                    const result = yield response.json();
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
