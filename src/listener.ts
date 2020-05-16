import * as http from "http"

type callback=(json: any) => void

export class BulbListener {
  private instance: http.Server;
  constructor(cb: callback) {
    this.instance = http.createServer((req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 403
        res.end()
      }else{
        let body=""
        req.on("data",chunk=>{
          body+=chunk
        })
        req.on("end",()=>{
          const result=JSON.parse(body)
          console.log(result)
          cb(result)
          res.statusCode=200
          res.end();
        })
      }
    })
  }

  public start(port: number): void {
    this.instance.listen(port)
  }

  public stop(): void {
    this.instance.close()
  }
}

