"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulbListener = void 0;
const http = require("http");
class BulbListener {
    constructor(cb) {
        this.instance = http.createServer((req, res) => {
            if (req.method !== "POST") {
                res.statusCode = 403;
                res.end();
            }
            else {
                let body = "";
                req.on("data", chunk => {
                    body += chunk;
                });
                req.on("end", () => {
                    const result = JSON.parse(body);
                    console.log(result);
                    cb(result);
                    res.statusCode = 200;
                    res.end();
                });
            }
        });
    }
    start(port) {
        this.instance.listen(port);
    }
    stop() {
        this.instance.close();
    }
}
exports.BulbListener = BulbListener;
